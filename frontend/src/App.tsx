import { useState, useEffect } from 'react';
import { useSurveillanceStream, type StreamConfig } from './hooks/useSurveillanceStream';
import { HeaderBar } from './components/HeaderBar';
import { ControlRail } from './components/ControlRail';
import { HeroViewport } from './components/HeroViewport';
import { TimelineScrubber } from './components/TimelineScrubber';
import { TelemetryDeck } from './components/TelemetryDeck';
import { EventTicker } from './components/EventTicker';
import { AnalyticsDeck } from './components/AnalyticsDeck';
import { BenchmarkDrawer } from './components/BenchmarkDrawer';
import { CommandPalette } from './components/CommandPalette';

export function App() {
  const [config, setConfig] = useState<StreamConfig>({
    source: 'data/traffic_sample.mp4',
    model: 'yolov8n.pt',
    conf: 0.25,
    iou: 0.45,
    line_ratio: 0.55,
    max_frames: 200,
  });

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const {
    isStreaming,
    isPaused,
    telemetry,
    events,
    sessionFrames,
    replayIndex,
    currentBitmap,
    startStream,
    disconnect,
    pause,
    resume,
    setGate,
    seekToFrame,
  } = useSurveillanceStream();

  // Keyboard Shortcuts (Cmd+K, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      } else if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        if (isStreaming) {
          if (isPaused) resume();
          else pause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, isPaused, pause, resume]);

  const handleStart = () => {
    startStream(config);
  };

  const handleStop = () => {
    disconnect();
  };

  const handleExportCsv = () => {
    window.open('http://localhost:8080/api/export-csv', '_blank');
  };

  const handleAdjustGate = (delta: number) => {
    const newRatio = Math.max(0.15, Math.min(0.85, config.line_ratio + delta));
    setConfig((prev) => ({ ...prev, line_ratio: newRatio }));
    setGate(newRatio);
  };

  const counts = telemetry?.counts ?? {
    total: 0,
    in: 0,
    out: 0,
    vehicle: 0,
    pedestrian: 0,
    cyclist: 0,
  };

  const currentFrameIdx = telemetry?.frame_idx ?? 0;
  const totalFrames = telemetry?.total_frames ?? (config.max_frames || 647);

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#EDEDED] flex flex-col font-mono-numbers antialiased">
      {/* 1. Header Bar */}
      <HeaderBar
        isStreaming={isStreaming}
        telemetry={telemetry}
        selectedModel={config.model}
        onOpenPalette={() => setIsPaletteOpen(true)}
      />

      {/* 2. Main Workspace */}
      <div className="flex-grow flex overflow-hidden">
        {/* Left: Control Rail */}
        <ControlRail
          config={config}
          onChangeConfig={(up) => {
            setConfig((prev) => ({ ...prev, ...up }));
            if (up.line_ratio !== undefined) setGate(up.line_ratio);
          }}
          isStreaming={isStreaming}
          isPaused={isPaused}
          onStart={handleStart}
          onStop={handleStop}
          onPause={pause}
          onResume={resume}
          onExportCsv={handleExportCsv}
        />

        {/* Center & Right Content Grid */}
        <main className="flex-grow flex flex-col p-3 space-y-3 overflow-y-auto">
          {/* Top Section: Hero Viewport + Live Event Terminal */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            {/* Left 8 Cols: Video Viewport & Scrubber */}
            <div className="lg:col-span-8 flex flex-col space-y-0">
              <HeroViewport
                currentBitmap={currentBitmap}
                telemetry={telemetry}
                isStreaming={isStreaming}
                selectedModel={config.model}
              />
              <TimelineScrubber
                currentFrameIdx={currentFrameIdx}
                totalFrames={totalFrames}
                sessionFrames={sessionFrames}
                events={events}
                replayIndex={replayIndex}
                onSeek={seekToFrame}
              />
            </div>

            {/* Right 4 Cols: Live Terminal Event Ticker */}
            <div className="lg:col-span-4 h-[380px] lg:h-[456px]">
              <EventTicker events={events} onSeek={seekToFrame} />
            </div>
          </div>

          {/* Middle Section: KPI Rolling Counters & Sparklines */}
          <TelemetryDeck counts={counts} />

          {/* Bottom Section 1: Analytics Deck (Split Bar, Flow Stream, Heatmap) */}
          <AnalyticsDeck counts={counts} events={events} />

          {/* Bottom Section 2: Model Benchmark Comparison Drawer */}
          <BenchmarkDrawer />
        </main>
      </div>

      {/* 3. Command Palette Modal (Cmd+K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onSelectModel={(model) => setConfig((prev) => ({ ...prev, model }))}
        onAdjustGate={handleAdjustGate}
        onTogglePlay={() => (isPaused ? resume() : pause())}
        onExportCsv={handleExportCsv}
        onSelectSource={(source) => setConfig((prev) => ({ ...prev, source }))}
      />
    </div>
  );
}

export default App;
