import React from 'react';
import type { StreamConfig } from '../hooks/useSurveillanceStream';

interface ControlRailProps {
  config: StreamConfig;
  onChangeConfig: (updates: Partial<StreamConfig>) => void;
  isStreaming: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onExportCsv: () => void;
}

export const ControlRail: React.FC<ControlRailProps> = ({
  config,
  onChangeConfig,
  isStreaming,
  isPaused,
  onStart,
  onStop,
  onPause,
  onResume,
  onExportCsv,
}) => {
  return (
    <aside className="w-60 xl:w-64 flex-shrink-0 bg-[#0E1014] border-r border-[rgba(255,255,255,0.08)] flex flex-col justify-between font-mono-numbers text-xs select-none p-3 overflow-y-auto">
      <div className="space-y-5">
        {/* Rail Title */}
        <div className="pb-2 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-neutral-400">
            CONTROL RAIL
          </span>
          <span className="text-[9px] px-1 py-0.2 bg-neutral-800 text-neutral-400 border border-neutral-700">
            REV 1.4
          </span>
        </div>

        {/* 1. Feed Source */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
            FEED SOURCE
          </label>
          <div className="grid grid-cols-3 gap-1 text-[11px]">
            <button
              onClick={() => onChangeConfig({ source: 'data/busy_traffic.mp4' })}
              className={`px-1.5 py-1.5 text-left border cursor-pointer transition-colors ${
                config.source.includes('busy_traffic')
                  ? 'bg-[#181C24] border-[#FF5A1F] text-neutral-100'
                  : 'bg-[#121419] border-[rgba(255,255,255,0.08)] text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="text-[10px] font-semibold">BUSY</div>
              <div className="text-[8px] text-neutral-400">High Traffic</div>
            </button>

            <button
              onClick={() => onChangeConfig({ source: 'data/traffic_sample.mp4' })}
              className={`px-1.5 py-1.5 text-left border cursor-pointer transition-colors ${
                config.source.includes('traffic_sample')
                  ? 'bg-[#181C24] border-[#FF5A1F] text-neutral-100'
                  : 'bg-[#121419] border-[rgba(255,255,255,0.08)] text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="text-[10px] font-semibold">URBAN</div>
              <div className="text-[8px] text-neutral-400">Multi-Class</div>
            </button>

            <button
              onClick={() => onChangeConfig({ source: 'data/car_detection.mp4' })}
              className={`px-1.5 py-1.5 text-left border cursor-pointer transition-colors ${
                config.source.includes('car_detection')
                  ? 'bg-[#181C24] border-[#FF5A1F] text-neutral-100'
                  : 'bg-[#121419] border-[rgba(255,255,255,0.08)] text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="text-[10px] font-semibold">HIGHWAY</div>
              <div className="text-[8px] text-neutral-400">Cars Flow</div>
            </button>
          </div>
        </div>

        {/* 2. Model Tier */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
            DETECTION ARCHITECTURE
          </label>
          <div className="space-y-1 text-[11px]">
            {[
              { id: 'yolov8n.pt', name: 'YOLOv8n (Nano)', fps: '7.76 FPS', size: '6.25 MB' },
              { id: 'yolov8s.pt', name: 'YOLOv8s (Small)', fps: '5.30 FPS', size: '21.5 MB' },
              { id: 'yolov8m.pt', name: 'YOLOv8m (Medium)', fps: '1.95 FPS', size: '49.7 MB' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeConfig({ model: m.id })}
                className={`w-full px-2 py-1.5 flex items-center justify-between border cursor-pointer transition-colors ${
                  config.model === m.id
                    ? 'bg-[#181C24] border-[#FF5A1F] text-neutral-100'
                    : 'bg-[#121419] border-[rgba(255,255,255,0.08)] text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span className="font-medium text-[11px]">{m.name}</span>
                <span className="text-[9px] text-neutral-400">{m.fps}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Thresholds Sliders */}
        <div className="space-y-3 pt-1 border-t border-[rgba(255,255,255,0.06)]">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400 tracking-wider uppercase">CONFIDENCE (TAU_CONF)</span>
              <span className="text-neutral-200 font-mono font-medium">{config.conf.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.80"
              step="0.05"
              value={config.conf}
              onChange={(e) => onChangeConfig({ conf: parseFloat(e.target.value) })}
              className="w-full accent-[#FF5A1F] bg-neutral-800 h-1 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400 tracking-wider uppercase">NMS IOU (TAU_IOU)</span>
              <span className="text-neutral-200 font-mono font-medium">{config.iou.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.20"
              max="0.75"
              step="0.05"
              value={config.iou}
              onChange={(e) => onChangeConfig({ iou: parseFloat(e.target.value) })}
              className="w-full accent-[#FF5A1F] bg-neutral-800 h-1 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400 tracking-wider uppercase">COUNTING GATE (Y-POS)</span>
              <span className="text-neutral-200 font-mono font-medium">
                {(config.line_ratio * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.20"
              max="0.85"
              step="0.05"
              value={config.line_ratio}
              onChange={(e) => onChangeConfig({ line_ratio: parseFloat(e.target.value) })}
              className="w-full accent-[#FF5A1F] bg-neutral-800 h-1 cursor-pointer"
            />
          </div>
        </div>

        {/* 4. Frame Limit */}
        <div className="space-y-1 pt-1 border-t border-[rgba(255,255,255,0.06)]">
          <div className="flex justify-between text-[10px]">
            <span className="text-neutral-400 tracking-wider uppercase">FRAME LIMIT (0 = ALL)</span>
            <span className="text-neutral-300 font-mono">{config.max_frames}</span>
          </div>
          <input
            type="number"
            min="0"
            max="1000"
            step="50"
            value={config.max_frames}
            onChange={(e) => onChangeConfig({ max_frames: parseInt(e.target.value) || 0 })}
            className="w-full bg-[#121419] border border-[rgba(255,255,255,0.1)] px-2 py-1 text-neutral-200 text-xs focus:outline-none focus:border-[#FF5A1F]"
          />
        </div>
      </div>

      {/* 5. Bottom Actions */}
      <div className="pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-2">
        {!isStreaming ? (
          <button
            onClick={onStart}
            className="w-full py-2 bg-[#FF5A1F] hover:bg-[#E04D18] text-white font-semibold text-xs tracking-wider transition-colors cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>▶</span>
            <span>START STREAM</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={isPaused ? onResume : onPause}
              className="py-1.5 bg-[#181C24] hover:bg-[#202530] text-neutral-200 border border-[rgba(255,255,255,0.15)] text-[11px] font-medium transition-colors cursor-pointer"
            >
              {isPaused ? 'RESUME' : 'PAUSE'}
            </button>
            <button
              onClick={onStop}
              className="py-1.5 bg-[#2A1515] hover:bg-[#381B1B] text-red-300 border border-red-900/50 text-[11px] font-medium transition-colors cursor-pointer"
            >
              STOP
            </button>
          </div>
        )}

        <button
          onClick={onExportCsv}
          className="w-full py-1.5 bg-[#121419] hover:bg-[#181B22] text-neutral-300 border border-[rgba(255,255,255,0.08)] text-[10px] tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
        >
          <span>EXPORT CSV</span>
        </button>
      </div>
    </aside>
  );
};
