import { useState, useEffect } from 'react';
import { useSurveillanceStream, type StreamConfig } from './hooks/useSurveillanceStream';
import type { ExposureDecay } from './types';
import { HeaderBar } from './components/HeaderBar';
import { ControlRail } from './components/ControlRail';
import { HeroViewport } from './components/HeroViewport';
import { TimelineScrubber } from './components/TimelineScrubber';
import { TelemetryDeck } from './components/TelemetryDeck';
import { EventTicker } from './components/EventTicker';
import { AnalyticsDeck } from './components/AnalyticsDeck';
import { BenchmarkDrawer } from './components/BenchmarkDrawer';
import { CommandPalette } from './components/CommandPalette';
import { AmbientCanvas } from './components/AmbientCanvas';

export function App() {
  const [config, setConfig] = useState<StreamConfig>({
    source: 'data/busy_traffic.mp4',
    model: 'yolov8n.pt',
    conf: 0.25,
    iou: 0.45,
    line_ratio: 0.50,
    max_frames: 335,
    renderMode: 'smooth',
  });

  const [exposureDecay, setExposureDecay] = useState<ExposureDecay>('medium');
  const [isExposureEnabled, setIsExposureEnabled] = useState<boolean>(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const {
    isConnected,
    isStreaming,
    isPaused,
    error,
    events,
    kpiCounts,
    sessionFrames,
    replayIndex,
    currentTelemetryRef,
    prevTelemetryRef,
    currentBitmapRef,
    prevBitmapRef,
    packetTimestampsRef,
    startStream,
    disconnect,
    pause,
    resume,
    setGate,
    seekToFrame,
    isMockMode,
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

  const handleConfigChange = (updates: Partial<StreamConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      if (updates.line_ratio !== undefined) {
        setGate(updates.line_ratio);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#05060A] text-[#ECE8F6] flex flex-col font-sans antialiased relative overflow-hidden">
      {/* Background Ambient Layer (Bokeh + Rain Streaks) */}
      <AmbientCanvas />

      {/* Header Bar */}
      <HeaderBar
        isStreaming={isStreaming}
        isConnected={isConnected || isMockMode}
        fps={kpiCounts.fps}
        latencyMs={kpiCounts.latency_ms}
        onOpenPalette={() => setIsPaletteOpen(true)}
      />

      {/* Main Command Center Layout */}
      <div className="flex-1 flex overflow-hidden z-10 relative">
        {/* Left Control Rail */}
        <ControlRail
          config={config}
          onChangeConfig={handleConfigChange}
          isStreaming={isStreaming}
          isPaused={isPaused}
          onStart={handleStart}
          onStop={handleStop}
          onPause={pause}
          onResume={resume}
          onExportCsv={handleExportCsv}
          exposureDecay={exposureDecay}
          onChangeDecay={setExposureDecay}
          isExposureEnabled={isExposureEnabled}
          onToggleExposure={() => setIsExposureEnabled((prev) => !prev)}
        />

        {/* Center Hero Column */}
        <main className="flex-1 flex flex-col p-3 overflow-y-auto space-y-3 min-w-0">
          {/* Error Banner */}
          {error && (
            <div className="px-3.5 py-2 bg-[#FF3B30]/15 border border-[#FF3B30] text-[#FF3B30] text-xs font-mono-data flex items-center justify-between">
              <span>⚠ {error}</span>
              <button
                onClick={() => handleStart()}
                className="underline hover:text-white cursor-pointer"
              >
                Retry Stream
              </button>
            </div>
          )}

          {/* Three-Layer Photographic Viewport */}
          <HeroViewport
            currentTelemetryRef={currentTelemetryRef}
            prevTelemetryRef={prevTelemetryRef}
            currentBitmapRef={currentBitmapRef}
            prevBitmapRef={prevBitmapRef}
            packetTimestampsRef={packetTimestampsRef}
            isStreaming={isStreaming}
            isPaused={isPaused}
            selectedModel={config.model}
            renderMode={config.renderMode}
            exposureDecay={exposureDecay}
            isExposureEnabled={isExposureEnabled}
          />

          {/* Timeline Scrubber */}
          <TimelineScrubber
            sessionFrames={sessionFrames}
            events={events}
            currentIndex={replayIndex}
            onSeek={seekToFrame}
            isStreaming={isStreaming}
          />

          {/* KPI Odometer Telemetry Deck */}
          <TelemetryDeck
            vehicleCount={kpiCounts.vehicle}
            pedestrianCount={kpiCounts.pedestrian}
            cyclistCount={kpiCounts.cyclist}
            fps={kpiCounts.fps}
            latencyMs={kpiCounts.latency_ms}
          />

          {/* Hardware Benchmark Drawer */}
          <BenchmarkDrawer
            isOpen={isDrawerOpen}
            onToggle={() => setIsDrawerOpen((prev) => !prev)}
          />
        </main>

        {/* Right Optical Telemetry & Analytics Column */}
        <aside className="w-80 xl:w-96 flex-shrink-0 border-l border-[rgba(236,232,246,0.09)] bg-[#0C0E16]/85 backdrop-blur-md flex flex-col p-3 space-y-3 overflow-y-auto">
          {/* Event Ticker */}
          <div className="flex-1 min-h-[280px]">
            <EventTicker events={events} onSeekToFrame={seekToFrame} />
          </div>

          {/* Spatial & Flow Analytics */}
          <AnalyticsDeck events={events} />
        </aside>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        config={config}
        onChangeConfig={handleConfigChange}
        isStreaming={isStreaming}
        isPaused={isPaused}
        onStart={handleStart}
        onStop={handleStop}
        onPause={pause}
        onResume={resume}
        onExportCsv={handleExportCsv}
        isExposureEnabled={isExposureEnabled}
        onToggleExposure={() => setIsExposureEnabled((prev) => !prev)}
      />
    </div>
  );
}
export default App;
