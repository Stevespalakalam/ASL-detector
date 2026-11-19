
export enum Page {
    Library = '/library',
    Translate = '/translate',
    Sign = '/sign'
}

export interface Take {
  id: string;
  signId: string;
  videoUrl: string; // Data URL of the recorded video
  createdAt: string;
}

export interface Sign {
  id: string;
  label: string;
  createdAt: string;
  takes: Take[];
  confidence: number;
}

export interface AppData {
    signs: Sign[];
    settings: {
        confidenceThreshold: number;
        minSamples: number;
    }
}
