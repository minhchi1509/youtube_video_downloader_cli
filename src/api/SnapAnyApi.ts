import axios, { AxiosInstance } from "axios";
import * as crypto from "crypto";
import { IYoutubeVideoFormat } from "src/api/types";

export class SnapAnyApi {
  private readonly apiClient: AxiosInstance;
  private static readonly SIGNATURE_SECRET =
    "a5wU-SVyy5gXIyMbPQIfIz7UP7rCBp76U8Z8i-FtDMU";

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

  private createHeaderSignature = (url: string, locale = "en") => {
    const timestamp = Date.now();

    const signature = crypto
      .createHmac("sha256", SnapAnyApi.SIGNATURE_SECRET)
      .update(url + locale + timestamp)
      .digest("hex");

    return {
      "Accept-Language": locale,
      "G-Timestamp": String(timestamp),
      "G-Footer": signature,
    };
  };

  public getYoutubeVideoFormats = async (youtubeUrl: string, locale = "en") => {
    const { data: responseData } = await this.apiClient.post(
      "/extract/post",
      {
        link: youtubeUrl,
      },
      {
        headers: {
          ...this.createHeaderSignature(youtubeUrl, locale),
        },
      },
    );

    const videoFormatsRawData = responseData.medias.find(
      (media: any) => media.media_type === "video",
    ).variants;

    if (!videoFormatsRawData || videoFormatsRawData.length === 0) {
      throw new Error("❌ Không tìm thấy định dạng video nào.");
    }

    const videoFormats: IYoutubeVideoFormat[] = videoFormatsRawData.map(
      (format: any) => ({
        quality: format.quality,
        qualityNote: format.quality_label,
        videoUrl: format.video_url,
        videoSize: format.video_filesize,
        audioUrl: format.audio_url,
        audioSize: format.audio_filesize,
      }),
    );

    return videoFormats;
  };
}
