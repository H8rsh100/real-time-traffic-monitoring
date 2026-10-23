import React, { useState, useEffect } from 'react';
import type { StreamConfig } from '../hooks/useSurveillanceStream';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  config: StreamConfig;
  onChangeConfig: (updates: Partial<StreamConfig>) => void;
  isStreaming: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onExportCsv: () => void;
  isExposureEnabled: boolean;
  onToggleExposure: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  isStreaming,
  isPaused,
  onStart,
  onStop,
  onPause,
  onResume,
  onExportCsv,
  isExposureEnabled,
  onToggleExposure,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'stream_toggle',
      label: isStreaming ? 'Stop Optical Stream' : 'Start Optical Stream',
      sub: isStreaming ? 'Terminate active WebSocket' : 'Initialize feed stream',
      action: () => {
        if (isStreaming) onStop();
        else onStart();
        onClose();
      },
    },
    {
      id: 'pause_toggle',
      label: isPaused ? 'Resume Optical Stream' : 'Freeze Exposure / Pause',
      sub: 'Halt stream generation and freeze trails',
      action: () => {
        if (isPaused) onResume();
        else onPause();
        onClose();
      },
    },
    {
      id: 'toggle_exposure',
      label: isExposureEnabled ? 'Disable Long Exposure Glow' : 'Enable Long Exposure Glow',
      sub: 'Toggle light accumulation trail buffer',
      action: () => {
        onToggleExposure();
        onClose();
      },
    },
    {
      id: 'toggle_smooth',
      label: config.renderMode === 'smooth' ? 'Switch to RAW Stream (13Hz)' : 'Switch to SMOOTH Mode (60Hz)',
      sub: 'Toggle packet interpolation and frame crossfade',
      action: () => {
        onChangeConfig({ renderMode: config.renderMode === 'smooth' ? 'raw' : 'smooth' });
        onClose();
      },
    },
    {
      id: 'model_n',
      label: 'Select YOLOv8n (Nano)',
      sub: '3.16M params // 7.76 FPS throughput',
      action: () => {
        onChangeConfig({ model: 'yolov8n.pt' });
        onClose();
      },
    },
    {
      id: 'model_s',
      label: 'Select YOLOv8s (Small)',
      sub: '11.17M params // 5.30 FPS throughput',
      action: () => {
        onChangeConfig({ model: 'yolov8s.pt' });
        onClose();
      },
    },
    {
      id: 'model_m',
      label: 'Select YOLOv8m (Medium)',
      sub: '25.90M params // 1.95 FPS throughput',
      action: () => {
        onChangeConfig({ model: 'yolov8m.pt' });
        onClose();
      },
    },
    {
      id: 'feed_busy',
      label: 'Feed: Busy Multi-Lane Traffic',
      sub: 'data/busy_traffic.mp4 (11+ verified crossings)',
      action: () => {
        onChangeConfig({ source: 'data/busy_traffic.mp4' });
        onClose();
      },
    },
    {
      id: 'export_csv',
      label: 'Export Session Telemetry to CSV',
      sub: 'Download logged vehicle crossing events',
      action: () => {
        onExportCsv();
        onClose();
      },
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.sub.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-[#05060A]/80 backdrop-blur-md flex items-center justify-center p-4 font-mono-data"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0C0E16] border border-[#7F5AF0] shadow-[0_0_32px_rgba(127,90,240,0.3)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="p-3 border-b border-[rgba(236,232,246,0.09)] flex items-center space-x-2">
          <span className="text-[#7F5AF0]">⌘</span>
          <input
            type="text"
            placeholder="Type a command or search action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-[#ECE8F6] text-xs focus:outline-none placeholder-[#8A90A6]/60"
          />
          <span className="text-[10px] text-[#8A90A6] border border-[rgba(236,232,246,0.1)] px-1.5 py-0.5">
            ESC
          </span>
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto divide-y divide-[rgba(236,232,246,0.03)] text-xs">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-[#8A90A6]">No matching commands</div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={item.action}
                className="p-3 hover:bg-[#7F5AF0]/15 cursor-pointer flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="text-[#ECE8F6] font-medium">{item.label}</div>
                  <div className="text-[10px] text-[#8A90A6]">{item.sub}</div>
                </div>
                <span className="text-[10px] text-[#7F5AF0]">↵ RUN</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
