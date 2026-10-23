import { useState, useEffect, useRef, useCallback } from 'react';
import type { Telemetry, CrossingEvent, SessionFrame, RenderMode } from '../types';
import { createMockFrame, createMockBitmap } from '../mockFixture';

export interface StreamConfig {
  source: string;
  model: string;
  conf: number;
  iou: number;
  line_ratio: number;
  max_frames: number;
  renderMode: RenderMode;
}

export function useSurveillanceStream() {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Throttled UI state (updated only on crossing events or periodically for KPI odometers)
  const [events, setEvents] = useState<CrossingEvent[]>([]);
  const [kpiCounts, setKpiCounts] = useState({
    vehicle: 0,
    pedestrian: 0,
    cyclist: 0,
    fps: 0,
    latency_ms: 0,
    timecode: '00:00:00',
  });

  // Replay & Scrubber Session Cache
  const [sessionFrames, setSessionFrames] = useState<SessionFrame[]>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  // High-frequency refs for ZERO React re-render per frame
  const wsRef = useRef<WebSocket | null>(null);
  const currentTelemetryRef = useRef<Telemetry | null>(null);
  const prevTelemetryRef = useRef<Telemetry | null>(null);
  const currentBitmapRef = useRef<ImageBitmap | null>(null);
  const prevBitmapRef = useRef<ImageBitmap | null>(null);
  const packetTimestampsRef = useRef<{ prev: number; curr: number }>({ prev: 0, curr: 0 });
  const textDecoderRef = useRef(new TextDecoder('utf-8'));
  const mockIntervalRef = useRef<number | null>(null);
  const lastKpiUpdateRef = useRef<number>(0);

  // Check if ?mock=1 is in URL
  const isMockMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mock') === '1';

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mockIntervalRef.current) {
      window.clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
    setIsConnected(false);
    setIsStreaming(false);
  }, []);

  // Connect & Start Stream
  const startStream = useCallback(async (config: StreamConfig) => {
    disconnect();
    setError(null);
    setSessionFrames([]);
    setEvents([]);
    setReplayIndex(null);

    if (isMockMode) {
      setIsConnected(true);
      setIsStreaming(true);
      setIsPaused(false);

      let mockFrameIdx = 0;
      const mockBitmap = await createMockBitmap(960, 540);
      currentBitmapRef.current = mockBitmap;

      mockIntervalRef.current = window.setInterval(() => {
        const telem = createMockFrame(mockFrameIdx, 335);
        prevTelemetryRef.current = currentTelemetryRef.current || telem;
        currentTelemetryRef.current = telem;

        const now = performance.now();
        packetTimestampsRef.current = {
          prev: packetTimestampsRef.current.curr || now - 76,
          curr: now,
        };

        if (telem.events && telem.events.length > 0) {
          setEvents((prev) => [...prev, ...telem.events]);
        }

        // Throttle UI odometer rolls to ~4Hz
        if (now - lastKpiUpdateRef.current > 250) {
          lastKpiUpdateRef.current = now;
          setKpiCounts({
            vehicle: telem.counts.vehicle,
            pedestrian: telem.counts.pedestrian,
            cyclist: telem.counts.cyclist,
            fps: Number(telem.fps.toFixed(1)),
            latency_ms: Math.round(telem.latency_ms),
            timecode: new Date(telem.timestamp_sec * 1000).toISOString().substr(11, 8),
          });
        }

        mockFrameIdx = (mockFrameIdx + 1) % 335;
      }, 76); // ~13.1 FPS
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const wsUrl = `${protocol}//${host}:8080/ws/stream`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsStreaming(true);
      setIsPaused(false);
      ws.send(JSON.stringify(config));
    };

    ws.onmessage = async (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.error) setError(parsed.error);
        } catch {
          // ignore
        }
        return;
      }

      // Binary Packet Processing
      const buffer = event.data as ArrayBuffer;
      if (buffer.byteLength < 16) return;

      const view = new DataView(buffer);
      const magic0 = view.getUint8(0);
      const magic1 = view.getUint8(1);
      const magic2 = view.getUint8(2);
      const magic3 = view.getUint8(3);
      if (magic0 !== 0x53 || magic1 !== 0x55 || magic2 !== 0x52 || magic3 !== 0x56) return;

      const jsonLen = view.getUint32(12);
      if (16 + jsonLen > buffer.byteLength) return;

      const jsonBytes = new Uint8Array(buffer, 16, jsonLen);
      const jsonStr = textDecoderRef.current.decode(jsonBytes);
      const telem: Telemetry = JSON.parse(jsonStr);

      if (telem.stream_complete) {
        setIsStreaming(false);
        return;
      }

      const jpegOffset = 16 + jsonLen;
      const jpegLen = buffer.byteLength - jpegOffset;

      if (jpegLen > 0) {
        const jpegSlice = new Uint8Array(buffer, jpegOffset, jpegLen);
        const blob = new Blob([jpegSlice], { type: 'image/jpeg' });
        try {
          const bitmap = await createImageBitmap(blob);
          prevBitmapRef.current = currentBitmapRef.current;
          currentBitmapRef.current = bitmap;

          // Record session frame for replay scrubber (max 400 frames)
          setSessionFrames((prev) => {
            if (prev.length >= 400) return prev;
            return [...prev, {
              frame_idx: telem.frame_idx,
              timestamp_sec: telem.timestamp_sec,
              imageBitmap: bitmap,
              telemetry: telem,
            }];
          });
        } catch {
          // invalid image chunk
        }
      }

      // Smooth Mode packet timestamp history
      const now = performance.now();
      packetTimestampsRef.current = {
        prev: packetTimestampsRef.current.curr || now - 76,
        curr: now,
      };

      prevTelemetryRef.current = currentTelemetryRef.current;
      currentTelemetryRef.current = telem;

      // Accumulate events
      if (telem.events && telem.events.length > 0) {
        setEvents((prev) => [...prev, ...telem.events]);
      }

      // Throttle low-frequency React state update for KPI odometers
      if (now - lastKpiUpdateRef.current > 200) {
        lastKpiUpdateRef.current = now;
        setKpiCounts({
          vehicle: telem.counts.vehicle,
          pedestrian: telem.counts.pedestrian,
          cyclist: telem.counts.cyclist,
          fps: Number(telem.fps.toFixed(1)),
          latency_ms: Math.round(telem.latency_ms),
          timecode: new Date(telem.timestamp_sec * 1000).toISOString().substr(11, 8),
        });
      }
    };

    ws.onerror = () => {
      setError('Connection to surveillance backend failed. Is server running on port 8080?');
      setIsConnected(false);
      setIsStreaming(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsStreaming(false);
    };
  }, [disconnect, isMockMode]);

  // Send control commands to server
  const sendCommand = useCallback((action: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...payload }));
    }
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    sendCommand('PAUSE');
  }, [sendCommand]);

  const resume = useCallback(() => {
    setIsPaused(false);
    sendCommand('RESUME');
  }, [sendCommand]);

  const setGate = useCallback((ratio: number) => {
    sendCommand('SET_GATE', { value: ratio });
  }, [sendCommand]);

  // Replay seek
  const seekToFrame = useCallback((frameIdx: number) => {
    const foundIdx = sessionFrames.findIndex((f) => f.frame_idx === frameIdx);
    if (foundIdx !== -1) {
      setReplayIndex(foundIdx);
      const frame = sessionFrames[foundIdx];
      if (frame.imageBitmap) currentBitmapRef.current = frame.imageBitmap;
      currentTelemetryRef.current = frame.telemetry;
      setKpiCounts({
        vehicle: frame.telemetry.counts.vehicle,
        pedestrian: frame.telemetry.counts.pedestrian,
        cyclist: frame.telemetry.counts.cyclist,
        fps: Number(frame.telemetry.fps.toFixed(1)),
        latency_ms: Math.round(frame.telemetry.latency_ms),
        timecode: new Date(frame.telemetry.timestamp_sec * 1000).toISOString().substr(11, 8),
      });
    }
  }, [sessionFrames]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isStreaming,
    isPaused,
    error,
    events,
    kpiCounts,
    sessionFrames,
    replayIndex,
    // Direct refs for rAF drawing
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
  };
}
