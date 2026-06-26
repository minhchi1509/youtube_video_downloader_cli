export interface IMergeAudioToVideoOptions {
  tempVideoPath: string;
  tempAudioPath: string;
  outputPath: string;

  onStart?: () => void;
  onProgress?: ({
    currentSeconds,
    durationSeconds,
  }: {
    currentSeconds: number;
    durationSeconds: number;
  }) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}
