import { exec, spawn } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { IMergeAudioToVideoOptions } from "src/ffmpeg/types";
import { promisify } from "util";

export class FfmpegService {
  private static execAsync = promisify(exec);

  private static timeToSeconds = (time: string): number => {
    const [hours = "0", minutes = "0", seconds = "0"] = time.split(":");
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  };

  public static checkFfmpegInstalled = async (): Promise<boolean> => {
    try {
      await this.execAsync("ffmpeg -version");
      return true;
    } catch (error) {
      return false;
    }
  };

  public static mergeAudioToVideo = async (
    options: IMergeAudioToVideoOptions,
  ) => {
    const {
      tempVideoPath,
      tempAudioPath,
      outputPath,
      onStart,
      onProgress,
      onComplete,
      onError,
    } = options;

    const ffmpegArgs = [
      "-i",
      tempVideoPath,
      "-i",
      tempAudioPath,
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      outputPath,
      "-y",
    ];

    return new Promise((resolve, reject) => {
      onStart?.();

      const child = spawn("ffmpeg", ffmpegArgs);
      let durationSeconds: number | null = null;
      let ffmpegError = "";

      child.stderr?.on("data", (chunk: Buffer) => {
        const message = chunk.toString();
        ffmpegError += message;

        const durationMatch = message.match(
          /Duration:\s(\d{2}:\d{2}:\d{2}\.\d{2})/,
        );
        if (durationMatch?.[1]) {
          durationSeconds = this.timeToSeconds(durationMatch[1]);
        }

        const timeMatch = message.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
        if (timeMatch?.[1] && durationSeconds) {
          const currentSeconds = this.timeToSeconds(timeMatch[1]);
          onProgress?.({ currentSeconds, durationSeconds });
        }
      });

      child.on("error", (err) => {
        onError?.(err);
        reject(err);
      });

      child.on("close", (code) => {
        [tempVideoPath, tempAudioPath].forEach((file) => {
          if (existsSync(file)) {
            unlinkSync(file);
          }
        });

        if (code === 0) {
          onComplete?.();
          resolve("Done");
        } else {
          onError?.(
            new Error(`❌ FFmpeg exited with code ${code}\n${ffmpegError}`),
          );
          reject(
            new Error(`❌ FFmpeg exited with code ${code}\n${ffmpegError}`),
          );
        }
      });
    });
  };
}
