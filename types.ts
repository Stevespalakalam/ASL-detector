
export enum Page {
  Library = '/library',
  Translate = '/translate',
  Sign = '/sign',
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface Take {
  id: string;
  signId: string;
  videoUrl: string; // Data URL or Blob URL of the recorded video
  createdAt: string;
  landmarks?: Landmark[]; // 21 3D hand landmarks captured during recording
}

export interface Sign {
  id: string;
  label: string;
  createdAt: string;
  takes: Take[];
  confidence: number;
  templateLandmarks?: Landmark[]; // Centroid / representative 21 landmarks computed from takes
}

export interface AppData {
  signs: Sign[];
  settings: {
    confidenceThreshold: number;
    minSamples: number;
  };
}

export interface MatchResult {
  label: string | null;
  confidence: number;
  similarities?: { label: string; confidence: number }[];
}
