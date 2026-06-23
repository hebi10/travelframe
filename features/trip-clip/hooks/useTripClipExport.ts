export type ExportFormat = "mp4" | "images";

export type ExportProgress = {
  visible: boolean;
  percent: number;
  title: string;
  detail: string;
  completedVideoId?: string;
  error?: string;
};

export type SaveSelectedExportOptions = {
  returnToVideoWorks?: boolean;
};

export const initialExportProgress: ExportProgress = {
  visible: false,
  percent: 0,
  title: "",
  detail: ""
};
