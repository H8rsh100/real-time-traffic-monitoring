import { useState, useEffect, useRef, useCallback } from 'react';
import type { Telemetry, CrossingEvent, SessionFrame } from '../types';

export interface StreamConfig {
  source: string;
  model: string;
  conf: number;
  iou: number;
  line_ratio: number;
  max_frames: number;
}

export function useSurveillanceStream() {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [events, setEvents] = useState<CrossingEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Replay & Scrubber Session Cache
  const [sessionFrames, setSessionFrames] = useState<SessionFrame[]>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const currentBitmapRef = useRef<ImageBitmap | null>(null);
  const textDecoderRef = useRef(new TextDecoder('utf-8'));

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsStreaming(false);
  }, []);

  // Connect & Start Stream
  const startStream = useCallback((config: StreamConfig) => {
    disconnect();
    setError(null);
    setSessionFrames([]);
    setEvents([]);
    setReplayIndex(null);

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
      // Send initial config packet
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
      // Check magic 'SURV' (0x53555256)
      const magic0 = view.getUint8(0);
      const magic1 = view.getUint8(1);
      const magic2 = view.getUint8(2);
      const magic3 = view.getUint8(3);
      if (magic0 !== 0x53 || magic1 !== 0x55 || magic2 !== 0x52 || magic3 !== 0x56) {
        return;
      }

      // Read header
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
          currentBitmapRef.current = bitmap;

          // Record session frame for replay scrubber (max 400 frames in memory)
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

      setTelemetry(telem);

      // Accumulate events
      if (telem.events && telem.events.length > 0) {
        setEvents((prev) => [...prev, ...telem.events]);
      }
    };

    ws.onerror = () => {
      setError('Connection to surveillance backend failed. Is server running on port 8000?');
      setIsConnected(false);
      setIsStreaming(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsStreaming(false);
    };
  }, [disconnect]);

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
      setTelemetry(frame.telemetry);
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
    telemetry,
    events,
    error,
    sessionFrames,
    replayIndex,
    currentBitmap: currentBitmapRef.current,
    startStream,
    disconnect,
    pause,
    resume,
    setGate,
    seekToFrame,
  };
}
