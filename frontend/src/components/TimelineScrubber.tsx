import React from 'react';
import type { SessionFrame, CrossingEvent } from '../types';

interface TimelineScrubberProps {
  sessionFrames: SessionFrame[];
  events: CrossingEvent[];
  currentIndex: number | null;
  onSeek: (frameIdx: number) => void;
  isStreaming: boolean;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  sessionFrames,
  events,
  currentIndex,
  onSeek,
  isStreaming,
}) => {
  const totalFrames = sessionFrames.length;

  if (totalFrames === 0) return null;

  const currentFrame = currentIndex !== null && sessionFrames[currentIndex]
    ? sessionFrames[currentIndex]
    : sessionFrames[totalFrames - 1];

  const currentIdx = currentFrame ? currentFrame.frame_idx : 0;
  const maxIdx = sessionFrames[totalFrames - 1]?.frame_idx || 1;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onSeek(val);
  };

  return (
    <div className="w-full bg-[#0C0E16]/85 backdrop-blur-md border border-[rgba(236,232,246,0.09)] p-2.5 flex flex-col space-y-1.5 font-mono-data select-none">
      <div className="flex items-center justify-between text-[10px] text-[#8A90A6]">
        <div className="flex items-center space-x-2">
          <span className="text-[#ECE8F6] font-semibold">EXPOSURE TIMELINE</span>
          <span className="text-[#8A90A6]/40">|</span>
          <span>FRAME {currentIdx} / {maxIdx}</span>
        </div>

        <div className="flex items-center space-x-3 text-[10px]">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFF1CC] shadow-[0_0_6px_#FFF1CC]" />
            <span className="text-[#FFF1CC]">▲ IN</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
            <span className="text-[#FF3B30]">▼ OUT</span>
          </span>
          <span className="text-[#ECE8F6] font-medium">
            {currentFrame?.timestamp_sec?.toFixed(2) ?? '0.00'}s
          </span>
        </div>
      </div>

      {/* Scrubber track container */}
      <div className="relative w-full h-5 flex items-center">
        {/* Event ticks as glowing light points */}
        <div className="absolute inset-0 pointer-events-none flex items-center">
          {events.map((ev, i) => {
            const pct = maxIdx > 0 ? (ev.frame_idx / maxIdx) * 100 : 0;
            const isLatest = i === events.length - 1;
            const color = ev.direction === 'IN' ? '#FFF1CC' : '#FF3B30';

            return (
              <div
                key={i}
                className="absolute w-1 h-3 -translate-x-1/2 rounded-full pointer-events-auto cursor-pointer"
                style={{
                  left: `${Math.min(99.5, Math.max(0.5, pct))}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 ${isLatest ? '8px' : '4px'} ${color}`,
                }}
                title={`Frame ${ev.frame_idx}: ${ev.direction} ${ev.class}`}
                onClick={() => onSeek(ev.frame_idx)}
              />
            );
          })}
        </div>

        {/* Range input */}
        <input
          type="range"
          min={sessionFrames[0]?.frame_idx || 0}
          max={maxIdx}
          value={currentIdx}
          onChange={handleSliderChange}
          disabled={isStreaming}
          className="w-full h-1 bg-[rgba(236,232,246,0.14)] appearance-none cursor-pointer accent-[#7F5AF0] disabled:cursor-not-allowed z-10"
        />
      </div>
    </div>
  );
};
