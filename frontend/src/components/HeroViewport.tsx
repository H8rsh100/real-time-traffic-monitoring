import React, { useRef, useEffect } from 'react';
import type { Telemetry, Track } from '../types';

interface HeroViewportProps {
  currentBitmap: ImageBitmap | null;
  telemetry: Telemetry | null;
  isStreaming: boolean;
  selectedModel: string;
}

export const HeroViewport: React.FC<HeroViewportProps> = ({
  currentBitmap,
  telemetry,
  isStreaming,
  selectedModel,
}) => {
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gateFlashTimeRef = useRef<number>(0);

  // 1. Draw raw video frame to Canvas Layer 1
  useEffect(() => {
    const canvas = videoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (currentBitmap) {
      if (canvas.width !== currentBitmap.width || canvas.height !== currentBitmap.height) {
        canvas.width = currentBitmap.width;
        canvas.height = currentBitmap.height;
      }
      ctx.drawImage(currentBitmap, 0, 0);
    }
  }, [currentBitmap]);

  // 2. Draw Vector Overlay onto Canvas Layer 2
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!telemetry || !isStreaming) return;

    // A. Draw Counting Gate
    const gateY = telemetry.gate ? telemetry.gate.y_ratio * h : 0.55 * h;
    const isGateActive = telemetry.gate?.active;

    if (isGateActive) {
      gateFlashTimeRef.current = Date.now();
    }
    const isFlashing = Date.now() - gateFlashTimeRef.current < 250;

    ctx.save();
    ctx.lineWidth = isFlashing ? 2 : 1;
    ctx.strokeStyle = isFlashing ? '#FF5A1F' : 'rgba(255, 90, 31, 0.6)';
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, gateY);
    ctx.lineTo(w, gateY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Gate tag
    ctx.fillStyle = isFlashing ? '#FF5A1F' : 'rgba(15, 17, 22, 0.85)';
    ctx.strokeStyle = isFlashing ? '#FF5A1F' : 'rgba(255, 90, 31, 0.5)';
    ctx.lineWidth = 1;
    const gateLabel = 'GATE LINE [▲ IN / ▼ OUT]';
    ctx.font = '10px monospace';
    const textWidth = ctx.measureText(gateLabel).width;
    ctx.fillRect(w / 2 - textWidth / 2 - 8, gateY - 14, textWidth + 16, 15);
    ctx.strokeRect(w / 2 - textWidth / 2 - 8, gateY - 14, textWidth + 16, 15);

    ctx.fillStyle = isFlashing ? '#0A0B0D' : '#FF5A1F';
    ctx.fillText(gateLabel, w / 2 - textWidth / 2, gateY - 3);
    ctx.restore();

    // B. Draw Trajectory Motion Trails
    telemetry.tracks.forEach((track: Track) => {
      if (track.trail && track.trail.length > 1) {
        ctx.save();
        for (let i = 1; i < track.trail.length; i++) {
          const p1 = track.trail[i - 1];
          const p2 = track.trail[i];
          const alpha = (i / track.trail.length) * 0.75;
          ctx.strokeStyle = `rgba(255, 160, 50, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    // C. Draw Bounding Boxes with Hairline & Corner Accents
    telemetry.tracks.forEach((track: Track) => {
      const [x1, y1, x2, y2] = track.bbox;
      const bw = x2 - x1;
      const bh = y2 - y1;

      // Desaturated colors based on category
      const color =
        track.category === 'Pedestrian'
          ? '#8EA695' // Desaturated Muted Sage
          : track.category === 'Cyclist'
          ? '#B5A078' // Desaturated Brass
          : '#8E9DAE'; // Desaturated Slate Blue

      const glyph =
        track.category === 'Pedestrian'
          ? '● PED'
          : track.category === 'Cyclist'
          ? '◆ CYC'
          : '▲ VEH';

      ctx.save();
      // Thin 1px box
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, y1, bw, bh);

      // Corner accents (tactical tick corners)
      const cl = Math.min(6, bw / 4, bh / 4);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x1, y1 + cl);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + cl, y1);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x2, y2 - cl);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - cl, y2);
      ctx.stroke();

      // Top Tag Badge
      const badgeText = `#${track.id} ${glyph} ${(track.conf * 100).toFixed(0)}%`;
      ctx.font = '9px monospace';
      const tw = ctx.measureText(badgeText).width;
      const badgeH = 13;
      const badgeY = Math.max(0, y1 - badgeH);

      ctx.fillStyle = 'rgba(10, 11, 13, 0.9)';
      ctx.fillRect(x1, badgeY, tw + 8, badgeH);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, badgeY, tw + 8, badgeH);

      ctx.fillStyle = color;
      ctx.fillText(badgeText, x1 + 4, badgeY + 9);

      ctx.restore();
    });

    // D. Corner Brackets for Viewport (Framing)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    const cornerSize = 16;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(10, 10 + cornerSize);
    ctx.lineTo(10, 10);
    ctx.lineTo(10 + cornerSize, 10);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(w - 10 - cornerSize, 10);
    ctx.lineTo(w - 10, 10);
    ctx.lineTo(w - 10, 10 + cornerSize);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(10, h - 10 - cornerSize);
    ctx.lineTo(10, h - 10);
    ctx.lineTo(10 + cornerSize, h - 10);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(w - 10 - cornerSize, h - 10);
    ctx.lineTo(w - 10, h - 10);
    ctx.lineTo(w - 10, h - 10 - cornerSize);
    ctx.stroke();

    // Edge Ticks along top edge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 60; x < w - 60; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, 15);
      ctx.stroke();
    }
    ctx.restore();
  }, [telemetry, isStreaming]);

  const modelTag = selectedModel.replace('.pt', '').toUpperCase();

  return (
    <div className="relative w-full aspect-[16/9] bg-[#0A0B0D] border border-[rgba(255,255,255,0.08)] overflow-hidden flex items-center justify-center select-none">
      {/* 1. Video Buffer Layer */}
      <canvas
        ref={videoCanvasRef}
        width={768}
        height={432}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />

      {/* 2. Vector Graphics Overlay Layer */}
      <canvas
        ref={overlayCanvasRef}
        width={768}
        height={432}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
      />

      {/* 3. Empty State: Tactical NO SIGNAL */}
      {!isStreaming && !currentBitmap && (
        <div className="absolute inset-0 scanlines no-signal-static flex flex-col items-center justify-center space-y-3 z-0">
          <div className="w-16 h-16 border border-neutral-700/60 flex items-center justify-center relative">
            <div className="w-8 h-8 border border-neutral-600/40 rotate-45" />
            <div className="w-1.5 h-1.5 bg-[#FF5A1F]" />
          </div>
          <div className="text-center font-mono-numbers space-y-1">
            <div className="text-xs tracking-[0.2em] font-semibold text-neutral-300">
              NO ACTIVE SIGNAL
            </div>
            <div className="text-[10px] tracking-wider text-neutral-400">
              CONNECT FEED VIA LEFT CONTROL RAIL [▶ START STREAM]
            </div>
          </div>
        </div>
      )}

      {/* 4. Lower-Third Telemetry HUD Strip */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono-numbers tracking-widest text-neutral-400 bg-[#0A0B0D]/85 px-3 py-1 border border-[rgba(255,255,255,0.08)] z-20">
        <div className="flex items-center space-x-3">
          <span className="text-[#FF5A1F] font-semibold">{modelTag}</span>
          <span className="text-neutral-500">|</span>
          <span>768x432 12.0 FPS</span>
          <span className="text-neutral-500">|</span>
          <span>BYTETrack Kalman MOT</span>
        </div>

        <div className="flex items-center space-x-3">
          <span>ACTIVE TRACKS: {telemetry?.tracks?.length ?? 0}</span>
          <span className="text-neutral-500">|</span>
          <span>GATE POS: {telemetry?.gate ? `${(telemetry.gate.y_ratio * 100).toFixed(0)}%` : '55%'}</span>
        </div>
      </div>
    </div>
  );
};
