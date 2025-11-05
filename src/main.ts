import inquirer from "inquirer";
import path from "path";
import { existsSync } from "fs";
import {
  callSnapanyApi,
  mergeAudioToVideoFromUrl,
  checkFfmpegInstalled,
  getDefaultDownloadPath,
  getVideoIDAndType,
} from "src/utils";

const main = async () => {
  try {
    // Kiểm tra xem ffmpeg đã được cài đặt hay chưa
    console.log("🔧 Đang kiểm tra ffmpeg...");
    const isFfmpegInstalled = await checkFfmpegInstalled();

    if (!isFfmpegInstalled) {
      console.error(
        "❌ Lỗi: ffmpeg chưa được cài đặt hoặc không có trong PATH."
      );
      console.error(
        "💡 Vui lòng cài đặt ffmpeg từ https://ffmpeg.org/download.html"
      );
      console.error("   Hoặc sử dụng chocolatey: choco install ffmpeg");
      console.error("   Hoặc sử dụng scoop: scoop install ffmpeg");
      process.exit(1);
    }

    console.log("✅ ffmpeg đã được cài đặt.");

    // Hiển thị để người dùng nhập URL video YouTube cần tải
    const { youtubeUrl } = await inquirer.prompt([
      {
        type: "input",
        name: "youtubeUrl",
        message: "Nhập URL video YouTube cần tải:",
        validate: (input: string) => {
          const shortRegex = /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/;
          const watchRegex = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/;
          if (shortRegex.test(input) || watchRegex.test(input)) {
            return true;
          }
          return "URL không hợp lệ. Vui lòng nhập URL YouTube video hoặc shorts.";
        },
      },
    ]);

    console.log("🔍 Đang lấy thông tin video...");
    const snapanyResponseData = await callSnapanyApi(youtubeUrl);
    const videoFormats = snapanyResponseData.medias.find(
      (media: any) => media.media_type === "video"
    ).formats;

    if (!videoFormats || videoFormats.length === 0) {
      throw new Error("❌ Không tìm thấy định dạng video nào.");
    }

    // Hiển thị các tùy chọn chất lượng video
    const { selectedFormat } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedFormat",
        message: "Chọn chất lượng video:",
        choices: videoFormats.map((format: any, index: number) => ({
          name: `${format.quality_note} (Video: ${(
            format.video_size /
            (1024 * 1024)
          ).toFixed(1)}MB, Audio: ${(format.audio_size / (1024 * 1024)).toFixed(
            1
          )}MB)`,
          value: index,
        })),
      },
    ]);

    const chosenFormat = videoFormats[selectedFormat];
    console.log(`✅ Đã chọn chất lượng: ${chosenFormat.quality_note}`);

    // Kiểm tra và lấy đường dẫn download
    let downloadPath: string = getDefaultDownloadPath() || "";

    if (!downloadPath) {
      // Nếu thư mục Downloads không tồn tại, yêu cầu người dùng nhập đường dẫn
      const { customPath } = await inquirer.prompt([
        {
          type: "input",
          name: "customPath",
          message: "Nhập đường dẫn thư mục để lưu video:",
          validate: (input: string) => {
            if (!input.trim()) {
              return "Vui lòng nhập đường dẫn.";
            }
            if (!existsSync(input)) {
              return "Đường dẫn không tồn tại. Vui lòng nhập đường dẫn hợp lệ.";
            }
            return true;
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
              if (!input.trim()) {
                return "Vui lòng nhập đường dẫn.";
              }
              if (!existsSync(input)) {
                return "Đường dẫn không tồn tại. Vui lòng nhập đường dẫn hợp lệ.";
              }
              return true;
            },
          },
        ]);
        downloadPath = customPath;
      }
    }

    const { id: videoId, type: videoType } = getVideoIDAndType(youtubeUrl);

    // Lấy đường dẫn output
    const fileName = `${videoType}_${videoId}.mp4`;
    const outputPath = path.join(downloadPath, fileName);

    console.log(`📁 Video sẽ được lưu tại: ${outputPath}`);

    // Gọi hàm mergeAudioToVideoFromUrl
    await mergeAudioToVideoFromUrl(
      videoId!,
      chosenFormat.video_url,
      chosenFormat.audio_url,
      outputPath
    );

    console.log(`🎉 Tải video thành công! File đã được lưu tại: ${outputPath}`);
  } catch (error) {
    console.error("❌ Lỗi:", error);
  }
};

main();
