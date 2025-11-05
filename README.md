# 🎬 YouTube Video Downloader CLI

[![npm version](https://badge.fury.io/js/%40minhchi1509%2Fytdl.svg)](https://www.npmjs.com/package/@minhchi1509/ytdl)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Một công cụ dòng lệnh (CLI) mạnh mẽ và dễ sử dụng để tải video YouTube với chất lượng cao, hỗ trợ cả video thường và YouTube Shorts.

## ✨ Tính năng

- 🎯 **Tải video YouTube và Shorts** với chất lượng tùy chọn
- 🔧 **Hợp nhất audio và video** tự động bằng FFmpeg
- 📁 **Tùy chọn thư mục lưu** linh hoạt (mặc định hoặc tùy chỉnh)
- 🎨 **Giao diện thân thiện** với emoji và màu sắc
- ✅ **Kiểm tra dependencies** tự động (FFmpeg)
- 📊 **Hiển thị thông tin file** (kích thước video/audio)

## 📋 Yêu cầu hệ thống

### 🔴 Bắt buộc: Cài đặt FFmpeg trước

Trước khi sử dụng công cụ này, bạn **BẮT BUỘC** phải cài đặt FFmpeg:

#### Windows

```bash
# Sử dụng Chocolatey
choco install ffmpeg

# Hoặc sử dụng Scoop
scoop install ffmpeg

# Hoặc tải từ trang chính thức
# https://ffmpeg.org/download.html
```

#### MacOS

```bash
# Sử dụng Homebrew
brew install ffmpeg
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg
```

#### Linux (CentOS/RHEL)

```bash
sudo yum install ffmpeg
# hoặc
sudo dnf install ffmpeg
```

### Kiểm tra cài đặt FFmpeg

```bash
ffmpeg -version
```

## 🚀 Cài đặt và sử dụng

### Cách 1: Sử dụng trực tiếp với npx (Khuyến nghị)

```bash
npx @minhchi1509/ytdl
```

### Cách 2: Cài đặt global

```bash
# Cài đặt
npm install -g @minhchi1509/ytdl

# Sử dụng
@minhchi1509/ytdl
```

## 🎮 Hướng dẫn sử dụng

1. **Chạy lệnh CLI:**

   ```bash
   npx @minhchi1509/ytdl
   ```

2. **Công cụ sẽ tự động kiểm tra FFmpeg:**

   - ✅ Nếu đã cài đặt: Tiếp tục
   - ❌ Nếu chưa cài: Hiển thị hướng dẫn và dừng

3. **Nhập URL YouTube:**

   ```
   Nhập URL video YouTube cần tải: https://www.youtube.com/watch?v=...
   ```

   Hỗ trợ các định dạng:

   - Video thường: `https://youtube.com/watch?v=VIDEO_ID`
   - YouTube Shorts: `https://youtube.com/shorts/VIDEO_ID`

4. **Chọn chất lượng video:**

   ```
   ? Chọn chất lượng video:
   ❯ 1080p (Video: 15.2MB, Audio: 2.1MB)
     720p (Video: 8.7MB, Audio: 2.1MB)
     480p (Video: 4.3MB, Audio: 2.1MB)
   ```

5. **Chọn thư mục lưu:**

   - Nếu có thư mục Downloads: Hỏi có dùng mặc định không
   - Nếu không có: Yêu cầu nhập đường dẫn tùy chỉnh

6. **Chờ tải hoàn thành:**
   ```
   🔍 Đang lấy thông tin video...
   ✅ Đã chọn chất lượng: 1080p
   📁 Video sẽ được lưu tại: C:\Users\...\Downloads\video_ABC123.mp4
   📥 Bắt đầu tải video và audio...
   ✅ Tải file thành công
   🎬 Đang hợp nhất video và audio...
   ✅ Hợp nhất video + audio thành công
   🎉 Tải video thành công! File đã được lưu tại: ...
   ```

## 📝 Ví dụ sử dụng

```bash
# Tải một video YouTube
npx @minhchi1509/ytdl
# Nhập: https://www.youtube.com/watch?v=dQw4w9WgXcQ

# Tải một YouTube Short
npx @minhchi1509/ytdl
# Nhập: https://www.youtube.com/shorts/abc123xyz
```

## 🛠️ Development

### Clone và cài đặt dependencies

```bash
git clone <repository-url>
cd youtube_video_download_cli
bun install
```

### Build project

```bash
bun run build
```

### Chạy trong môi trường development

```bash
bun run src/main.ts
```

## 📦 Cấu trúc thư mục

```
youtube_video_download_cli/
├── src/
│   ├── main.ts          # Entry point chính
│   └── utils.ts         # Các utility functions
├── package.json
├── tsconfig.json
├── esbuild.config.ts
└── README.md
```

## 🔧 Cách hoạt động

1. **Kiểm tra FFmpeg** - Đảm bảo FFmpeg đã được cài đặt
2. **Xác thực URL** - Kiểm tra URL YouTube hợp lệ
3. **Lấy metadata** - Gọi API để lấy thông tin video và các định dạng available
4. **Chọn chất lượng** - Người dùng chọn chất lượng mong muốn
5. **Tải files** - Tải song song video và audio streams
6. **Hợp nhất** - Sử dụng FFmpeg để hợp nhất video + audio
7. **Dọn dẹp** - Xóa các file tạm

## ⚠️ Lưu ý quan trọng

- **FFmpeg là bắt buộc** - Công cụ sẽ không hoạt động nếu thiếu FFmpeg
- **Tuân thủ bản quyền** - Chỉ tải video bạn có quyền hoặc để sử dụng cá nhân
- **Kết nối internet** - Cần internet ổn định để tải video
- **Dung lượng đĩa** - Đảm bảo có đủ không gian lưu trữ

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng:

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📄 License

Dự án này được phân phối dưới giấy phép MIT. Xem file `LICENSE` để biết thêm thông tin.

## 👨‍💻 Tác giả

**Minh Chi** - [@minhchi1509](https://github.com/minhchi1509)

## 🙏 Acknowledgments

- [FFmpeg](https://ffmpeg.org/) - Công cụ xử lý multimedia mạnh mẽ
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) - Interactive command line interface
- [Axios](https://axios-http.com/) - HTTP client cho Node.js

---

⭐ **Nếu thấy hữu ích, hãy để lại một star nhé!** ⭐
