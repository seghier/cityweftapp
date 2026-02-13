

export type GeometryType = 'buildings' | 'surface' | 'barriers' | 'infrastructure' | 'topography';

// Added 'rhino' to the supported export formats to resolve type mismatch in ControlPanel
export type ExportFormat = 'skp' | '3dm' | 'obj' | 'glb' | 'dxf' | 'stl' | 'dae' | 'rhino';

export interface AppSettings {
  geometry: GeometryType[];
  crs: 'local' | 'world';
  cropScene: boolean;
  disableSurfaceProjection: boolean;
  topographyModel: boolean;
  topographyReturnType: 'elevationMap' | null;
  defaultRoofType: string;
}

export interface ExportConfig {
  format: ExportFormat;
  version: number | null;
}

export interface CityweftPayload {
  polygon: [number, number][];
  settings: AppSettings;
  export: ExportConfig;
  requestId: string;
  timestamp: number;
}

export interface ApiResponse {
  downloadUrl: string;
  message?: string;
  error?: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PREPARING = 'PREPARING',
  REQUESTING = 'REQUESTING',
  PROCESSING = 'PROCESSING',
  DOWNLOADING = 'DOWNLOADING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}