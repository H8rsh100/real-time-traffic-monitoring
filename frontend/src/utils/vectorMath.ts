/**
 * Vector Math and Geometry Utilities for Real-Time Viewport Interpolation.
 */

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpBbox(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number],
  t: number
): [number, number, number, number] {
  return [
    lerp(boxA[0], boxB[0], t),
    lerp(boxA[1], boxB[1], t),
    lerp(boxA[2], boxB[2], t),
    lerp(boxA[3], boxB[3], t),
  ];
}

export function lerpCentroid(
  ptA: [number, number],
  ptB: [number, number],
  t: number
): [number, number] {
  return [lerp(ptA[0], ptB[0], t), lerp(ptA[1], ptB[1], t)];
}

export function getEuclideanDistance(
  p1: [number, number],
  p2: [number, number]
): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
