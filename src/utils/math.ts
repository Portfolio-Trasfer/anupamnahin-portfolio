/**
 * Linear interpolation between two numbers
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map a number from one range [inMin, inMax] to [outMin, outMax]
 */
export function map(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Frame-rate independent damping (smoothing) towards target
 */
export function damp(
  current: number,
  target: number,
  smoothing: number,
  deltaTime: number
): number {
  return lerp(current, target, 1 - Math.exp(-smoothing * deltaTime));
}

