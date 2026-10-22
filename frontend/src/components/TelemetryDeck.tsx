import React, { useRef, useEffect } from 'react';
import type { CategoryCounts } from '../types';

interface TelemetryDeckProps {
  counts: CategoryCounts;
}

// Minimal Sparkline SVG Component (No chart libraries)
const MiniSparkline: React.FC<{ history: number[]; color: string }> = ({ history, color }) => {
  if (history.length < 2) {
    return <div className="h-6 w-full bg-neutral-900/30 border-b border-neutral-800" />;
  }

  const max = Math.max(...history, 1);
  const min = Math.min(...history, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 24;

  const points = history
    .map((val, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((val - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6 overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.2" points={points} />
    </svg>
  );
};

export const TelemetryDeck: React.FC<TelemetryDeckProps> = ({ counts }) => {
  // Sparkline history buffers
  const totalHistRef = useRef<number[]>([]);
  const vehHistRef = useRef<number[]>([]);
  const pedHistRef = useRef<number[]>([]);
  const cycHistRef = useRef<number[]>([]);

  useEffect(() => {
    const pushHist = (ref: React.MutableRefObject<number[]>, val: number) => {
      ref.current.push(val);
      if (ref.current.length > 30) ref.current.shift();
    };

    pushHist(totalHistRef, counts.total);
    pushHist(vehHistRef, counts.vehicle);
    pushHist(pedHistRef, counts.pedestrian);
    pushHist(cycHistRef, counts.cyclist);
  }, [counts]);

  const total = counts.total || 0;
  const vehShare = total > 0 ? ((counts.vehicle / total) * 100).toFixed(0) : '0';
  const pedShare = total > 0 ? ((counts.pedestrian / total) * 100).toFixed(0) : '0';
  const cycShare = total > 0 ? ((counts.cyclist / total) * 100).toFixed(0) : '0';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 font-mono-numbers select-none">
      {/* 1. Total Gate Count */}
      <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
            TOTAL GATE FLOW
          </span>
          <span className="text-[9px] text-[#FF5A1F] font-semibold">
            ▲ {counts.in} IN / ▼ {counts.out} OUT
          </span>
        </div>

        <div className="my-1.5 flex items-baseline justify-between">
          <span className="text-2xl font-mono font-medium tracking-tight text-neutral-100">
            {String(counts.total).padStart(4, '0')}
          </span>
          <span className="text-[10px] text-neutral-400">GATE CROSSINGS</span>
        </div>

        <MiniSparkline history={totalHistRef.current} color="#FF5A1F" />
      </div>

      {/* 2. Vehicles */}
      <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
            [▲] VEHICLES
          </span>
          <span className="text-[9px] text-neutral-400 font-medium">{vehShare}% SHARE</span>
        </div>

        <div className="my-1.5 flex items-baseline justify-between">
          <span className="text-2xl font-mono font-medium tracking-tight text-[#8E9DAE]">
            {String(counts.vehicle).padStart(4, '0')}
          </span>
          <span className="text-[10px] text-neutral-400">CAR / TRK / BUS</span>
        </div>

        <MiniSparkline history={vehHistRef.current} color="#8E9DAE" />
      </div>

      {/* 3. Pedestrians */}
      <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
            [●] PEDESTRIANS
          </span>
          <span className="text-[9px] text-neutral-400 font-medium">{pedShare}% SHARE</span>
        </div>

        <div className="my-1.5 flex items-baseline justify-between">
          <span className="text-2xl font-mono font-medium tracking-tight text-[#8EA695]">
            {String(counts.pedestrian).padStart(4, '0')}
          </span>
          <span className="text-[10px] text-neutral-400">CROSSWALK</span>
        </div>

        <MiniSparkline history={pedHistRef.current} color="#8EA695" />
      </div>

      {/* 4. Cyclists */}
      <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
            [◆] CYCLISTS
          </span>
          <span className="text-[9px] text-neutral-400 font-medium">{cycShare}% SHARE</span>
        </div>

        <div className="my-1.5 flex items-baseline justify-between">
          <span className="text-2xl font-mono font-medium tracking-tight text-[#B5A078]">
            {String(counts.cyclist).padStart(4, '0')}
          </span>
          <span className="text-[10px] text-neutral-400">BIKE LANE</span>
        </div>

        <MiniSparkline history={cycHistRef.current} color="#B5A078" />
      </div>
    </div>
  );
};
