import { SnapAnyApi } from "src/api/SnapAnyApi";
import { DownloadService } from "src/download-service";
import { YtDlPromptHandler } from "src/ytb-downloader/YtDlPromptHandler";
import { YtDlUtils } from "src/ytb-downloader/YtDlUtils";

export const snapAnyApi = new SnapAnyApi();
export const downloadService = new DownloadService();
export const youtubeDownloadUtils = new YtDlUtils();
export const youtubeDownloadPromptHandler = new YtDlPromptHandler(
  youtubeDownloadUtils,
  downloadService,
  snapAnyApi,
);
