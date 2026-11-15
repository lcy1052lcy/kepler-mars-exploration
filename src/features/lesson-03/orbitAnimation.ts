import { stateAtTime } from '../../physics';
import type { ApsisOrbit } from '../../physics/transfers';

export function transferFrameAtProgress(model: ApsisOrbit, progress: number) {
  const fraction = Math.max(0, Math.min(1, progress));
  const elapsedSeconds = fraction * model.periodSeconds / 2;
  return { elapsedSeconds, state: stateAtTime(model.orbit, elapsedSeconds) };
}

/** SVG trail points follow the time-parametrized Kepler orbit, not uniform true anomaly. */
export function transferTrailPath(
  model: ApsisOrbit,
  progress: number,
  cx = 360,
  cy = 250,
  scale = 118,
  samplesPerOrbit = 240,
): string {
  const endSeconds = transferFrameAtProgress(model, progress).elapsedSeconds;
  const count = Math.max(2, Math.ceil(samplesPerOrbit * Math.max(0.01, endSeconds / model.periodSeconds)));
  return Array.from({ length: count + 1 }, (_, index) => {
    const state = stateAtTime(model.orbit, (endSeconds * index) / count);
    const x = cx + state.positionXM * scale;
    const y = cy - state.positionYM * scale;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}
