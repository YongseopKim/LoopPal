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
  // Runtime-only derived value; do not persist in stored session data.
  resolvedSpeed?: number;
};
