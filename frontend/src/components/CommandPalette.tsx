import React, { useState, useEffect } from 'react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModel: (model: string) => void;
  onAdjustGate: (delta: number) => void;
  onTogglePlay: () => void;
  onExportCsv: () => void;
  onSelectSource: (source: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectModel,
  onAdjustGate,
  onTogglePlay,
  onExportCsv,
  onSelectSource,
}) => {
  const [query, setQuery] = useState('');

  // Handle escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { label: 'SWITCH MODEL: YOLOv8n (Nano - 7.76 FPS)', action: () => onSelectModel('yolov8n.pt'), shortcut: 'M1' },
    { label: 'SWITCH MODEL: YOLOv8s (Small - 5.30 FPS)', action: () => onSelectModel('yolov8s.pt'), shortcut: 'M2' },
    { label: 'SWITCH MODEL: YOLOv8m (Medium - 1.95 FPS)', action: () => onSelectModel('yolov8m.pt'), shortcut: 'M3' },
    { label: 'SOURCE: Urban Multi-Class Surveillance', action: () => onSelectSource('data/traffic_sample.mp4'), shortcut: 'S1' },
    { label: 'SOURCE: Highway Vehicles Feed', action: () => onSelectSource('data/car_detection.mp4'), shortcut: 'S2' },
    { label: 'GATE: Move Upward (-5% Y)', action: () => onAdjustGate(-0.05), shortcut: '↑' },
    { label: 'GATE: Move Downward (+5% Y)', action: () => onAdjustGate(0.05), shortcut: '↓' },
    { label: 'PLAYBACK: Toggle Pause / Resume', action: onTogglePlay, shortcut: 'Space' },
    { label: 'DATA: Export Telemetry CSV', action: onExportCsv, shortcut: 'E' },
  ];

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/75 flex items-start justify-center pt-24 z-50 select-none font-mono-numbers">
      <div className="w-full max-w-lg bg-[#111318] border border-[rgba(255,255,255,0.18)] shadow-2xl overflow-hidden">
        {/* Search Bar */}
        <div className="p-3 border-b border-[rgba(255,255,255,0.1)] flex items-center space-x-2">
          <span className="text-[#FF5A1F] font-bold text-xs">⌘</span>
          <input
            autoFocus
            type="text"
            placeholder="Type command or shortcut..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 text-xs focus:outline-none"
          />
          <kbd className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 border border-neutral-700">ESC</kbd>
        </div>

        {/* Action Items List */}
        <div className="max-h-72 overflow-y-auto p-1 divide-y divide-neutral-900/50">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500">No matching command found</div>
          ) : (
            filtered.map((item, i) => (
              <div
                key={i}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className="px-3 py-2 flex items-center justify-between text-xs text-neutral-300 hover:bg-[#1A1D26] hover:text-[#FF5A1F] cursor-pointer transition-colors"
              >
                <span>{item.label}</span>
                <span className="text-[9px] font-mono px-1 py-0.2 bg-neutral-800 border border-neutral-700 text-neutral-400">
                  {item.shortcut}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
