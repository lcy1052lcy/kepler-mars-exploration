import { ASTRONOMICAL_UNIT_M, stateAtTime, stateAtTrueAnomaly, type OrbitalState } from '../../physics';
import type { ApsisOrbit } from '../../physics/transfers';

export function orbitalStateSvgPoint(state: OrbitalState, cx = 360, cy = 250, pixelsPerAU = 118): [number, number] {
  return [cx + (state.positionXM / ASTRONOMICAL_UNIT_M) * pixelsPerAU, cy - (state.positionYM / ASTRONOMICAL_UNIT_M) * pixelsPerAU];
}

export function transferFrameAtProgress(model: ApsisOrbit, progress: number, cx = 360, cy = 250, pixelsPerAU = 118) {
  const fraction = Math.max(0, Math.min(1, progress));
  const elapsedSeconds = fraction * model.periodSeconds / 2;
  const state = stateAtTime(model.orbit, elapsedSeconds);
  const [x, y] = orbitalStateSvgPoint(state, cx, cy, pixelsPerAU);
  return { elapsedSeconds, state, x, y };
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
    const [x, y] = orbitalStateSvgPoint(state, cx, cy, scale);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

export function ellipseOrbitPath(model: ApsisOrbit, cx = 360, cy = 250, scale = 118, samples = 240): string {
  const points = Array.from({ length: samples + 1 }, (_, index) => {
    const state = stateAtTrueAnomaly(model.orbit, (index / samples) * Math.PI * 2);
    const [x, y] = orbitalStateSvgPoint(state, cx, cy, scale);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  return `${points.join(' ')} Z`;
}
