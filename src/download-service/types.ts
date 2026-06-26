export interface ProgressInfo {
  loaded: number;
  total?: number;
}

export interface DownloadOptions {
  signal?: AbortSignal;
  retries?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
  maxWorkers?: number;
}

export interface DownloadMetadata {
  total?: number;
  supportsRange: boolean;
}

export interface Chunk {
  index: number;
  start: number;
  end: number;
  size: number;
}

export interface DownloadState {
  url: string;
  total: number;
  chunkSize: number;
  completed: boolean[];
}
