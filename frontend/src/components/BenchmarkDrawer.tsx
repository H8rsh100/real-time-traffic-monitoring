import React, { useState } from 'react';

interface BenchmarkDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const BenchmarkDrawer: React.FC<BenchmarkDrawerProps> = ({ isOpen, onToggle }) => {
  const [activeTab, setActiveTab] = useState<'scatter' | 'latency'>('scatter');

  // Real benchmark figures measured on Intel Core Ultra 5 125H
  const models = [
    { name: 'YOLOv8n', params: 3.16, fps: 7.76, lat: 128.9, pre: 2.1, fwd: 124.8, post: 2.0, color: '#7F5AF0' },
    { name: 'YOLOv8s', params: 11.17, fps: 5.30, lat: 188.7, pre: 2.3, fwd: 184.2, post: 2.2, color: '#FFF1CC' },
    { name: 'YOLOv8m', params: 25.90, fps: 1.95, lat: 511.7, pre: 3.2, fwd: 505.4, post: 3.1, color: '#FF3B30' },
  ];

  return (
    <div className="w-full bg-[#0C0E16]/90 backdrop-blur-md border-t border-[rgba(236,232,246,0.09)] font-mono-data text-xs select-none">
      {/* Toggle Bar */}
      <button
        onClick={onToggle}
        className="w-full py-2 px-4 flex items-center justify-between text-[#8A90A6] hover:text-[#ECE8F6] bg-[#05060A]/70 cursor-pointer border-b border-[rgba(236,232,246,0.04)]"
      >
        <div className="flex items-center space-x-2">
          <span className="text-[#7F5AF0]">⚡</span>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
            HARDWARE PROFILING & BENCHMARKS (DELIVERABLE 4)
          </span>
        </div>
        <span className="text-xs">{isOpen ? '▼ COLLAPSE' : '▲ EXPAND DRAWER'}</span>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4">
          <div className="flex space-x-2 border-b border-[rgba(236,232,246,0.06)] pb-2 text-[11px]">
            <button
              onClick={() => setActiveTab('scatter')}
              className={`px-3 py-1 border transition-all ${
                activeTab === 'scatter'
                  ? 'border-[#7F5AF0] text-[#ECE8F6] bg-[#7F5AF0]/20'
                  : 'border-transparent text-[#8A90A6]'
              }`}
            >
              PARAMETERS VS. INFERENCE FPS
            </button>
            <button
              onClick={() => setActiveTab('latency')}
              className={`px-3 py-1 border transition-all ${
                activeTab === 'latency'
                  ? 'border-[#7F5AF0] text-[#ECE8F6] bg-[#7F5AF0]/20'
                  : 'border-transparent text-[#8A90A6]'
              }`}
            >
              LATENCY STACK BREAKDOWN (MS)
            </button>
          </div>

          {activeTab === 'scatter' ? (
            <div className="h-44 w-full bg-[#05060A] border border-[rgba(236,232,246,0.08)] p-3 relative">
              <svg className="w-full h-full" viewBox="0 0 500 120">
                {/* Axes */}
                <line x1="40" y1="10" x2="40" y2="100" stroke="rgba(236,232,246,0.15)" strokeWidth="1" />
                <line x1="40" y1="100" x2="480" y2="100" stroke="rgba(236,232,246,0.15)" strokeWidth="1" />

                {/* Gridlines */}
                <line x1="40" y1="55" x2="480" y2="55" stroke="rgba(236,232,246,0.05)" strokeDasharray="2 2" />

                {/* Y-axis labels */}
                <text x="32" y="15" fill="#8A90A6" fontSize="8" textAnchor="end">8 FPS</text>
                <text x="32" y="58" fill="#8A90A6" fontSize="8" textAnchor="end">5 FPS</text>
                <text x="32" y="102" fill="#8A90A6" fontSize="8" textAnchor="end">0 FPS</text>

                {/* Scatter Points */}
                {models.map((m, i) => {
                  // X: params 3M to 26M -> map to 80 to 440
                  const cx = 80 + (m.params / 26) * 360;
                  // Y: fps 0 to 8 -> map to 100 to 20
                  const cy = 100 - (m.fps / 8) * 80;

                  return (
                    <g key={i}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r="5"
                        fill={m.color}
                        style={{ filter: `drop-shadow(0 0 8px ${m.color})` }}
                      />
                      <text x={cx + 8} y={cy + 3} fill="#ECE8F6" fontSize="9" fontWeight="600">
                        {m.name} ({m.fps} FPS)
                      </text>
                      <text x={cx + 8} y={cy + 13} fill="#8A90A6" fontSize="8">
                        {m.params}M params
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="space-y-3 bg-[#05060A] border border-[rgba(236,232,246,0.08)] p-3">
              {models.map((m, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="font-semibold text-[#ECE8F6]">{m.name}</span>
                    <span className="text-[#8A90A6]">{m.lat}ms total latency</span>
                  </div>
                  {/* Stacked Bar */}
                  <div className="h-3 w-full bg-[rgba(236,232,246,0.06)] flex overflow-hidden rounded-[1px]">
                    <div style={{ width: `${(m.pre / m.lat) * 100}%` }} className="bg-[#4FD1FF]" title={`Preprocess: ${m.pre}ms`} />
                    <div style={{ width: `${(m.fwd / m.lat) * 100}%` }} className="bg-[#7F5AF0]" title={`Forward Pass: ${m.fwd}ms`} />
                    <div style={{ width: `${(m.post / m.lat) * 100}%` }} className="bg-[#FFF1CC]" title={`Postprocess: ${m.post}ms`} />
                  </div>
                </div>
              ))}
              <div className="flex items-center space-x-4 pt-1 text-[9px] text-[#8A90A6]">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-[#4FD1FF]" />
                  <span>PREPROCESS (~2%)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-[#7F5AF0]" />
                  <span>FORWARD PASS (&gt;95%)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-[#FFF1CC]" />
                  <span>NMS POSTPROCESS (~3%)</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
