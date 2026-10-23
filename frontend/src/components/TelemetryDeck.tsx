import React, { useRef, useEffect } from 'react';

interface TelemetryDeckProps {
  vehicleCount: number;
  pedestrianCount: number;
  cyclistCount: number;
  fps: number;
  latencyMs: number;
}

export const TelemetryDeck: React.FC<TelemetryDeckProps> = ({
  vehicleCount,
  pedestrianCount,
  cyclistCount,
  fps,
  latencyMs,
}) => {
  // Sparkline history buffers (30 samples)
  const vehHistory = useRef<number[]>(Array(30).fill(0));
  const pedHistory = useRef<number[]>(Array(30).fill(0));
  const cycHistory = useRef<number[]>(Array(30).fill(0));
  const fpsHistory = useRef<number[]>(Array(30).fill(fps || 13));

  useEffect(() => {
    vehHistory.current = [...vehHistory.current.slice(1), vehicleCount];
    pedHistory.current = [...pedHistory.current.slice(1), pedestrianCount];
    cycHistory.current = [...cycHistory.current.slice(1), cyclistCount];
    fpsHistory.current = [...fpsHistory.current.slice(1), fps];
  }, [vehicleCount, pedestrianCount, cyclistCount, fps]);

  const renderSparkline = (data: number[], color: string, glowColor: string) => {
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const w = 120;
    const h = 28;

    const points = data
      .map((val, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((val - min) / range) * (h - 6) - 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg className="w-full h-7 overflow-visible" viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <filter id={`glow-${color.replace('#', '')}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={glowColor} floodOpacity="0.6" />
          </filter>
        </defs>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          points={points}
          filter={`url(#glow-${color.replace('#', '')})`}
        />
      </svg>
    );
  };

  const cards = [
    {
      label: 'VEHICLES // INBOUND & OUT',
      glyph: '▲',
      value: vehicleCount,
      sub: 'Multi-lane traffic flow',
      color: '#FFB347',
      glow: '#FFB347',
      data: vehHistory.current,
    },
    {
      label: 'PEDESTRIANS // CROSSWALK',
      glyph: '●',
      value: pedestrianCount,
      sub: 'Zebra crossing zone',
      color: '#4FD1FF',
      glow: '#4FD1FF',
      data: pedHistory.current,
    },
    {
      label: 'CYCLISTS // BIKE CORRIDOR',
      glyph: '◆',
      value: cyclistCount,
      sub: 'Lateral lane filter',
      color: '#B6FF4F',
      glow: '#B6FF4F',
      data: cycHistory.current,
    },
    {
      label: 'ENGINE THROUGHPUT',
      glyph: '⚡',
      value: `${fps.toFixed(1)} FPS`,
      sub: `${latencyMs}ms forward latency`,
      color: '#7F5AF0',
      glow: '#7F5AF0',
      data: fpsHistory.current,
    },
  ];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 font-mono-data select-none">
      {cards.map((card, i) => (
        <div
          key={i}
          className="relative bg-[#0C0E16]/75 backdrop-blur-md border border-[rgba(236,232,246,0.09)] p-3.5 flex flex-col justify-between overflow-hidden"
        >
          {/* Top Label with Class Glyph */}
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(236,232,246,0.06)]">
            <span className="text-[10px] uppercase tracking-wider text-[#8A90A6] flex items-center space-x-1.5">
              <span style={{ color: card.color }}>{card.glyph}</span>
              <span>{card.label}</span>
            </span>
          </div>

          {/* Odometer readout + Sparkline */}
          <div className="py-2.5 flex items-baseline justify-between">
            <span
              className="text-2xl lg:text-3xl font-bold tracking-tight text-[#ECE8F6]"
              style={{ textShadow: `0 0 16px ${card.color}25` }}
            >
              {card.value}
            </span>
            <div className="w-24 lg:w-28 opacity-85">
              {renderSparkline(card.data, card.color, card.glow)}
            </div>
          </div>

          {/* Subtitle / Context */}
          <div className="text-[10px] text-[#8A90A6] tracking-wide pt-1 border-t border-[rgba(236,232,246,0.04)]">
            {card.sub}
          </div>
        </div>
      ))}
    </section>
  );
};
