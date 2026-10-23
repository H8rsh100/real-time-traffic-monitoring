import React, { useRef, useEffect, useState } from 'react';
import type { Telemetry, Track, RenderMode, ExposureDecay, LensFlare } from '../types';

interface HeroViewportProps {
  currentTelemetryRef: React.MutableRefObject<Telemetry | null>;
  prevTelemetryRef: React.MutableRefObject<Telemetry | null>;
  currentBitmapRef: React.MutableRefObject<ImageBitmap | null>;
  prevBitmapRef: React.MutableRefObject<ImageBitmap | null>;
  packetTimestampsRef: React.MutableRefObject<{ prev: number; curr: number }>;
  isStreaming: boolean;
  isPaused: boolean;
  selectedModel: string;
  renderMode: RenderMode;
  exposureDecay: ExposureDecay;
  isExposureEnabled: boolean;
}

export const HeroViewport: React.FC<HeroViewportProps> = ({
  currentTelemetryRef,
  prevTelemetryRef,
  currentBitmapRef,
  prevBitmapRef,
  packetTimestampsRef,
  isStreaming,
  isPaused,
  selectedModel,
  renderMode,
  exposureDecay,
  isExposureEnabled,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exposureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Offscreen accumulation buffer for half-res long exposure pass
  const offscreenExposureRef = useRef<HTMLCanvasElement | null>(null);

  // Active anamorphic lens flares
  const lensFlaresRef = useRef<LensFlare[]>([]);
  const lastProcessedEventIdxRef = useRef<number>(-1);
  const gateFlashTimeRef = useRef<number>(0);
  const [shutterSpeed, setShutterSpeed] = useState<string>('1/13');
  const [exposureTimecode, setExposureTimecode] = useState<string>('00:00.0s');

  // Decay factor map
  const decayAlpha = exposureDecay === 'short' ? 0.09 : exposureDecay === 'long' ? 0.016 : 0.04;

  useEffect(() => {
    // Initialize offscreen buffer for accumulation
    if (!offscreenExposureRef.current) {
      const oc = document.createElement('canvas');
      oc.width = 480;
      oc.height = 270;
      offscreenExposureRef.current = oc;
    }
  }, []);

  // Main 60Hz RequestAnimationFrame Viewport Render Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const now = performance.now();
      const videoCanvas = videoCanvasRef.current;
      const exposureCanvas = exposureCanvasRef.current;
      const hudCanvas = hudCanvasRef.current;
      const offscreen = offscreenExposureRef.current;

      if (!videoCanvas || !exposureCanvas || !hudCanvas || !offscreen) {
        animId = requestAnimationFrame(render);
        return;
      }

      const vCtx = videoCanvas.getContext('2d');
      const eCtx = exposureCanvas.getContext('2d');
      const hCtx = hudCanvas.getContext('2d');
      const oCtx = offscreen.getContext('2d');

      if (!vCtx || !eCtx || !hCtx || !oCtx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const w = videoCanvas.width;
      const h = videoCanvas.height;
      const curTelem = currentTelemetryRef.current;
      const prevTelem = prevTelemetryRef.current;
      const curBmp = currentBitmapRef.current;
      const prevBmp = prevBitmapRef.current;

      // ─────────────────────────────────────────────────────────────
      // 1. LAYER 1: VIDEO CANVAS (With optional crossfade in Smooth Mode)
      // ─────────────────────────────────────────────────────────────
      if (curBmp) {
        if (renderMode === 'smooth' && prevBmp && !isPaused) {
          const dt = Math.max(1, packetTimestampsRef.current.curr - packetTimestampsRef.current.prev);
          const alpha = Math.min(1, Math.max(0, (now - packetTimestampsRef.current.curr) / dt));

          vCtx.globalAlpha = 1.0;
          vCtx.drawImage(prevBmp, 0, 0, w, h);
          vCtx.globalAlpha = alpha;
          vCtx.drawImage(curBmp, 0, 0, w, h);
          vCtx.globalAlpha = 1.0;
        } else {
          vCtx.globalAlpha = 1.0;
          vCtx.drawImage(curBmp, 0, 0, w, h);
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 2. LAYER 2: EXPOSURE ACCUMULATION BUFFER (Long Exposure Glow)
      // ─────────────────────────────────────────────────────────────
      if (isExposureEnabled && curTelem && isStreaming && !isPaused) {
        const ow = offscreen.width;
        const oh = offscreen.height;
        const scaleX = ow / w;
        const scaleY = oh / h;

        // A. Decay pass: fade older light trails
        oCtx.globalCompositeOperation = 'destination-out';
        oCtx.fillStyle = `rgba(0, 0, 0, ${decayAlpha})`;
        oCtx.fillRect(0, 0, ow, oh);

        // B. Additive accumulation pass: light accumulates
        oCtx.globalCompositeOperation = 'lighter';

        curTelem.tracks.forEach((track: Track) => {
          // Color based on class and direction
          let color = '#FFF1CC'; // Inbound headlight gold
          if (track.category === 'Pedestrian') color = '#4FD1FF';
          else if (track.category === 'Cyclist') color = '#B6FF4F';
          else if (track.bbox[3] - track.bbox[1] > 0 && curTelem.counts.out > 0) {
            // Outbound detection check
            color = '#FF3B30';
          }

          const cx = track.centroid[0] * scaleX;
          const cy = track.centroid[1] * scaleY;

          oCtx.save();
          oCtx.fillStyle = color;
          oCtx.shadowColor = color;
          oCtx.shadowBlur = 10;
          oCtx.beginPath();
          oCtx.arc(cx, cy, 3.2, 0, Math.PI * 2);
          oCtx.fill();
          oCtx.restore();
        });

        // C. Blit offscreen buffer to exposure canvas with soft bloom
        eCtx.clearRect(0, 0, w, h);
        eCtx.save();
        eCtx.globalAlpha = 0.95;
        eCtx.drawImage(offscreen, 0, 0, w, h);
        eCtx.restore();
      } else if (!isExposureEnabled) {
        eCtx.clearRect(0, 0, w, h);
      }

      // ─────────────────────────────────────────────────────────────
      // 3. LAYER 3: HUD VECTOR OVERLAY CANVAS (1px hairline & flares)
      // ─────────────────────────────────────────────────────────────
      hCtx.clearRect(0, 0, w, h);

      if (curTelem && isStreaming) {
        // Shutter & Exposure derived readouts
        if (curTelem.fps > 0) {
          setShutterSpeed(`1/${Math.round(curTelem.fps)}s`);
        }
        setExposureTimecode(`${curTelem.timestamp_sec.toFixed(1)}s`);

        // Check for new crossing events to trigger flares
        if (curTelem.events && curTelem.events.length > 0) {
          curTelem.events.forEach((ev) => {
            if (ev.frame_idx > lastProcessedEventIdxRef.current) {
              lastProcessedEventIdxRef.current = ev.frame_idx;
              gateFlashTimeRef.current = now;
              lensFlaresRef.current.push({
                id: `${ev.frame_idx}_${ev.track_id}`,
                x: ev.centroid[0],
                y: ev.centroid[1],
                color: ev.direction === 'IN' ? '#FFF1CC' : '#FF3B30',
                direction: ev.direction,
                createdAt: now,
              });
            }
          });
        }

        // A. Tripwire Gate Light Beam with Violet Bloom & Flow Chevrons
        const gateY = curTelem.gate ? curTelem.gate.y_ratio * h : 0.55 * h;
        const isFlashing = now - gateFlashTimeRef.current < 280;

        hCtx.save();
        // Violet ambient bloom behind gate beam
        hCtx.strokeStyle = isFlashing ? 'rgba(255, 255, 255, 0.95)' : 'rgba(127, 90, 240, 0.45)';
        hCtx.lineWidth = isFlashing ? 3 : 1.5;
        hCtx.shadowColor = '#7F5AF0';
        hCtx.shadowBlur = isFlashing ? 16 : 8;
        hCtx.beginPath();
        hCtx.moveTo(0, gateY);
        hCtx.lineTo(w, gateY);
        hCtx.stroke();
        hCtx.shadowBlur = 0;

        // Flow Chevrons along gate line
        const chevronOffset = (now * 0.04) % 40;
        hCtx.strokeStyle = 'rgba(236, 232, 246, 0.35)';
        hCtx.lineWidth = 1;
        for (let x = chevronOffset; x < w; x += 40) {
          hCtx.beginPath();
          hCtx.moveTo(x - 4, gateY - 3);
          hCtx.lineTo(x, gateY);
          hCtx.lineTo(x - 4, gateY + 3);
          hCtx.stroke();
        }

        // Gate Badge Tag
        const gateLabel = isFlashing ? 'GATE TRIGGER // RECORDED' : 'GATE // TRIPWIRE';
        hCtx.font = '9px "Martian Mono", monospace';
        const glWidth = hCtx.measureText(gateLabel).width;
        hCtx.fillStyle = isFlashing ? '#7F5AF0' : 'rgba(12, 14, 22, 0.88)';
        hCtx.fillRect(w / 2 - glWidth / 2 - 8, gateY - 14, glWidth + 16, 14);
        hCtx.strokeStyle = isFlashing ? '#ECE8F6' : 'rgba(236, 232, 246, 0.16)';
        hCtx.strokeRect(w / 2 - glWidth / 2 - 8, gateY - 14, glWidth + 16, 14);
        hCtx.fillStyle = isFlashing ? '#FFFFFF' : '#ECE8F6';
        hCtx.fillText(gateLabel, w / 2 - glWidth / 2, gateY - 4);
        hCtx.restore();

        // B. Anamorphic Horizontal Lens Flares on Crossing
        lensFlaresRef.current = lensFlaresRef.current.filter((flare) => now - flare.createdAt < 450);
        lensFlaresRef.current.forEach((flare) => {
          const progress = (now - flare.createdAt) / 450;
          const alpha = (1 - progress) * 0.95;
          const flareWidth = 140 + progress * 260;

          hCtx.save();
          hCtx.globalCompositeOperation = 'lighter';
          hCtx.shadowColor = flare.color;
          hCtx.shadowBlur = 14;

          // Horizontal anamorphic beam
          const grad = hCtx.createLinearGradient(flare.x - flareWidth / 2, flare.y, flare.x + flareWidth / 2, flare.y);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(0.3, flare.color);
          grad.addColorStop(0.5, '#FFFFFF');
          grad.addColorStop(0.7, flare.color);
          grad.addColorStop(1, 'transparent');

          hCtx.strokeStyle = grad;
          hCtx.globalAlpha = alpha;
          hCtx.lineWidth = 2.5;
          hCtx.beginPath();
          hCtx.moveTo(flare.x - flareWidth / 2, flare.y);
          hCtx.lineTo(flare.x + flareWidth / 2, flare.y);
          hCtx.stroke();
          hCtx.restore();
        });

        // C. Bounding Boxes with Tactical Corner Notches & Class Glyphs
        curTelem.tracks.forEach((track: Track) => {
          let [x1, y1, x2, y2] = track.bbox;

          // Smooth mode interpolation between prev and current packet
          if (renderMode === 'smooth' && prevTelem && !isPaused) {
            const prevTrack = prevTelem.tracks.find((t) => t.id === track.id);
            if (prevTrack) {
              const dt = Math.max(1, packetTimestampsRef.current.curr - packetTimestampsRef.current.prev);
              const factor = Math.min(1, Math.max(0, (now - packetTimestampsRef.current.curr) / dt));
              x1 = (1 - factor) * prevTrack.bbox[0] + factor * x1;
              y1 = (1 - factor) * prevTrack.bbox[1] + factor * y1;
              x2 = (1 - factor) * prevTrack.bbox[2] + factor * x2;
              y2 = (1 - factor) * prevTrack.bbox[3] + factor * y2;
            }
          }

          const bw = x2 - x1;
          const bh = y2 - y1;

          // Color tokens
          const color =
            track.category === 'Pedestrian'
              ? '#4FD1FF'
              : track.category === 'Cyclist'
              ? '#B6FF4F'
              : '#FFB347';

          const glyph =
            track.category === 'Pedestrian'
              ? '● PED'
              : track.category === 'Cyclist'
              ? '◆ CYC'
              : '▲ VEH';

          hCtx.save();
          // 1px hairline box
          hCtx.strokeStyle = color;
          hCtx.lineWidth = 1;
          hCtx.strokeRect(x1, y1, bw, bh);

          // Corner notches (tactical viewfinder brackets)
          const cornerLen = Math.min(8, bw / 3, bh / 3);
          hCtx.strokeStyle = '#ECE8F6';
          hCtx.lineWidth = 1.5;

          // Top-Left
          hCtx.beginPath();
          hCtx.moveTo(x1, y1 + cornerLen);
          hCtx.lineTo(x1, y1);
          hCtx.lineTo(x1 + cornerLen, y1);
          hCtx.stroke();

          // Bottom-Right
          hCtx.beginPath();
          hCtx.moveTo(x2, y2 - cornerLen);
          hCtx.lineTo(x2, y2);
          hCtx.lineTo(x2 - cornerLen, y2);
          hCtx.stroke();

          // Top Badge Tag: #ID + GLYPH + CONF
          const badgeText = `#${track.id} ${glyph} ${(track.conf * 100).toFixed(0)}%`;
          hCtx.font = '9px "Martian Mono", monospace';
          const tw = hCtx.measureText(badgeText).width;
          const bhTag = 13;
          const byTag = Math.max(0, y1 - bhTag);

          hCtx.fillStyle = 'rgba(12, 14, 22, 0.92)';
          hCtx.fillRect(x1, byTag, tw + 8, bhTag);
          hCtx.strokeStyle = color;
          hCtx.lineWidth = 1;
          hCtx.strokeRect(x1, byTag, tw + 8, bhTag);

          hCtx.fillStyle = color;
          hCtx.fillText(badgeText, x1 + 4, byTag + 9.5);

          hCtx.restore();
        });

        // D. Viewfinder Corner Framing Brackets ┌ ┐ └ ┘
        hCtx.save();
        hCtx.strokeStyle = 'rgba(236, 232, 246, 0.4)';
        hCtx.lineWidth = 1.5;
        const cb = 16;
        // TL
        hCtx.beginPath();
        hCtx.moveTo(12, 12 + cb);
        hCtx.lineTo(12, 12);
        hCtx.lineTo(12 + cb, 12);
        hCtx.stroke();
        // TR
        hCtx.beginPath();
        hCtx.moveTo(w - 12 - cb, 12);
        hCtx.lineTo(w - 12, 12);
        hCtx.lineTo(w - 12, 12 + cb);
        hCtx.stroke();
        // BL
        hCtx.beginPath();
        hCtx.moveTo(12, h - 12 - cb);
        hCtx.lineTo(12, h - 12);
        hCtx.lineTo(12 + cb, h - 12);
        hCtx.stroke();
        // BR
        hCtx.beginPath();
        hCtx.moveTo(w - 12 - cb, h - 12);
        hCtx.lineTo(w - 12, h - 12);
        hCtx.lineTo(w - 12, h - 12 - cb);
        hCtx.stroke();

        hCtx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isStreaming, isPaused, renderMode, isExposureEnabled, decayAlpha]);

  const modelTag = selectedModel.replace('.pt', '').toUpperCase();

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[16/9] bg-[#05060A] border border-[rgba(236,232,246,0.09)] overflow-hidden flex items-center justify-center select-none"
    >
      {/* LAYER 1: Raw Video Frame Buffer */}
      <canvas
        ref={videoCanvasRef}
        width={960}
        height={540}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0"
      />

      {/* LAYER 2: Long Exposure Accumulation Layer */}
      <canvas
        ref={exposureCanvasRef}
        width={960}
        height={540}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
      />

      {/* LAYER 3: Vector HUD & Optical Flares */}
      <canvas
        ref={hudCanvasRef}
        width={960}
        height={540}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
      />

      {/* Viewfinder Top Status Overlay: Camera Metadata */}
      {isStreaming && (
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-30 font-mono-data text-[10px] tracking-wider text-[#8A90A6]">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1.5 text-[#ECE8F6]">
              <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-breathe" />
              <span className="font-semibold text-xs tracking-widest text-[#FF3B30]">REC</span>
            </span>
            <span className="text-[#8A90A6]/40">|</span>
            <span>SHUTTER {shutterSpeed}</span>
            <span className="text-[#8A90A6]/40">|</span>
            <span className={isExposureEnabled ? 'text-[#FFF1CC]' : 'text-[#8A90A6]'}>
              EXPOSURE {isExposureEnabled ? exposureTimecode : 'OFF'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="px-1.5 py-0.5 border border-[#7F5AF0]/40 text-[#7F5AF0] text-[9px] uppercase tracking-widest bg-[#0C0E16]/80">
              {renderMode === 'smooth' ? '60Hz SMOOTH' : 'RAW STREAM'}
            </span>
            <span className="text-[#8A90A6]/40">|</span>
            <span>ISO 800</span>
          </div>
        </div>
      )}

      {/* Paused Watermark */}
      {isPaused && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 border border-[#7F5AF0] bg-[#05060A]/85 backdrop-blur-md text-[#ECE8F6] font-mono-data text-xs tracking-widest uppercase z-30">
          ❚❚ EXPOSURE FROZEN // PAUSED
        </div>
      )}

      {/* Standby State: Photographic Lens awaiting signal */}
      {!isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 z-20 bg-[#05060A]/90 backdrop-blur-sm">
          {/* Aperture Iris Vector Blades */}
          <div className="relative w-24 h-24 border border-[rgba(236,232,246,0.14)] rounded-full flex items-center justify-center">
            <div className="absolute inset-3 border border-[#7F5AF0]/30 rounded-full animate-spin" style={{ animationDuration: '24s' }} />
            <div className="w-2.5 h-2.5 rounded-full bg-[#7F5AF0] shadow-[0_0_12px_#7F5AF0]" />
          </div>

          <div className="text-center font-mono-data space-y-1">
            <div className="text-sm font-semibold tracking-[0.25em] text-[#ECE8F6]">
              AWAITING EXPOSURE SIGNAL
            </div>
            <div className="text-[11px] tracking-wider text-[#8A90A6]">
              SELECT FEED PRESET & CLICK [▶ START STREAM] OR ADD ?mock=1 TO URL
            </div>
          </div>
        </div>
      )}

      {/* Viewfinder Lower-Third Metadata HUD Strip */}
      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono-data tracking-widest text-[#8A90A6] bg-[#0C0E16]/85 backdrop-blur-md px-3.5 py-1.5 border border-[rgba(236,232,246,0.09)] z-30">
        <div className="flex items-center space-x-3">
          <span className="text-[#FFF1CC] font-semibold">{modelTag}</span>
          <span className="text-[#8A90A6]/30">|</span>
          <span>960×540 APERTURE</span>
          <span className="text-[#8A90A6]/30">|</span>
          <span>BYTETRACK OPTICAL FLOW</span>
        </div>

        <div className="flex items-center space-x-3">
          <span>ACTIVE TRACKS: {currentTelemetryRef.current?.tracks?.length ?? 0}</span>
          <span className="text-[#8A90A6]/30">|</span>
          <span>
            GATE Y:{' '}
            {currentTelemetryRef.current?.gate
              ? `${(currentTelemetryRef.current.gate.y_ratio * 100).toFixed(0)}%`
              : '55%'}
          </span>
        </div>
      </div>
    </div>
  );
};
