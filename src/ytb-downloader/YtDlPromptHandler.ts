import { existsSync, mkdirSync, unlinkSync } from "fs";
import inquirer from "inquirer";
import path from "path";
import { SnapAnyApi } from "src/api/SnapAnyApi";
import { IYoutubeVideoFormat } from "src/api/types";
import { DownloadService } from "src/download-service";
import { FfmpegService } from "src/ffmpeg/FfmpegService";
import { YtDlUtils } from "src/ytb-downloader/YtDlUtils";

export class YtDlPromptHandler {
  constructor(
    private readonly youtubeDownloadUtils: YtDlUtils,
    private readonly downloadService: DownloadService,
    private readonly snapAnyApi: SnapAnyApi,
  ) {}

  private ffmpegInstallationChecking = async () => {
    console.log("🔧 Đang kiểm tra ffmpeg...");
    const isFfmpegInstalled = await FfmpegService.checkFfmpegInstalled();

    if (!isFfmpegInstalled) {
      console.error(
        "❌ Lỗi: ffmpeg chưa được cài đặt hoặc không có trong PATH.",
      );
      console.error(
        "💡 Vui lòng cài đặt ffmpeg từ https://ffmpeg.org/download.html",
      );
      console.error("   Hoặc sử dụng chocolatey: choco install ffmpeg");
      console.error("   Hoặc sử dụng scoop: scoop install ffmpeg");
      process.exit(1);
    }

    console.log("✅ ffmpeg đã được cài đặt.");
  };

  // Hiển thị để người dùng nhập URL video YouTube cần tải
  private enterYoutubeUrlPrompt = async () => {
    const { youtubeUrl } = await inquirer.prompt([
      {
        type: "input",
        name: "youtubeUrl",
        message: "Nhập URL video YouTube cần tải:",
        validate: (input: string) => {
          try {
            return this.youtubeDownloadUtils.validateYouTubeUrl(input);
          } catch (error) {
            return (error as Error).message;
          }
        },
      },
    ]);
    return youtubeUrl;
  };

  // Hiển thị các tùy chọn chất lượng video
  private selectVideoQualityPrompt = async (
    videoFormats: IYoutubeVideoFormat[],
  ) => {
    const { selectedFormat } = await inquirer.prompt([
      {
        type: "select",
        name: "selectedFormat",
        message: "Chọn chất lượng video:",
        choices: videoFormats.map((format, index) => ({
          name: `${format.qualityNote} (Video: ${(
            format.videoSize /
            (1024 * 1024)
          ).toFixed(1)}MB, Audio: ${(format.audioSize / (1024 * 1024)).toFixed(
            1,
          )}MB)`,
          value: index,
        })),
      },
    ]);
    return selectedFormat;
  };

  // Hiển thị để người dùng nhập đường dẫn lưu video (nếu cần)
  private enterDownloadPathPrompt = async (): Promise<string> => {
    let downloadPath: string =
      this.downloadService.getDefaultDownloadPath() || "";

    if (!downloadPath) {
      // Nếu thư mục Downloads không tồn tại, yêu cầu người dùng nhập đường dẫn
      const { customPath } = await inquirer.prompt([
        {
          type: "input",
          name: "customPath",
          message: "Nhập đường dẫn thư mục để lưu video:",
          validate: (input: string) => {
            try {
              return this.youtubeDownloadUtils.validateSavedFilePath(input);
            } catch (error) {
              return (error as Error).message;
            }
          },
        },
      ]);
      downloadPath = customPath;
    } else {
      // Hỏi người dùng có muốn sử dụng thư mục Downloads mặc định không
      const { useDefault } = await inquirer.prompt([
        {
          type: "confirm",
          name: "useDefault",
          message: `Sử dụng thư mục Downloads mặc định (${downloadPath})?`,
          default: true,
        },
      ]);

      if (!useDefault) {
        const { customPath } = await inquirer.prompt([
          {
            type: "input",
            name: "customPath",
            message: "Nhập đường dẫn thư mục để lưu video:",
            validate: (input: string) => {
              try {
                return this.youtubeDownloadUtils.validateSavedFilePath(input);
              } catch (error) {
                return (error as Error).message;
              }
            },
          },
        ]);
        downloadPath = customPath;
      }
    }

    return downloadPath;
  };

