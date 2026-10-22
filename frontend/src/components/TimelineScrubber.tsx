import React from 'react';
import type { CrossingEvent, SessionFrame } from '../types';

interface TimelineScrubberProps {
  currentFrameIdx: number;
  totalFrames: number;
  sessionFrames: SessionFrame[];
  events: CrossingEvent[];
  replayIndex: number | null;
  onSeek: (frameIdx: number) => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentFrameIdx,
  totalFrames,
  events,
  replayIndex,
  onSeek,
}) => {
  const maxFrames = Math.max(totalFrames, 1);
  const currentRatio = Math.min(1, Math.max(0, currentFrameIdx / maxFrames));

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetFrame = Math.round(ratio * maxFrames);
    onSeek(targetFrame);
  };

  return (
    <div className="w-full bg-[#0D0F13] border-x border-b border-[rgba(255,255,255,0.08)] px-3 py-1.5 flex items-center space-x-3 font-mono-numbers text-[10px] select-none">
      {/* Frame Counter Readout */}
      <div className="flex items-center space-x-1.5 flex-shrink-0 text-neutral-400">
        <span className="text-[9px] uppercase tracking-wider text-neutral-500">FRAME</span>
        <span className="text-neutral-200 font-medium">
          {String(currentFrameIdx).padStart(4, '0')}
        </span>
        <span className="text-neutral-600">/</span>
        <span className="text-neutral-400">{String(totalFrames).padStart(4, '0')}</span>
      </div>

      {/* Interactive Timeline Track */}
      <div
        onClick={handleTrackClick}
        className="relative flex-grow h-4 bg-[#14171E] border border-[rgba(255,255,255,0.08)] cursor-pointer group flex items-center"
      >
        {/* Progress Fill */}
        <div
          className="absolute left-0 top-0 bottom-0 bg-[#FF5A1F]/30 border-r border-[#FF5A1F]"
          style={{ width: `${currentRatio * 100}%` }}
        />

        {/* Playhead Pin */}
        <div
          className="absolute top-[-3px] bottom-[-3px] w-1 bg-[#FF5A1F] shadow-[0_0_4px_rgba(255,90,31,0.8)] z-10"
          style={{ left: `calc(${currentRatio * 100}% - 2px)` }}
        />

        {/* Event Marker Ticks on Timeline */}
        {events.map((ev, i) => {
          const evRatio = Math.min(1, Math.max(0, ev.frame_idx / maxFrames));
          const color =
            ev.category === 'Pedestrian'
              ? '#8EA695'
              : ev.category === 'Cyclist'
              ? '#B5A078'
              : '#8E9DAE';

          return (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(ev.frame_idx);
              }}
              title={`Frame ${ev.frame_idx}: #${ev.track_id} ${ev.class.toUpperCase()} ${ev.direction}`}
              className="absolute top-0 bottom-0 w-[2px] hover:w-[4px] hover:z-20 cursor-pointer transition-all"
              style={{
                left: `${evRatio * 100}%`,
                backgroundColor: color,
              }}
            />
          );
        })}
      </div>

      {/* Replay State Tag */}
      {replayIndex !== null && (
        <span className="px-1.5 py-0.5 bg-[#251A14] border border-[#FF5A1F]/40 text-[#FF5A1F] text-[9px] font-semibold tracking-wider flex-shrink-0">
          REPLAY SEEK
        </span>
      )}
    </div>
  );
};
