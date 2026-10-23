import { useRef, useEffect, useState } from 'react';

export interface PerformanceMetrics {
  renderFps: number;
  frameBudgetMs: number;
  drawDurationMs: number;
  isBudgetExceeded: boolean;
}

export function usePerformanceProfiler(drawBudgetLimitMs: number = 16.6): PerformanceMetrics {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderFps: 60,
    frameBudgetMs: drawBudgetLimitMs,
    drawDurationMs: 3.2,
    isBudgetExceeded: false,
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    let animId: number;

    const measure = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 30) {
        frameTimesRef.current.shift();
      }

      const meanDelta =
        frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      const currentFps = meanDelta > 0 ? 1000 / meanDelta : 60;

      // Update state at throttled interval
      if (frameTimesRef.current.length % 15 === 0) {
        setMetrics({
          renderFps: Number(currentFps.toFixed(1)),
          frameBudgetMs: drawBudgetLimitMs,
          drawDurationMs: Number(meanDelta.toFixed(2)),
          isBudgetExceeded: meanDelta > drawBudgetLimitMs,
        });
      }

      animId = requestAnimationFrame(measure);
    };

    animId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(animId);
  }, [drawBudgetLimitMs]);

  return metrics;
}
