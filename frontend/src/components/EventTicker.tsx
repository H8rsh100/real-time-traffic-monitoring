import React from 'react';
import type { CrossingEvent } from '../types';

interface EventTickerProps {
  events: CrossingEvent[];
  onSeekToFrame: (frameIdx: number) => void;
}

export const EventTicker: React.FC<EventTickerProps> = ({ events, onSeekToFrame }) => {
  const recentEvents = [...events].reverse().slice(0, 50);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(4, '0')}`;
  };

  const getClassGlyph = (category: string) => {
    if (category === 'Pedestrian') return { glyph: '●', color: '#4FD1FF', label: 'PED' };
    if (category === 'Cyclist') return { glyph: '◆', color: '#B6FF4F', label: 'CYC' };
    return { glyph: '▲', color: '#FFB347', label: 'VEH' };
  };

  return (
    <div className="bg-[#0C0E16]/75 backdrop-blur-md border border-[rgba(236,232,246,0.09)] flex flex-col h-full font-mono-data text-xs select-none">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[rgba(236,232,246,0.06)] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7F5AF0] shadow-[0_0_8px_#7F5AF0]" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#8A90A6]">
            OPTICAL EVENT TICKER
          </span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 bg-[#05060A] text-[#8A90A6] border border-[rgba(236,232,246,0.08)]">
          {events.length} LOGGED
        </span>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-12 px-3 py-1.5 border-b border-[rgba(236,232,246,0.04)] text-[9px] uppercase tracking-wider text-[#8A90A6]/70">
        <span className="col-span-3">TIME</span>
        <span className="col-span-2">DIR</span>
        <span className="col-span-3">CLASS</span>
        <span className="col-span-2 text-center">TRACK</span>
        <span className="col-span-2 text-right">CONF</span>
      </div>

      {/* Event Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-[rgba(236,232,246,0.03)] text-[11px]">
        {recentEvents.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-[#8A90A6]/50 text-xs tracking-wider space-y-1">
            <span>NO GATE CROSSINGS YET</span>
            <span className="text-[9px]">CROSSING TRIPWIRE LOGS HERE</span>
          </div>
        ) : (
          recentEvents.map((ev, i) => {
            const classInfo = getClassGlyph(ev.category);
            const isLatest = i === 0;

            return (
              <div
                key={`${ev.frame_idx}_${ev.track_id}_${i}`}
                onClick={() => onSeekToFrame(ev.frame_idx)}
                className={`grid grid-cols-12 items-center px-3 py-2 cursor-pointer transition-colors duration-150 ${
                  isLatest
                    ? 'bg-[#7F5AF0]/10 hover:bg-[#7F5AF0]/20'
                    : 'hover:bg-[#121520]/80'
                }`}
              >
                {/* Time */}
                <span className="col-span-3 text-[#8A90A6] text-[10px]">
                  {formatTime(ev.timestamp_sec)}
                </span>

                {/* Direction Badge */}
                <span className="col-span-2">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold border ${
                      ev.direction === 'IN'
                        ? 'border-[#FFF1CC]/40 text-[#FFF1CC] bg-[#FFF1CC]/10'
                        : 'border-[#FF3B30]/40 text-[#FF3B30] bg-[#FF3B30]/10'
                    }`}
                  >
                    {ev.direction === 'IN' ? '▲ IN' : '▼ OUT'}
                  </span>
                </span>

                {/* Class */}
                <span className="col-span-3 flex items-center space-x-1.5 truncate">
                  <span style={{ color: classInfo.color }}>{classInfo.glyph}</span>
                  <span className="text-[#ECE8F6] capitalize">{ev.class}</span>
                </span>

                {/* Track ID */}
                <span className="col-span-2 text-center text-[#8A90A6] font-medium">
                  #{ev.track_id}
                </span>

                {/* Confidence */}
                <span className="col-span-2 text-right text-[#8A90A6] text-[10px]">
                  {(ev.conf * 100).toFixed(0)}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
