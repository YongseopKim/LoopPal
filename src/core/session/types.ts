export type PracticeSection = {
  id: string;
  name: string;
  memo: string;
  startTimeSec: number;
  endTimeSec: number;
  speedOverride: number | null;
  order: number;
  updatedAt: number;
};

export type VideoPracticeSession = {
  videoId: string;
  defaultSpeed: number;
  loopEnabled: boolean;
  selectedSectionId: string | null;
  activeSectionId: string | null;
  sections: PracticeSection[];
  resolvedSpeed?: number;
};
