export type Direction = 'IN' | 'OUT';

export interface Track {
  id: number;
  class: string;
  category: 'Vehicle' | 'Pedestrian' | 'Cyclist' | string;
  conf: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  centroid: [number, number];            // [cx, cy]
  trail: [number, number][];             // recent centroid history
}

export interface CrossingEvent {
  frame_idx: number;
  timestamp_sec: number;
  track_id: number;
  class: string;
  category: string;
  conf: number;
  direction: Direction;
  centroid: [number, number];
  bbox: [number, number, number, number];
}

export interface TimingBreakdown {
  preprocess_ms: number;
  inference_ms: number;
  postprocess_ms: number;
  total_ms: number;
}

export interface CategoryCounts {
  total: number;
  in: number;
  out: number;
  vehicle: number;
  pedestrian: number;
  cyclist: number;
}

export interface GateState {
  y_ratio: number;
  y_px: number;
  active: boolean;
}

export interface Telemetry {
  frame_idx: number;
  total_frames: number;
  timestamp_sec: number;
  fps: number;
  latency_ms: number;
  timing: TimingBreakdown;
  counts: CategoryCounts;
  gate: GateState;
  roi: [number, number][];
  tracks: Track[];
  events: CrossingEvent[];
  stream_complete?: boolean;
}

export interface SessionFrame {
  frame_idx: number;
  timestamp_sec: number;
  imageBitmap?: ImageBitmap;
  telemetry: Telemetry;
}

export interface BenchmarkModel {
  model_name: string;
  weights_file: string;
  model_size_mb: number;
  parameters_m: number;
  mean_preprocess_ms: number;
  mean_inference_ms: number;
  mean_postprocess_ms: number;
  mean_total_latency_ms: number;
  throughput_fps: number;
}
