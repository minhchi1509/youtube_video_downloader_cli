import axios, { AxiosInstance } from "axios";
import * as crypto from "crypto";
import { IYoutubeVideoFormat } from "src/api/types";

export class SnapAnyApi {
  private readonly apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: "https://api.snapany.com/v1",
      headers: {
        "Content-Type": "application/json",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      },
    });
  }

  private createHeaderSignature = (url: string) => {
    const secretKey = "a5wU-SVyy5gXIyMbPQIfIz7UP7rCBp76U8Z8i-FtDMU";
    const locale = "en";
    const timestamp = Date.now();

    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(url + locale + timestamp)
      .digest("hex");

    return {
      "Accept-Language": locale,
      "G-Timestamp": String(timestamp),
      "G-Footer": signature,
    };
  };

  public getYoutubeVideoFormats = async (youtubeUrl: string) => {
    const { data: responseData } = await this.apiClient.post(
      "/extract/post",
      {
        link: youtubeUrl,
      },
      {
        headers: {
          ...this.createHeaderSignature(youtubeUrl),
        },
      },
    );

    const videoFormatsRawData = responseData.medias.find(
      (media: any) => media.media_type === "video",
    ).formats;

    if (!videoFormatsRawData || videoFormatsRawData.length === 0) {
      throw new Error("❌ Không tìm thấy định dạng video nào.");
    }

    const videoFormats: IYoutubeVideoFormat[] = videoFormatsRawData.map(
      (format: any) => ({
        quality: format.quality,
        qualityNote: format.quality_note,
        videoUrl: format.video_url,
        videoSize: format.video_size,
        audioUrl: format.audio_url,
        audioSize: format.audio_size,
      }),
    );

    return videoFormats;
  };
}
