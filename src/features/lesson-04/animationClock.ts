export interface AnimationClock {
  progress: number;
  durationSeconds: number;
  elapsedSeconds: number;
}

/** Keep persisted or calculated clock values from feeding non-finite time into orbit rendering. */
export function resolveAnimationClock(progress: number, durationSeconds: number, fallbackSeconds: number): AnimationClock {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : Number.isFinite(fallbackSeconds) && fallbackSeconds > 0 ? fallbackSeconds : 0;
  return { progress: safeProgress, durationSeconds: safeDuration, elapsedSeconds: safeProgress * safeDuration };
}
