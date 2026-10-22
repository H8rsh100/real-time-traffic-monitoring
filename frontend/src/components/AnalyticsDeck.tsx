import React, { useState } from 'react';
import type { CategoryCounts, CrossingEvent } from '../types';

interface AnalyticsDeckProps {
  counts: CategoryCounts;
  events: CrossingEvent[];
}

export const AnalyticsDeck: React.FC<AnalyticsDeckProps> = ({ counts, events }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Directional Split Calculation
  const total = counts.in + counts.out || 1;
  const inPercent = ((counts.in / total) * 100).toFixed(1);
  const outPercent = ((counts.out / total) * 100).toFixed(1);

  // 1. Cumulative Stepped Flow Path
  const w = 480;
  const h = 80;
  let runningCount = 0;
  const flowPoints: { x: number; y: number; timeStr: string; label: string }[] = [];

  const maxTime = Math.max(...events.map((e) => e.timestamp_sec), 30);
  const maxEvents = Math.max(events.length, 5);

  events.forEach((ev) => {
    runningCount += 1;
    const x = (ev.timestamp_sec / maxTime) * (w - 20) + 10;
    const y = h - (runningCount / maxEvents) * (h - 20) - 10;
    flowPoints.push({
      x,
      y,
      timeStr: `${ev.timestamp_sec.toFixed(1)}s`,
      label: `#${ev.track_id} ${ev.class.toUpperCase()}`,
    });
  });

  // 2. Crossing Position Heatmap Bins (Along gate width 0 to 768px)
  const numBins = 16;
  const bins = new Array(numBins).fill(0);
  events.forEach((ev) => {
    const cx = ev.centroid ? ev.centroid[0] : 384;
    const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor((cx / 768) * numBins)));
    bins[binIdx] += 1;
  });
  const maxBinVal = Math.max(...bins, 1);

  return (
    <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] p-3 font-mono-numbers text-xs select-none space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[rgba(255,255,255,0.06)]">
        <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
          ANALYTICS: FLOW DYNAMICS & SPATIAL DISTRIBUTION
        </span>
        <span className="text-[9px] text-neutral-400">DIRECT SPEC - NO PIES</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Module A: Directional Split Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-emerald-400 font-medium">▲ INFLOW: {counts.in} ({inPercent}%)</span>
            <span className="text-amber-400 font-medium">▼ OUTFLOW: {counts.out} ({outPercent}%)</span>
          </div>
          {/* Custom Horizontal Split Bar */}
          <div className="w-full h-3 bg-neutral-900 border border-[rgba(255,255,255,0.1)] flex overflow-hidden">
            <div
              className="bg-emerald-600/80 transition-all duration-300"
              style={{ width: `${inPercent}%` }}
              title={`IN: ${counts.in}`}
            />
            <div
              className="bg-amber-600/80 transition-all duration-300 flex-grow"
              title={`OUT: ${counts.out}`}
            />
          </div>
          <div className="text-[9px] text-neutral-400 tracking-wider">
            VECTOR ORIENTATION: DOWNWARD = IN // UPWARD = OUT
          </div>
        </div>

        {/* Module B: Cumulative Crossing Flow Stream */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-neutral-400 font-medium">CUMULATIVE GATE CROSSINGS</span>
            <span className="text-neutral-300 font-mono">{events.length} TOTAL</span>
          </div>

          <div className="relative w-full h-20 bg-[#0E1015] border border-[rgba(255,255,255,0.06)] overflow-hidden">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
              {/* Stepped flow line */}
              {flowPoints.length > 0 && (
                <path
                  d={`M 10,${h - 10} ` + flowPoints.map((p) => `H ${p.x} V ${p.y}`).join(' ')}
                  fill="none"
                  stroke="#FF5A1F"
                  strokeWidth="1.5"
                />
              )}

              {/* Data points */}
              {flowPoints.map((p, i) => (
                <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
                  <circle cx={p.x} cy={p.y} r={hoverIndex === i ? 4 : 2} fill="#FF5A1F" className="cursor-pointer" />
                </g>
              ))}

              {/* Hover Crosshair & Label */}
              {hoverIndex !== null && flowPoints[hoverIndex] && (
                <g>
                  <line
                    x1={flowPoints[hoverIndex].x}
                    y1={0}
                    x2={flowPoints[hoverIndex].x}
                    y2={h}
                    stroke="rgba(255,255,255,0.3)"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={Math.min(flowPoints[hoverIndex].x + 5, w - 80)}
                    y={Math.max(flowPoints[hoverIndex].y - 5, 12)}
                    fill="#EDEDED"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {flowPoints[hoverIndex].label} ({flowPoints[hoverIndex].timeStr})
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Module C: Crossing-Position Heatmap (Along Gate Width) */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-neutral-400 font-medium">GATE LATERAL POSITION HEATMAP</span>
            <span className="text-neutral-400">LEFT ───► RIGHT</span>
          </div>

          {/* 16-bin lateral distribution bar */}
          <div className="grid grid-cols-16 gap-0.5 h-10 items-end bg-[#0E1015] p-1 border border-[rgba(255,255,255,0.06)]">
            {bins.map((val, i) => {
              const heightRatio = val / maxBinVal;
              return (
                <div
                  key={i}
                  title={`Lateral Bin ${i + 1}/${numBins}: ${val} crossings`}
                  className="w-full transition-all duration-300 cursor-pointer"
                  style={{
                    height: `${Math.max(15, heightRatio * 100)}%`,
                    backgroundColor: val > 0 ? `rgba(255, 90, 31, ${0.3 + heightRatio * 0.7})` : 'rgba(255,255,255,0.05)',
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] text-neutral-400">
            <span>0 px (L)</span>
            <span>384 px (MID)</span>
            <span>768 px (R)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
