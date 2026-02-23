
export enum AppView {
  DASHBOARD = 'dashboard',
  CHARACTERS = 'characters',
  STUDIO = 'studio'
}

export type ArtStyle = 'Cinematic' | 'Anime/Manga' | 'Ghibli Style' | 'Edo Period Fusion' | '3D Render/UE5' | 'MV Ca Nhạc/Vibrant' | 'Cyberpunk' | 'Hoạt hình Disney' | 'Tranh sơn dầu' | 'Realistic Photo';

export interface Character {
  id: string;
  name: string;
  age: string;
  gender: string;
  appearance: {
    face: string;
    hair: string;
    body: string;
    lockedKeywords: string;
  };
  style: string;
  outfit: string;
  personality: string;
  token: string;
  imageUrl?: string;
}

export interface Scene {
  id: string;
  order: number;
  description: string;
  cameraAngle: string;
  lighting: string;
  characters: string[];
  generatedPrompt: string;
  durationSeconds?: number;
  previewImageUrl?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  characters: Character[];
  scenes: Scene[];
  fullScript: string;
  updatedAt: number;
  targetScenesCount?: number;
  globalStyle?: ArtStyle;
  globalBackground?: string;
  isDetailed?: boolean;
  durationMinutes?: number;
  durationSeconds?: number;
}
