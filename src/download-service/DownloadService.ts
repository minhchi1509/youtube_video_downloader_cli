import axios, { AxiosInstance } from "axios";
import { createWriteStream, existsSync } from "fs";
import { open, readFile, rename, rm, stat, writeFile } from "fs/promises";
import * as http from "http";
import * as https from "https";
import { availableParallelism, cpus } from "os";
import path from "path";
import {
  DEFAULT_MAX_CHUNK_SIZE,
  DEFAULT_MIN_CHUNK_SIZE,
  DEFAULT_RETRIES,
  ONE_MB,
  STATE_WRITE_INTERVAL_MS,
} from "src/download-service/constants";
import {
  Chunk,
  DownloadMetadata,
  DownloadOptions,
  DownloadState,
  ProgressInfo,
} from "src/download-service/types";
import { pipeline } from "stream/promises";

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Download aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Download aborted"));
      },
      { once: true },
    );
  });

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new Error("Download aborted");
  }
};

const isNotFoundError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

export class DownloadService {
  private readonly client: AxiosInstance;

  public constructor() {
    this.client = axios.create({
      decompress: false,
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 64 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 64 }),
      maxRedirects: 5,
      timeout: 60_000,
    });
  }

  public getDefaultDownloadPath = (): string | null => {
    const userProfile = process.env.USERPROFILE;
    if (!userProfile) {
      return null;
    }

    const downloadsPath = path.join(userProfile, "Downloads");
    return existsSync(downloadsPath) ? downloadsPath : null;
  };

  public async downloadFile(
    url: string,
    outputPath: string,
    onProgress?: (progress: ProgressInfo) => void,
    options: DownloadOptions = {},
  ): Promise<void> {
    throwIfAborted(options.signal);
    // await mkdir(path.dirname(outputPath), { recursive: true });

    const metadata = await this.getDownloadMetadata(url, options.signal);

    if (!metadata.supportsRange || !metadata.total) {
      await this.downloadStream(url, outputPath, onProgress, options);
      return;
    }

    await this.downloadByRanges(
      url,
      outputPath,
      metadata.total,
      onProgress,
      options,
    );
  }

  private async getDownloadMetadata(
    url: string,
    signal?: AbortSignal,
  ): Promise<DownloadMetadata> {
    try {
      const response = await this.client.head(url, {
        headers: {
          "Accept-Encoding": "identity",
        },
        signal,
      });
      const total = Number(response.headers["content-length"]) || undefined;
      const acceptRanges = String(
        response.headers["accept-ranges"] ?? "",
      ).toLowerCase();

      return {
        total,
        supportsRange: Boolean(total) && acceptRanges.includes("bytes"),
      };
    } catch (error) {
      return {
        supportsRange: false,
      };
    }
  }

  private async downloadStream(
    url: string,
    outputPath: string,
    onProgress?: (progress: ProgressInfo) => void,
    options: DownloadOptions = {},
  ): Promise<void> {
    const tempPath = this.getTempPath(outputPath);

    await rm(tempPath, { force: true });
    throwIfAborted(options.signal);

    const response = await this.client({
      method: "GET",
      url,
      responseType: "stream",
      headers: {
        "Accept-Encoding": "identity",
      },
      signal: options.signal,
    });
    const total = Number(response.headers["content-length"]) || undefined;
    let loaded = 0;

    response.data.on("data", (chunk: Buffer) => {
      loaded += chunk.length;
      onProgress?.({ loaded, total });
    });

    await pipeline(response.data, createWriteStream(tempPath), {
      signal: options.signal,
    });
    await this.replaceOutput(tempPath, outputPath);
  }

  private async downloadByRanges(
    url: string,
    outputPath: string,
    total: number,
    onProgress?: (progress: ProgressInfo) => void,
    options: DownloadOptions = {},
  ): Promise<void> {
    const tempPath = this.getTempPath(outputPath);
    const statePath = this.getStatePath(outputPath);
    const chunkSize = this.getAdaptiveChunkSize(total, options);
    const chunks = this.createChunks(total, chunkSize);
    const state = await this.loadOrCreateState(
      url,
      total,
      chunkSize,
      chunks,
      tempPath,
      statePath,
    );

    await this.ensureDownloadFile(tempPath, total, state);

    let completedLoaded = this.getCompletedBytes(chunks, state.completed);
    let activeLoaded = 0;
    let lastStateWrite = 0;
    const pendingChunks = chunks.filter(
      (chunk) => !state.completed[chunk.index],
    );
    const retries = options.retries ?? DEFAULT_RETRIES;
    const workerCount = this.getAdaptiveWorkerCount(
      total,
      pendingChunks.length,
      options,
    );
    const fileHandle = await open(tempPath, "r+");

    onProgress?.({ loaded: completedLoaded, total });

    const saveState = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastStateWrite < STATE_WRITE_INTERVAL_MS) {
        return;
      }

      lastStateWrite = now;
      await this.writeState(statePath, state);
    };

    try {
      let nextIndex = 0;
      let firstError: unknown;

      const workers = Array.from({ length: workerCount }, async () => {
        while (nextIndex < pendingChunks.length && !firstError) {
          const chunk = pendingChunks[nextIndex++];
          if (!chunk) {
            continue;
          }

          try {
            await this.downloadChunkWithRetry({
              url,
              chunk,
              fileHandle,
              retries,
              signal: options.signal,
              onDelta: (delta) => {
                activeLoaded += delta;
                onProgress?.({ loaded: completedLoaded + activeLoaded, total });
              },
              onAttemptFailed: (attemptLoaded) => {
                activeLoaded -= attemptLoaded;
                onProgress?.({ loaded: completedLoaded + activeLoaded, total });
              },
            });

            activeLoaded -= chunk.size;
            state.completed[chunk.index] = true;
            completedLoaded += chunk.size;
            onProgress?.({ loaded: completedLoaded + activeLoaded, total });
            await saveState();
          } catch (error) {
            firstError = error;
          }
        }
      });

      await Promise.all(workers);

      if (firstError) {
        throw firstError;
      }

      await saveState(true);
    } finally {
      await fileHandle.close();
    }

    await this.replaceOutput(tempPath, outputPath);
    await rm(statePath, { force: true });
    onProgress?.({ loaded: total, total });
  }

  private async downloadChunkWithRetry(params: {
    url: string;
    chunk: Chunk;
    fileHandle: Awaited<ReturnType<typeof open>>;
    retries: number;
    signal?: AbortSignal;
    onDelta: (delta: number) => void;
    onAttemptFailed: (attemptLoaded: number) => void;
  }): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= params.retries; attempt += 1) {
      let attemptLoaded = 0;

      try {
        throwIfAborted(params.signal);
        const response = await this.client({
          method: "GET",
          url: params.url,
          responseType: "stream",
          headers: {
            "Accept-Encoding": "identity",
            Range: `bytes=${params.chunk.start}-${params.chunk.end}`,
          },
          signal: params.signal,
          validateStatus: (status) => status === 206,
        });

        for await (const data of response.data as AsyncIterable<Buffer>) {
          throwIfAborted(params.signal);
          const position = params.chunk.start + attemptLoaded;

          await params.fileHandle.write(data, 0, data.length, position);
          attemptLoaded += data.length;
          params.onDelta(data.length);
        }

        if (attemptLoaded !== params.chunk.size) {
          throw new Error(
            `Incomplete chunk ${params.chunk.index}: expected ${params.chunk.size}, received ${attemptLoaded}`,
          );
        }

        return;
      } catch (error) {
        lastError = error;
        params.onAttemptFailed(attemptLoaded);

        if (attempt >= params.retries) {
          break;
        }

        await delay(this.getRetryDelay(attempt), params.signal);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to download chunk ${params.chunk.index}`);
  }

  private getAdaptiveChunkSize(
    total: number,
    options: DownloadOptions,
  ): number {
    const minChunkSize = options.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE;
    const maxChunkSize = options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;

    if (total < 128 * ONE_MB) {
      return minChunkSize;
    }

    if (total < 2 * 1024 * ONE_MB) {
      return Math.min(8 * ONE_MB, maxChunkSize);
    }

    if (total < 20 * 1024 * ONE_MB) {
      return Math.min(16 * ONE_MB, maxChunkSize);
    }

    return maxChunkSize;
  }

  private getAdaptiveWorkerCount(
    total: number,
    pendingChunks: number,
    options: DownloadOptions,
  ): number {
    const cpuCount =
      typeof availableParallelism === "function"
        ? availableParallelism()
        : cpus().length;
    const maxWorkers =
      options.maxWorkers ?? Math.min(16, Math.max(2, cpuCount));

    if (pendingChunks <= 1) {
      return 1;
    }

    if (total < 64 * ONE_MB) {
      return Math.min(2, pendingChunks, maxWorkers);
    }

    if (total < 512 * ONE_MB) {
      return Math.min(4, pendingChunks, maxWorkers);
    }

    if (total < 5 * 1024 * ONE_MB) {
      return Math.min(8, pendingChunks, maxWorkers);
    }

    return Math.min(16, pendingChunks, maxWorkers);
  }

  private createChunks(total: number, chunkSize: number): Chunk[] {
    return Array.from({ length: Math.ceil(total / chunkSize) }, (_, index) => {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize - 1, total - 1);

      return {
        index,
        start,
        end,
        size: end - start + 1,
      };
    });
  }

  private async loadOrCreateState(
    url: string,
    total: number,
    chunkSize: number,
    chunks: Chunk[],
    tempPath: string,
    statePath: string,
  ): Promise<DownloadState> {
    try {
      const [rawState, tempStat] = await Promise.all([
        readFile(statePath, "utf8"),
        stat(tempPath),
      ]);
      const state = JSON.parse(rawState) as DownloadState;

      if (
        tempStat.size === total &&
        state.url === url &&
        state.total === total &&
        state.chunkSize === chunkSize &&
        state.completed.length === chunks.length
      ) {
        return state;
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        await rm(statePath, { force: true });
      }
    }

    await rm(tempPath, { force: true });

    return {
      url,
      total,
      chunkSize,
      completed: new Array(chunks.length).fill(false) as boolean[],
    };
  }

  private async ensureDownloadFile(
    tempPath: string,
    total: number,
    state: DownloadState,
  ): Promise<void> {
    try {
      const current = await stat(tempPath);
      if (current.size === total) {
        return;
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    state.completed.fill(false);
    const fileHandle = await open(tempPath, "w");
    try {
      await fileHandle.truncate(total);
    } finally {
      await fileHandle.close();
    }
  }

  private getCompletedBytes(chunks: Chunk[], completed: boolean[]): number {
    let loaded = 0;

    for (const chunk of chunks) {
      if (completed[chunk.index]) {
        loaded += chunk.size;
      }
    }

    return loaded;
  }

  private getRetryDelay(attempt: number): number {
    return Math.min(30_000, 1_000 * 2 ** attempt);
  }

  private async writeState(
    statePath: string,
    state: DownloadState,
  ): Promise<void> {
    await writeFile(statePath, JSON.stringify(state), "utf8");
  }

  private async replaceOutput(
    tempPath: string,
    outputPath: string,
  ): Promise<void> {
    await rm(outputPath, { force: true });
    await rename(tempPath, outputPath);
  }

  private getTempPath(outputPath: string): string {
    return `${outputPath}.download`;
  }

  private getStatePath(outputPath: string): string {
    return `${outputPath}.download.state.json`;
  }
}
