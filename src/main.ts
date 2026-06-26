import { youtubeDownloadPromptHandler } from "src/ioc";

const main = async () => {
  try {
    await youtubeDownloadPromptHandler.startMainProcess();
  } catch (error) {
    console.error(`❌ Lỗi: ${(error as Error).message}`);
  }
};

main();
