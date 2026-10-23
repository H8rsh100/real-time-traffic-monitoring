import React, { useState } from 'react';
import type { CrossingEvent } from '../types';

interface AnalyticsDeckProps {
  events: CrossingEvent[];
}

export const AnalyticsDeck: React.FC<AnalyticsDeckProps> = ({ events }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Directional Split
  const totalEvents = events.length;
  const inEvents = events.filter((e) => e.direction === 'IN').length;
  const outEvents = totalEvents - inEvents;
  const inPct = totalEvents > 0 ? (inEvents / totalEvents) * 100 : 50;
  const outPct = totalEvents > 0 ? (outEvents / totalEvents) * 100 : 50;

  // 16-bin Gate Density Road (Light-Streak Road)
  const bins = Array(16).fill(0);
  events.forEach((ev) => {
    const binIdx = Math.min(15, Math.max(0, Math.floor((ev.centroid[0] / 960) * 16)));
    bins[binIdx]++;
  });
  const maxBin = Math.max(...bins, 1);

  // Stepped cumulative flow timeline
  const chartW = 340;
  const chartH = 80;
  const sortedEvents = [...events].sort((a, b) => a.timestamp_sec - b.timestamp_sec);
  const maxTime = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].timestamp_sec : 10;

  const points: { x: number; y: number; count: number; time: number }[] = [];
  let cumCount = 0;
  sortedEvents.forEach((ev) => {
    cumCount++;
    const x = (ev.timestamp_sec / (maxTime || 1)) * (chartW - 20) + 10;
    const y = chartH - (cumCount / (totalEvents || 1)) * (chartH - 24) - 12;
    points.push({ x, y, count: cumCount, time: ev.timestamp_sec });
  });

  // Build stepped SVG path
  let pathD = `M 10 ${chartH - 12}`;
  points.forEach((pt, i) => {
    if (i === 0) {
      pathD += ` L ${pt.x} ${chartH - 12} L ${pt.x} ${pt.y}`;
    } else {
      pathD += ` L ${pt.x} ${points[i - 1].y} L ${pt.x} ${pt.y}`;
    }
  });

  return (
    <div className="bg-[#0C0E16]/75 backdrop-blur-md border border-[rgba(236,232,246,0.09)] p-4 flex flex-col space-y-4 font-mono-data text-xs select-none">
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-[rgba(236,232,246,0.06)]">
        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#8A90A6]">
          SPATIAL & DIRECTIONAL FLOW
        </span>
        <span className="text-[9px] text-[#8A90A6]">REAL-TIME TELEMETRY</span>
      </div>

      {/* 1. Directional Split Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] tracking-wider">
          <span className="text-[#FFF1CC] flex items-center space-x-1">
            <span>▲ INBOUND (HEADLIGHT)</span>
            <span className="font-bold">{inEvents} ({inPct.toFixed(0)}%)</span>
          </span>
          <span className="text-[#FF3B30] flex items-center space-x-1">
            <span className="font-bold">{outEvents} ({outPct.toFixed(0)}%)</span>
            <span>OUTBOUND (TAILLIGHT) ▼</span>
          </span>
        </div>

        <div className="h-2 w-full bg-[#05060A] border border-[rgba(236,232,246,0.08)] flex overflow-hidden">
          <div
            className="h-full bg-[#FFF1CC] transition-all duration-300 shadow-[0_0_8px_#FFF1CC]"
            style={{ width: `${inPct}%` }}
          />
          <div
            className="h-full bg-[#FF3B30] transition-all duration-300 shadow-[0_0_8px_#FF3B30]"
            style={{ width: `${outPct}%` }}
          />
        </div>
      </div>

      {/* 2. Light-Streak Road: 16-bin Gate Density Heatmap */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-[#8A90A6]">
          <span>LIGHT-STREAK ROAD // 16 LATERAL LANES</span>
          <span>GATE Y-DENSITY</span>
        </div>

        <div className="h-14 w-full bg-[#05060A]/80 border border-[rgba(236,232,246,0.08)] flex items-end justify-between px-1.5 py-1 gap-1">
          {bins.map((val, idx) => {
            const hRatio = maxBin > 0 ? val / maxBin : 0;
            const barHeight = Math.max(4, hRatio * 46);
            const isHot = val === maxBin && val > 0;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                <div
                  className="w-full transition-all duration-300 rounded-[1px]"
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: isHot ? '#FFF1CC' : val > 0 ? '#7F5AF0' : 'rgba(236,232,246,0.06)',
                    boxShadow: val > 0 ? (isHot ? '0 0 10px #FFF1CC' : '0 0 6px #7F5AF080') : 'none',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Stepped Cumulative Flow Graph */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-[#8A90A6]">
          <span>CUMULATIVE CROSSINGS (STEPPED FLOW)</span>
          <span>{totalEvents} TOTAL</span>
        </div>

        <div
          className="relative h-20 w-full bg-[#05060A]/80 border border-[rgba(236,232,246,0.08)] overflow-hidden"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <svg className="w-full h-full" viewBox={`0 0 ${chartW} ${chartH}`}>
            {/* Gridlines */}
            <line x1="10" y1="20" x2={chartW - 10} y2="20" stroke="rgba(236,232,246,0.05)" strokeDasharray="3 3" />
            <line x1="10" y1="50" x2={chartW - 10} y2="50" stroke="rgba(236,232,246,0.05)" strokeDasharray="3 3" />

            {/* Stepped line */}
            <path
              d={pathD}
              fill="none"
              stroke="#7F5AF0"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 0 6px rgba(127, 90, 240, 0.6))' }}
            />

            {/* Data points */}
            {points.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={hoverIndex === i ? 4 : 2}
                fill={hoverIndex === i ? '#FFF1CC' : '#7F5AF0'}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoverIndex(i)}
              />
            ))}
          </svg>

          {hoverIndex !== null && points[hoverIndex] && (
            <div className="absolute top-1 right-2 text-[9px] px-1.5 py-0.5 bg-[#0C0E16] border border-[#7F5AF0] text-[#ECE8F6]">
              {points[hoverIndex].time.toFixed(1)}s // #{points[hoverIndex].count}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
