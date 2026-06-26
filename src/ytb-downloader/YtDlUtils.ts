import { existsSync } from "fs";
import { ProgressInfo } from "src/download-service";

export class YtDlUtils {
  private lastProgressLineLength = 0;
  private downloadProgress: Record<"video" | "audio", ProgressInfo> = {
    video: { loaded: 0 },
    audio: { loaded: 0 },
  };

  public writeProgressLine = (message: string) => {
    const clearPadding = " ".repeat(
      Math.max(0, this.lastProgressLineLength - message.length),
    );
    process.stdout.write(`\r${message}${clearPadding}`);
    this.lastProgressLineLength = message.length;
  };

  public finishProgressLine = (message: string) => {
    const clearPadding = " ".repeat(
      Math.max(0, this.lastProgressLineLength - message.length),
    );
    process.stdout.write(`\r${message}${clearPadding}\n`);
    this.lastProgressLineLength = 0;
  };

  public formatPercent = (value: number) =>
    `${Math.min(100, Math.max(0, value)).toFixed(1)}%`;

  public getVideoIdAndType = (youtubeUrl: string) => {
    const shortRegex = /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/;
    const watchRegex = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/;

    const shortMatch = youtubeUrl.match(shortRegex);
    const watchMatch = youtubeUrl.match(watchRegex);
    if (shortMatch) {
      return {
        type: "shorts",
        id: shortMatch[1],
      };
    }

    if (watchMatch) {
      return {
        type: "video",
        id: watchMatch[1],
      };
    }

    throw new Error("❌❌❌ URL không hợp lệ cho YouTube video hoặc shorts.");
  };

  public renderDownloadProgress = () => {
    const loaded =
      this.downloadProgress.video.loaded + this.downloadProgress.audio.loaded;
    const videoTotal = this.downloadProgress.video.total;
    const audioTotal = this.downloadProgress.audio.total;

    if (videoTotal && audioTotal) {
      const total = videoTotal + audioTotal;
      this.writeProgressLine(
        `⌛ Đang tải: ${this.formatPercent((loaded / total) * 100)}`,
      );
      return;
    }

    this.writeProgressLine(
      `⌛ Đang tải: ${(loaded / (1024 * 1024)).toFixed(1)}MB`,
    );
  };

  public validateYouTubeUrl = (youtubeUrl: string) => {
    const shortRegex = /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/;
    const watchRegex = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/;
    if (shortRegex.test(youtubeUrl) || watchRegex.test(youtubeUrl)) {
      return true;
    }
    throw new Error("❌❌❌ URL không hợp lệ cho YouTube video hoặc shorts.");
  };

  public validateSavedFilePath = (filePath: string) => {
    if (!filePath.trim()) {
      throw new Error("Vui lòng nhập đường dẫn.");
    }
    if (!existsSync(filePath)) {
      throw new Error(
        "Đường dẫn không tồn tại. Vui lòng nhập đường dẫn hợp lệ.",
      );
    }
    return true;
  };

  public updateDownloadProgress = (
    type: "video" | "audio",
    progress: ProgressInfo,
  ) => {
    this.downloadProgress[type] = progress;
    this.renderDownloadProgress();
  };
}
