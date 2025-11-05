import axios from "axios";
import { exec } from "child_process";
import * as crypto from "crypto";
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

const createSnapanySignature = (youtubeUrl: string) => {
  const secretKey = "6HTugjCXxR";
  const locale = "en";
  const timestamp = Date.now();

  const signature = crypto
    .createHash("md5")
    .update(youtubeUrl + locale + String(timestamp) + secretKey)
    .digest("hex");

  return {
    "G-Timestamp": String(timestamp),
    "G-Footer": signature,
  };
};

export const callSnapanyApi = async (youtubeUrl: string) => {
  const { data } = await axios.post(
    "https://api.snapany.com/v1/extract",
    {
      link: youtubeUrl,
    },
    {
      headers: {
        ...createSnapanySignature(youtubeUrl),
        "Content-Type": "application/json",
        "Accept-Language": "en",
      },
    }
  );

  return data;
};

export const getVideoIDAndType = (youtubeUrl: string) => {
  // Regex cho dạng "/shorts/<id>"
  const shortRegex = /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/;
  // Regex cho dạng "/watch?v=<id>"
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

// Kiểm tra xem ffmpeg đã được cài đặt hay chưa
export const checkFfmpegInstalled = async (): Promise<boolean> => {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch (error) {
    return false;
  }
};

// Kiểm tra và lấy đường dẫn download mặc định
export const getDefaultDownloadPath = (): string | null => {
  const userProfile = process.env.USERPROFILE;
  if (!userProfile) {
    return null;
  }

  const downloadsPath = path.join(userProfile, "Downloads");
  return existsSync(downloadsPath) ? downloadsPath : null;
};

const downloadFile = async (url: string, outputPath: string): Promise<void> => {
  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    const writer = createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

export const mergeAudioToVideoFromUrl = async (
  videoID: string,
  videoUrl: string,
  audioUrl: string,
  outputPath: string
): Promise<string> => {
  const folder = path.dirname(outputPath);
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  }

  // Tạo tên file tạm cho video và audio
  const tempVideoPath = path.join(folder, `temp_video_${videoID}.mp4`);
  const tempAudioPath = path.join(folder, `temp_audio_${videoID}.mp3`); // Giả sử audio là mp3, thay đổi nếu cần

  try {
    // Tải song song video và audio
    console.log("📥 Bắt đầu tải video và audio...");
    await Promise.all([
      downloadFile(videoUrl, tempVideoPath),
      downloadFile(audioUrl, tempAudioPath),
    ]);
    console.log("✅ Tải file thành công");

    // Lệnh FFmpeg trên file local, thử copy audio nếu tương thích để nhanh hơn
    // Nếu audio không tương thích, giữ -c:a aac
    const cmd = `ffmpeg -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -c:a copy -map 0:v:0 -map 1:a:0 "${outputPath}" -y`;
    // Hoặc nếu cần mã hóa audio: thay -c:a copy bằng -c:a aac -strict experimental

    return new Promise((resolve, reject) => {
      const child = exec(cmd);

      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);

      child.on("error", (err) => {
        reject(err);
      });

      child.on("close", (code) => {
        // Xóa file tạm sau khi xong
        [tempVideoPath, tempAudioPath].forEach((file) => {
          if (existsSync(file)) {
            unlinkSync(file);
          }
        });

        if (code === 0) {
          console.log("✅ Hợp nhất video + audio thành công");
          resolve("Done");
        } else {
          reject(new Error(`❌ FFmpeg exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    // Xóa file tạm nếu lỗi
    [tempVideoPath, tempAudioPath].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
    throw error;
  }
};
