import React from 'react';
import type { Telemetry } from '../types';

interface HeaderBarProps {
  isStreaming: boolean;
  telemetry: Telemetry | null;
  selectedModel: string;
  onOpenPalette: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  isStreaming,
  telemetry,
  selectedModel,
  onOpenPalette,
}) => {
  const fps = telemetry?.fps ?? 0;
  const latency = telemetry?.latency_ms ?? 0;
  const timecode = telemetry?.timestamp_sec
    ? new Date(telemetry.timestamp_sec * 1000).toISOString().substr(14, 7)
    : '00:00.0';

  const modelTag = selectedModel.replace('.pt', '').toUpperCase();

  return (
    <header className="h-10 bg-[#0A0B0D] border-b border-[rgba(255,255,255,0.08)] px-4 flex items-center justify-between font-mono-numbers text-xs select-none">
      {/* Left: Stream ID & Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5">
          <span
            className={`w-2 h-2 rounded-none inline-block ${
              isStreaming ? 'bg-[#FF5A1F] animate-pulse' : 'bg-neutral-600'
            }`}
          />
          <span className="text-[11px] font-semibold tracking-wider text-neutral-300">
            {isStreaming ? 'LIVE' : 'STANDBY'}
          </span>
        </div>

        <span className="text-neutral-600">/</span>

        <span className="text-[11px] tracking-wider text-neutral-400">
          SYS_SURV // CAM-01 [URBAN-GRID-EAST]
        </span>

        <span className="text-neutral-600">/</span>

        <span className="text-[10px] tracking-widest text-[#FF5A1F] font-semibold bg-[#1C1613] px-1.5 py-0.5 border border-[rgba(255,90,31,0.3)]">
          {modelTag}
        </span>
      </div>

      {/* Center: Live Telemetry Telemetry */}
      <div className="flex items-center space-x-6 text-neutral-400">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">TIMECODE</span>
          <span className="text-neutral-200 font-mono">{timecode}</span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">THROUGHPUT</span>
          <span className="text-neutral-200 font-mono">
            {fps > 0 ? `${fps.toFixed(1)} FPS` : '-- FPS'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">FORWARD LAT</span>
          <span className="text-neutral-200 font-mono">
            {latency > 0 ? `${latency.toFixed(1)} ms` : '-- ms'}
          </span>
        </div>
      </div>

      {/* Right: Actions & Command Palette hint */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenPalette}
          className="flex items-center space-x-1.5 bg-[#14161D] hover:bg-[#1B1E27] text-neutral-300 px-2.5 py-1 border border-[rgba(255,255,255,0.12)] text-[11px] transition-colors cursor-pointer"
        >
          <span className="text-neutral-400">CMD</span>
          <kbd className="bg-[#0A0B0D] px-1 py-0.2 text-[9px] border border-neutral-700 text-neutral-300">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
};
