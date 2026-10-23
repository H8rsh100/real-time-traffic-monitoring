import React from 'react';
import type { StreamConfig } from '../hooks/useSurveillanceStream';
import type { ExposureDecay } from '../types';

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
  exposureDecay: ExposureDecay;
  onChangeDecay: (decay: ExposureDecay) => void;
  isExposureEnabled: boolean;
  onToggleExposure: () => void;
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
  exposureDecay,
  onChangeDecay,
  isExposureEnabled,
  onToggleExposure,
}) => {
  return (
    <aside className="w-64 xl:w-72 flex-shrink-0 bg-[#0C0E16]/85 backdrop-blur-md border-r border-[rgba(236,232,246,0.09)] flex flex-col justify-between font-mono-data text-xs select-none p-3.5 overflow-y-auto">
      <div className="space-y-4">
        {/* Rail Title */}
        <div className="pb-2 border-b border-[rgba(236,232,246,0.06)] flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#8A90A6]">
            OPTICAL CONTROL RAIL
          </span>
          <span className="text-[9px] px-1.5 py-0.2 bg-[#05060A] text-[#7F5AF0] border border-[#7F5AF0]/30 font-semibold">
            CLASS-LEVEL
          </span>
        </div>

        {/* 1. Feed Source Presets */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-[#8A90A6]">
            SURVEILLANCE FEED
          </label>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            {[
              { id: 'data/busy_traffic.mp4', label: 'BUSY', sub: 'Multi-Lane' },
              { id: 'data/traffic_sample.mp4', label: 'URBAN', sub: 'Crosswalk' },
              { id: 'data/car_detection.mp4', label: 'HIGHWAY', sub: 'Freeway' },
            ].map((src) => {
              const isSelected = config.source.includes(src.id);
              return (
                <button
                  key={src.id}
                  onClick={() => onChangeConfig({ source: src.id })}
                  className={`px-1.5 py-2 text-left border cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-[#141724] border-[#7F5AF0] text-[#ECE8F6] shadow-[0_0_8px_rgba(127,90,240,0.3)]'
                      : 'bg-[#05060A] border-[rgba(236,232,246,0.08)] text-[#8A90A6] hover:text-[#ECE8F6]'
                  }`}
                >
                  <div className="font-bold tracking-wider">{src.label}</div>
                  <div className="text-[8px] text-[#8A90A6]/70 truncate">{src.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Model Tier Selection with Glowing Meters */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-[#8A90A6]">
            YOLOv8 MODEL ARCHITECTURE
          </label>
          <div className="space-y-1">
            {[
              { id: 'yolov8n.pt', name: 'YOLOv8n (Nano)', params: '3.16M', fps: 7.76, lat: '128.9ms', pct: 100 },
              { id: 'yolov8s.pt', name: 'YOLOv8s (Small)', params: '11.17M', fps: 5.30, lat: '188.7ms', pct: 68 },
              { id: 'yolov8m.pt', name: 'YOLOv8m (Medium)', params: '25.90M', fps: 1.95, lat: '511.7ms', pct: 25 },
            ].map((m) => {
              const isSelected = config.model === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onChangeConfig({ model: m.id })}
                  className={`w-full p-2 text-left border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#141724] border-[#7F5AF0] text-[#ECE8F6] shadow-[0_0_8px_rgba(127,90,240,0.25)]'
                      : 'bg-[#05060A] border-[rgba(236,232,246,0.08)] text-[#8A90A6] hover:text-[#ECE8F6]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span>{m.name}</span>
                    <span className="text-[#FFF1CC]">{m.fps} FPS</span>
                  </div>
                  {/* Glowing Meter bar */}
                  <div className="mt-1.5 h-1 w-full bg-[rgba(236,232,246,0.06)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7F5AF0] transition-all duration-300"
                      style={{ width: `${m.pct}%`, boxShadow: isSelected ? '0 0 6px #7F5AF0' : 'none' }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Smooth Mode vs Raw Toggle */}
        <div className="p-2 border border-[rgba(236,232,246,0.08)] bg-[#05060A] flex items-center justify-between">
          <span className="text-[10px] uppercase text-[#8A90A6]">INTERPOLATION</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onChangeConfig({ renderMode: 'raw' })}
              className={`px-2 py-0.5 text-[9px] border ${
                config.renderMode === 'raw'
                  ? 'border-[#ECE8F6] text-[#ECE8F6] bg-[rgba(236,232,246,0.1)]'
                  : 'border-transparent text-[#8A90A6]'
              }`}
            >
              RAW 13Hz
            </button>
            <button
              onClick={() => onChangeConfig({ renderMode: 'smooth' })}
              className={`px-2 py-0.5 text-[9px] border font-bold ${
                config.renderMode === 'smooth'
                  ? 'border-[#7F5AF0] text-[#7F5AF0] bg-[#7F5AF0]/20 shadow-[0_0_8px_rgba(127,90,240,0.4)]'
                  : 'border-transparent text-[#8A90A6]'
              }`}
            >
              SMOOTH 60Hz
            </button>
          </div>
        </div>

        {/* 4. Long Exposure Decay Controls */}
        <div className="p-2 border border-[rgba(236,232,246,0.08)] bg-[#05060A] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-[#8A90A6]">LONG EXPOSURE</span>
            <button
              onClick={onToggleExposure}
              className={`px-1.5 py-0.5 text-[9px] font-bold border ${
                isExposureEnabled
                  ? 'border-[#FFF1CC] text-[#FFF1CC] bg-[#FFF1CC]/15 shadow-[0_0_8px_rgba(255,241,204,0.3)]'
                  : 'border-[rgba(236,232,246,0.1)] text-[#8A90A6]'
              }`}
            >
              {isExposureEnabled ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          {isExposureEnabled && (
            <div className="grid grid-cols-3 gap-1 pt-1">
              {(['short', 'medium', 'long'] as ExposureDecay[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onChangeDecay(d)}
                  className={`py-1 text-[9px] uppercase border text-center ${
                    exposureDecay === d
                      ? 'border-[#7F5AF0] text-[#ECE8F6] bg-[#7F5AF0]/20'
                      : 'border-[rgba(236,232,246,0.06)] text-[#8A90A6]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. Custom Gate Position & Threshold Sliders */}
        <div className="space-y-2.5 pt-1 border-t border-[rgba(236,232,246,0.06)]">
          {/* Gate Position with Live Mini Frame Preview */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-[#8A90A6]">GATE Y-AXIS</span>
              <span className="text-[#FFF1CC] font-bold">{(config.line_ratio * 100).toFixed(0)}%</span>
            </div>
            {/* Tiny live frame preview */}
            <div className="relative h-7 w-full bg-[#05060A] border border-[rgba(236,232,246,0.1)] overflow-hidden">
              <div
                className="absolute left-0 right-0 h-[1.5px] bg-[#7F5AF0] shadow-[0_0_6px_#7F5AF0]"
                style={{ top: `${config.line_ratio * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={20}
              max={85}
              value={Math.round(config.line_ratio * 100)}
              onChange={(e) => onChangeConfig({ line_ratio: Number(e.target.value) / 100 })}
              className="w-full h-1 bg-[rgba(236,232,246,0.1)] appearance-none accent-[#7F5AF0] cursor-pointer"
            />
          </div>

          {/* Confidence Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-[#8A90A6]">CONFIDENCE</span>
              <span className="text-[#ECE8F6]">{(config.conf * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={15}
              max={90}
              value={Math.round(config.conf * 100)}
              onChange={(e) => onChangeConfig({ conf: Number(e.target.value) / 100 })}
              className="w-full h-1 bg-[rgba(236,232,246,0.1)] appearance-none accent-[#7F5AF0] cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Stream Action Controls */}
      <div className="space-y-2 pt-3 border-t border-[rgba(236,232,246,0.08)]">
        {!isStreaming ? (
          <button
            onClick={onStart}
            className="w-full py-2.5 bg-[#7F5AF0] hover:bg-[#6e46e8] text-white font-bold tracking-widest text-xs uppercase cursor-pointer transition-all shadow-[0_0_16px_rgba(127,90,240,0.5)] flex items-center justify-center space-x-2"
          >
            <span>▶ START STREAM</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={isPaused ? onResume : onPause}
              className="py-2 bg-[#05060A] border border-[rgba(236,232,246,0.18)] hover:bg-[#12141f] text-[#ECE8F6] font-semibold text-[10px] tracking-wider uppercase cursor-pointer"
            >
              {isPaused ? '▶ RESUME' : '❚❚ PAUSE'}
            </button>
            <button
              onClick={onStop}
              className="py-2 bg-[#FF3B30]/15 border border-[#FF3B30] hover:bg-[#FF3B30]/30 text-[#FF3B30] font-semibold text-[10px] tracking-wider uppercase cursor-pointer shadow-[0_0_10px_rgba(255,59,48,0.3)]"
            >
              ■ STOP
            </button>
          </div>
        )}

        <button
          onClick={onExportCsv}
          className="w-full py-1.5 bg-[#05060A] border border-[rgba(236,232,246,0.08)] hover:border-[rgba(236,232,246,0.2)] text-[#8A90A6] hover:text-[#ECE8F6] text-[10px] uppercase tracking-wider cursor-pointer transition-colors"
        >
          EXPORT TELEMETRY CSV
        </button>
      </div>
    </aside>
  );
};
