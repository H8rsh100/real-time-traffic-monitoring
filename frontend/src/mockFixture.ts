import type { Telemetry, Track, CrossingEvent } from './types';

export function createMockFrame(frameIdx: number, totalFrames: number = 300): Telemetry {
  const t = frameIdx / 13.0; // 13 FPS
  const w = 960;
  const h = 540;
  const gateY = 0.55 * h;

  // Simulate 3 cars moving down (IN) and 1 car moving up (OUT)
  const tracks: Track[] = [
    {
      id: 1,
      class: 'car',
      category: 'Vehicle',
      conf: 0.88,
      bbox: [
        520 + Math.sin(frameIdx * 0.05) * 5,
        ((frameIdx * 3.5) % (h + 80)) - 40,
        610 + Math.sin(frameIdx * 0.05) * 5,
        ((frameIdx * 3.5) % (h + 80)) + 60,
      ],
      centroid: [565, ((frameIdx * 3.5) % (h + 80)) + 10],
      trail: Array.from({ length: 15 }, (_, i) => [
        565 - Math.sin((frameIdx - i) * 0.05) * 2,
        Math.max(0, ((frameIdx * 3.5) % (h + 80)) + 10 - i * 6),
      ]),
    },
    {
      id: 2,
      class: 'car',
      category: 'Vehicle',
      conf: 0.79,
      bbox: [
        680 + Math.cos(frameIdx * 0.04) * 8,
        ((frameIdx * 4.2 + 100) % (h + 80)) - 40,
        770 + Math.cos(frameIdx * 0.04) * 8,
        ((frameIdx * 4.2 + 100) % (h + 80)) + 65,
      ],
      centroid: [725, ((frameIdx * 4.2 + 100) % (h + 80)) + 12],
      trail: Array.from({ length: 18 }, (_, i) => [
        725 - Math.cos((frameIdx - i) * 0.04) * 4,
        Math.max(0, ((frameIdx * 4.2 + 100) % (h + 80)) + 12 - i * 8),
      ]),
    },
    {
      id: 3,
      class: 'truck',
      category: 'Vehicle',
      conf: 0.82,
      bbox: [
        380,
        ((frameIdx * 2.8 + 220) % (h + 100)) - 50,
        490,
        ((frameIdx * 2.8 + 220) % (h + 100)) + 70,
      ],
      centroid: [435, ((frameIdx * 2.8 + 220) % (h + 100)) + 10],
      trail: Array.from({ length: 12 }, (_, i) => [
        435,
        Math.max(0, ((frameIdx * 2.8 + 220) % (h + 100)) + 10 - i * 5),
      ]),
    },
    {
      id: 4,
      class: 'car',
      category: 'Vehicle',
      conf: 0.91,
      bbox: [
        230,
        h - ((frameIdx * 3.8) % (h + 80)) - 60,
        310,
        h - ((frameIdx * 3.8) % (h + 80)) + 40,
      ],
      centroid: [270, h - ((frameIdx * 3.8) % (h + 80)) - 10],
      trail: Array.from({ length: 16 }, (_, i) => [
        270,
        Math.min(h, h - ((frameIdx * 3.8) % (h + 80)) - 10 + i * 7),
      ]),
    },
  ];

  // Check if any car crossed the gate in this frame
  const events: CrossingEvent[] = [];
  const car1Y = ((frameIdx * 3.5) % (h + 80)) + 10;
  if (Math.abs(car1Y - gateY) < 3) {
    events.push({
      frame_idx: frameIdx,
      timestamp_sec: t,
      track_id: 1,
      class: 'car',
      category: 'Vehicle',
      conf: 0.88,
      direction: 'IN',
      centroid: [565, Math.round(gateY)],
      bbox: [520, Math.round(gateY - 40), 610, Math.round(gateY + 60)],
    });
  }

  const inVehicles = Math.min(24, Math.floor(frameIdx / 18));
  const outVehicles = Math.min(8, Math.floor(frameIdx / 45));

  return {
    frame_idx: frameIdx,
    total_frames: totalFrames,
    timestamp_sec: Number(t.toFixed(2)),
    fps: 13.05 + Math.sin(frameIdx * 0.1) * 0.3,
    latency_ms: 68.2 + Math.cos(frameIdx * 0.1) * 2.5,
    timing: {
      preprocess_ms: 2.1,
      inference_ms: 64.5,
      postprocess_ms: 1.6,
      total_ms: 68.2,
    },
    counts: {
      total: inVehicles + outVehicles,
      in: inVehicles,
      out: outVehicles,
      vehicle: inVehicles + outVehicles,
      pedestrian: 0,
      cyclist: 0,
    },
    gate: {
      y_ratio: 0.55,
      y_px: Math.round(gateY),
      active: events.length > 0,
    },
    roi: [
      [Math.round(0.1 * w), Math.round(0.35 * h)],
      [Math.round(0.9 * w), Math.round(0.35 * h)],
      [Math.round(0.9 * w), Math.round(0.85 * h)],
      [Math.round(0.1 * w), Math.round(0.85 * h)],
    ],
    tracks,
    events,
  };
}

// Draw a synthetic midnight road bitmap for mock mode
export async function createMockBitmap(w: number = 960, h: number = 540): Promise<ImageBitmap> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  // Dark midnight asphalt gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#040508');
  grad.addColorStop(0.4, '#0A0C12');
  grad.addColorStop(1, '#080A0F');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Road lanes
  ctx.strokeStyle = 'rgba(236, 232, 246, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([16, 20]);
  [0.33 * w, 0.5 * w, 0.67 * w].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Curbs
  ctx.strokeStyle = 'rgba(236, 232, 246, 0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0.15 * w, 0);
  ctx.lineTo(0.15 * w, h);
  ctx.moveTo(0.85 * w, 0);
  ctx.lineTo(0.85 * w, h);
  ctx.stroke();

  return await createImageBitmap(canvas);
}
