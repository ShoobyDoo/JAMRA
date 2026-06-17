export interface ReaderChapter {
  id: string;
  number?: string;
  title?: string;
  pages: ReaderPage[];
  isDownloaded: boolean;
  nextChapterId?: string;
  previousChapterId?: string;
  chapters: ReaderChapterSummary[];
}

export interface ReaderPage {
  number: number;
  url: string;
  width?: number;
  height?: number;
}

export interface DownloadedPageSource {
  type: "downloaded";
  pageNumber: number;
  filePath: string;
  downloadId: string;
}

export interface RemotePageSource {
  type: "remote";
  pageNumber: number;
  url: string;
  headers?: Record<string, string>;
  width?: number;
  height?: number;
}

export type ReaderPageSource = DownloadedPageSource | RemotePageSource;

export interface ReaderChapterSummary {
  id: string;
  number?: string;
  title?: string;
}
