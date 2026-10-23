import React, { useState, useEffect } from 'react';

interface HeaderBarProps {
  isStreaming: boolean;
  isConnected: boolean;
  fps: number;
  latencyMs: number;
  onOpenPalette: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  isStreaming,
  isConnected,
  fps,
  latencyMs,
  onOpenPalette,
}) => {
  const [utcTime, setUtcTime] = useState<string>('00:00:00.000');

  useEffect(() => {
    let animId: number;
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      const ms = String(now.getUTCMilliseconds()).padStart(3, '0');
      setUtcTime(`${h}:${m}:${s}.${ms}`);
      animId = requestAnimationFrame(updateTime);
    };
    animId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <header className="h-12 border-b border-[rgba(236,232,246,0.09)] bg-[#0C0E16]/85 backdrop-blur-md px-4 flex items-center justify-between font-mono-data text-xs select-none z-40">
      {/* Brand & System Status */}
      <div className="flex items-center space-x-3">
        <span className="font-display font-extrabold tracking-tight text-sm text-[#ECE8F6]">
          URBAN SURVEILLANCE
        </span>
        <span className="text-[#8A90A6]/40 text-xs">/</span>
        <span className="text-[10px] tracking-widest text-[#8A90A6] uppercase">
          TELEMETRY CONSOLE
        </span>

        {/* Status Pill */}
        <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-[#05060A] border border-[rgba(236,232,246,0.09)] ml-2 text-[10px]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isStreaming
                ? 'bg-[#7F5AF0] shadow-[0_0_8px_#7F5AF0] animate-breathe'
                : isConnected
                ? 'bg-[#FFF1CC]'
                : 'bg-[#8A90A6]'
            }`}
          />
          <span className="text-[#ECE8F6] uppercase tracking-wider font-semibold">
            {isStreaming ? 'STREAM ACTIVE' : isConnected ? 'SYS ONLINE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Center UTC Surveillance Clock */}
      <div className="hidden md:flex items-center space-x-2 text-[#ECE8F6] text-xs font-semibold tracking-widest">
        <span className="text-[#8A90A6] text-[10px]">UTC</span>
        <span>{utcTime}</span>
      </div>

      {/* Right Controls: Telemetry, REC indicator, Cmd+K trigger */}
      <div className="flex items-center space-x-3">
        {/* Real-time FPS & Latency */}
        <div className="hidden sm:flex items-center space-x-2 text-[10px] text-[#8A90A6]">
          <span className="text-[#ECE8F6] font-semibold">{fps.toFixed(1)} FPS</span>
          <span className="text-[#8A90A6]/40">|</span>
          <span>{latencyMs}ms</span>
        </div>

        {/* REC Breathing dot */}
        {isStreaming && (
          <div className="flex items-center space-x-1 px-1.5 py-0.5 border border-[#FF3B30]/30 bg-[#FF3B30]/10 text-[9px] text-[#FF3B30] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-breathe" />
            <span>REC</span>
          </div>
        )}

        {/* Cmd+K shortcut trigger */}
        <button
          onClick={onOpenPalette}
          className="flex items-center space-x-1.5 px-2 py-1 bg-[#05060A] hover:bg-[#141724] border border-[rgba(236,232,246,0.12)] hover:border-[#7F5AF0] text-[#8A90A6] hover:text-[#ECE8F6] transition-all cursor-pointer text-[10px]"
        >
          <span>COMMANDS</span>
          <kbd className="px-1 py-0.2 bg-[#0C0E16] border border-[rgba(236,232,246,0.1)] text-[9px] text-[#7F5AF0]">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
};