  private startDownloadAndMergeProcess = async ({
    videoId,
    videoUrl,
    audioUrl,
    outputPath,
  }: {
    videoId: string;
    videoUrl: string;
    audioUrl: string;
    outputPath: string;
  }) => {
    const folder = path.dirname(outputPath);
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true });
    }

    const tempVideoPath = path.join(folder, `temp_video_${videoId}.mp4`);
    const tempAudioPath = path.join(folder, `temp_audio_${videoId}.mp3`);

    try {
      console.log("📥 Bắt đầu tải video và audio...");

      const startTime = Date.now();

      await Promise.all([
        this.downloadService.downloadFile(
          videoUrl,
          tempVideoPath,
          (progress) => {
            this.youtubeDownloadUtils.updateDownloadProgress("video", progress);
          },
        ),
        this.downloadService.downloadFile(
          audioUrl,
          tempAudioPath,
          (progress) => {
            this.youtubeDownloadUtils.updateDownloadProgress("audio", progress);
          },
        ),
      ]);
      this.youtubeDownloadUtils.finishProgressLine(
        "✅ Tải file thành công: 100%",
      );

      await FfmpegService.mergeAudioToVideo({
        outputPath,
        tempAudioPath,
        tempVideoPath,
        onStart: () => {
          console.log("🔧 Bắt đầu ghép video và audio...");
        },
        onProgress: ({ durationSeconds, currentSeconds }) => {
          this.youtubeDownloadUtils.writeProgressLine(
            `⌛ Đang ghép: ${this.youtubeDownloadUtils.formatPercent(
              (currentSeconds / durationSeconds) * 100,
            )}`,
          );
        },
        onComplete: () => {
          this.youtubeDownloadUtils.finishProgressLine(
            "✅ Ghép video + audio thành công: 100%",
          );
          const endTime = Date.now();
          const duration = (endTime - startTime) / 1000;
          console.log(`⏱️ Thời gian hoàn thành: ${duration.toFixed(2)} giây`);
        },
      });
    } catch (error) {
      [tempVideoPath, tempAudioPath].forEach((file) => {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      });
      throw error;
    }
  };

  public startMainProcess = async () => {
    try {
      await this.ffmpegInstallationChecking();
      const youtubeUrl = await this.enterYoutubeUrlPrompt();

      console.log("🔍 Đang lấy thông tin video...");

      const videoFormats =
        await this.snapAnyApi.getYoutubeVideoFormats(youtubeUrl);

      const selectedFormatIndex =
        await this.selectVideoQualityPrompt(videoFormats);
      const chosenFormat = videoFormats[selectedFormatIndex];

      if (!chosenFormat) {
        throw new Error("❌ Không tìm thấy định dạng video nào.");
      }

      console.log(`✅ Đã chọn chất lượng: ${chosenFormat.qualityNote}`);

      const downloadPath = await this.enterDownloadPathPrompt();

      const { id: videoId, type: videoType } =
        this.youtubeDownloadUtils.getVideoIdAndType(youtubeUrl);

      if (!videoId) {
        throw new Error("❌ Không thể lấy ID video từ URL.");
      }

      // Lấy đường dẫn output
      const fileName = `${videoType}_${videoId}.mp4`;
      const outputPath = path.join(downloadPath, fileName);

      console.log(`📁 Video sẽ được lưu tại: ${outputPath}`);

      await this.startDownloadAndMergeProcess({
        videoId,
        videoUrl: chosenFormat.videoUrl,
        audioUrl: chosenFormat.audioUrl,
        outputPath,
      });

      console.log(
        `🎉 Tải video thành công! File đã được lưu tại: ${outputPath}`,
      );
    } catch (error) {
      console.error(`❌ Lỗi: ${(error as Error).message}`);
    }
  };
}
