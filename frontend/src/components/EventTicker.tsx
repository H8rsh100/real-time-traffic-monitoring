import React, { useRef, useEffect, useState } from 'react';
import type { CrossingEvent } from '../types';

interface EventTickerProps {
  events: CrossingEvent[];
  onSeek: (frameIdx: number) => void;
}

export const EventTicker: React.FC<EventTickerProps> = ({ events, onSeek }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-scroll to bottom unless hovered
  useEffect(() => {
    if (!isHovered && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, isHovered]);

  return (
    <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] flex flex-col h-full font-mono-numbers text-xs select-none">
      {/* Ticker Header */}
      <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
            GATE CROSSING TELEMETRY STREAM
          </span>
          <span className="text-[9px] px-1 bg-neutral-800 text-neutral-300 font-medium">
            {events.length} EVENTS
          </span>
        </div>
        <span className="text-[9px] text-neutral-400">CLICK ROW TO SEEK</span>
      </div>

      {/* Stream Terminal Window */}
      <div
        ref={containerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex-grow overflow-y-auto p-2 space-y-1 text-[11px]"
      >
        {events.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-[10px] tracking-wider text-neutral-400 font-mono">
            AWAITING GATE INTERSECTION EVENTS...
          </div>
        ) : (
          events.map((ev, i) => {
            const timeStr = new Date(ev.timestamp_sec * 1000).toISOString().substr(14, 7);
            const glyph =
              ev.category === 'Pedestrian'
                ? '[● PED]'
                : ev.category === 'Cyclist'
                ? '[◆ CYC]'
                : '[▲ VEH]';

            const colorClass =
              ev.category === 'Pedestrian'
                ? 'text-[#8EA695]'
                : ev.category === 'Cyclist'
                ? 'text-[#B5A078]'
                : 'text-[#8E9DAE]';

            const isDirectionIn = ev.direction === 'IN';

            return (
              <div
                key={i}
                onClick={() => onSeek(ev.frame_idx)}
                className="px-2 py-1 bg-[#14171E] hover:bg-[#1B202A] border border-[rgba(255,255,255,0.05)] hover:border-[#FF5A1F]/50 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2 font-mono">
                  <span className="text-neutral-400 text-[10px] font-normal">{timeStr}</span>
                  <span className="text-neutral-300 font-medium">#{String(ev.track_id).padStart(2, '0')}</span>
                  <span className={`${colorClass} font-semibold text-[10px]`}>{glyph}</span>
                  <span className="text-neutral-200 uppercase font-medium">{ev.class}</span>
                </div>

                <div className="flex items-center space-x-3 font-mono">
                  <span
                    className={`text-[10px] font-semibold px-1 py-0.2 ${
                      isDirectionIn
                        ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/40'
                        : 'text-amber-400 bg-amber-950/40 border border-amber-900/40'
                    }`}
                  >
                    {isDirectionIn ? '▲ IN' : '▼ OUT'}
                  </span>
                  <span className="text-neutral-400 text-[10px]">
                    {(ev.conf * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
