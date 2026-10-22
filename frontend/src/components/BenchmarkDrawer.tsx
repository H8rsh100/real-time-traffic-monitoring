import React, { useState } from 'react';

export const BenchmarkDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Exact benchmark numbers from our benchmark execution
  const benchmarks = [
    {
      model: 'YOLOv8n (Nano)',
      size_mb: 6.25,
      params_m: 3.16,
      fps: 7.76,
      latency_ms: 128.88,
      preprocess: 4.19,
      inference: 123.25,
      postprocess: 1.45,
      color: '#8EA695', // Sage
    },
    {
      model: 'YOLOv8s (Small)',
      size_mb: 21.54,
      params_m: 11.17,
      fps: 5.30,
      latency_ms: 188.67,
      preprocess: 3.02,
      inference: 184.61,
      postprocess: 1.04,
      color: '#8E9DAE', // Slate
    },
    {
      model: 'YOLOv8m (Medium)',
      size_mb: 49.72,
      params_m: 25.90,
      fps: 1.95,
      latency_ms: 511.68,
      preprocess: 4.14,
      inference: 505.83,
      postprocess: 1.71,
      color: '#B5A078', // Brass
    },
  ];

  return (
    <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] font-mono-numbers text-xs select-none">
      {/* Toggle Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between cursor-pointer hover:bg-[#15181F] transition-colors"
      >
        <div className="flex items-center space-x-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-300 font-semibold">
            DELIVERABLE 4: INFERENCE SPEED (FPS) VS MODEL SIZE BENCHMARK
          </span>
          <span className="text-[9px] px-1.5 py-0.2 bg-[#FF5A1F]/20 text-[#FF5A1F] border border-[#FF5A1F]/30 font-medium">
            3 MODELS TESTED
          </span>
        </div>
        <span className="text-neutral-400 text-[10px]">{isOpen ? '▼ COLLAPSE' : '▲ EXPAND'}</span>
      </div>

      {isOpen && (
        <div className="p-3 space-y-4">
          {/* 1. Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-[9px] uppercase tracking-wider text-neutral-400">
                  <th className="py-1">MODEL</th>
                  <th className="py-1">DISK (MB)</th>
                  <th className="py-1">PARAMS (M)</th>
                  <th className="py-1">FORWARD (MS)</th>
                  <th className="py-1">TOTAL (MS)</th>
                  <th className="py-1">THROUGHPUT</th>
                  <th className="py-1">SPEEDUP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 text-neutral-200">
                {benchmarks.map((b) => (
                  <tr key={b.model} className="hover:bg-neutral-900/40">
                    <td className="py-1 font-semibold">{b.model}</td>
                    <td className="py-1">{b.size_mb.toFixed(2)} MB</td>
                    <td className="py-1">{b.params_m.toFixed(2)} M</td>
                    <td className="py-1">{b.inference.toFixed(1)} ms</td>
                    <td className="py-1">{b.latency_ms.toFixed(1)} ms</td>
                    <td className="py-1 text-[#FF5A1F] font-semibold">{b.fps.toFixed(2)} FPS</td>
                    <td className="py-1 text-emerald-400 font-medium">
                      {(b.fps / 1.95).toFixed(2)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[rgba(255,255,255,0.06)]">
            {/* 2. Scatter Plot: Parameters (M) vs Throughput (FPS) */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
                SCATTER: PARAMETERS (M) VS THROUGHPUT (FPS)
              </span>
              <div className="relative w-full h-32 bg-[#0E1015] border border-[rgba(255,255,255,0.06)] p-2">
                <svg viewBox="0 0 300 110" className="w-full h-full overflow-visible">
                  {/* Axes */}
                  <line x1="30" y1="95" x2="290" y2="95" stroke="rgba(255,255,255,0.15)" />
                  <line x1="30" y1="10" x2="30" y2="95" stroke="rgba(255,255,255,0.15)" />

                  {/* Scatter Points */}
                  {benchmarks.map((b) => {
                    const cx = 30 + (b.params_m / 30) * 250;
                    const cy = 95 - (b.fps / 9) * 80;
                    return (
                      <g key={b.model}>
                        <circle cx={cx} cy={cy} r={b.size_mb / 8 + 3} fill={b.color} stroke="#FFFFFF" strokeWidth="1" />
                        <text x={cx + 6} y={cy - 2} fill="#EDEDED" fontSize="8" fontFamily="monospace">
                          {b.model.split(' ')[0]} ({b.fps.toFixed(1)} FPS)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* 3. Stacked Latency Breakdown */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
                STACKED LATENCY BREAKDOWN (MS)
              </span>
              <div className="space-y-2 pt-1">
                {benchmarks.map((b) => {
                  const maxLat = 520;
                  const prepW = (b.preprocess / maxLat) * 100;
                  const inferW = (b.inference / maxLat) * 100;
                  const postW = (b.postprocess / maxLat) * 100;

                  return (
                    <div key={b.model} className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>{b.model}</span>
                        <span>{b.latency_ms.toFixed(1)} ms total</span>
                      </div>
                      <div className="w-full h-2.5 bg-neutral-900 border border-[rgba(255,255,255,0.1)] flex overflow-hidden">
                        <div className="bg-sky-600/70" style={{ width: `${prepW}%` }} title="Preprocess" />
                        <div className="bg-[#FF5A1F]" style={{ width: `${inferW}%` }} title="Forward Pass" />
                        <div className="bg-purple-600/70" style={{ width: `${postW}%` }} title="Postprocess NMS" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
