import type { EllipticOrbit, OrbitalState } from './types';

function assertOrbit(orbit: EllipticOrbit): void {
  if (!Number.isFinite(orbit.semiMajorAxisM) || orbit.semiMajorAxisM <= 0) throw new RangeError('semiMajorAxisM must be positive and finite');
  if (!Number.isFinite(orbit.eccentricity) || orbit.eccentricity < 0 || orbit.eccentricity >= 1) throw new RangeError('elliptic orbit eccentricity must satisfy 0 <= e < 1');
  if (!Number.isFinite(orbit.gravitationalParameterM3S2) || orbit.gravitationalParameterM3S2 <= 0) throw new RangeError('gravitationalParameterM3S2 must be positive and finite');
}

/** Geometry of an ellipse with its primary focus at (0, 0), in the same unit as semiMajorAxis. */
export interface EllipseGeometry {
  semiMajorAxis: number;
  semiMinorAxis: number;
  focusDistance: number;
  periapsisDistance: number;
  apoapsisDistance: number;
}

/** Returns the two-focus geometry and extreme distances from one focus. */
export function ellipseGeometry(semiMajorAxis: number, eccentricity: number): EllipseGeometry {
  if (!Number.isFinite(semiMajorAxis) || semiMajorAxis <= 0) throw new RangeError('semiMajorAxis must be positive and finite');
  if (!Number.isFinite(eccentricity) || eccentricity < 0 || eccentricity >= 1) throw new RangeError('elliptic orbit eccentricity must satisfy 0 <= e < 1');
  const focusDistance = semiMajorAxis * eccentricity;
  return {
    semiMajorAxis,
    semiMinorAxis: semiMajorAxis * Math.sqrt(1 - eccentricity ** 2),
    focusDistance,
    periapsisDistance: semiMajorAxis - focusDistance,
    apoapsisDistance: semiMajorAxis + focusDistance,
  };
}

/** Kepler equation E - e sin(E) = M solved by Newton iteration. */
export function eccentricAnomalyFromMean(meanAnomalyRad: number, eccentricity: number, tolerance = 1e-12): number {
  if (!Number.isFinite(meanAnomalyRad) || !Number.isFinite(eccentricity) || eccentricity < 0 || eccentricity >= 1) throw new RangeError('Expected finite mean anomaly and 0 <= e < 1');
  const mean = ((meanAnomalyRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let eccentric = eccentricity < 0.8 ? mean : Math.PI;
  for (let i = 0; i < 32; i += 1) {
    const delta = (eccentric - eccentricity * Math.sin(eccentric) - mean) / (1 - eccentricity * Math.cos(eccentric));
    eccentric -= delta;
    if (Math.abs(delta) < tolerance) return eccentric;
  }
  throw new Error('Kepler equation solver did not converge');
}

/** Period of a two-body elliptic orbit: T = 2π sqrt(a³/μ). */
export function orbitalPeriodSeconds(orbit: EllipticOrbit): number {
  assertOrbit(orbit);
  return 2 * Math.PI * Math.sqrt(orbit.semiMajorAxisM ** 3 / orbit.gravitationalParameterM3S2);
}

/** Position and speed from true anomaly using the conic equation and vis-viva equation. */
export function stateAtTrueAnomaly(orbit: EllipticOrbit, trueAnomalyRad: number): OrbitalState {
  assertOrbit(orbit);
  if (!Number.isFinite(trueAnomalyRad)) throw new RangeError('trueAnomalyRad must be finite');
  const { semiMajorAxisM: a, eccentricity: e, gravitationalParameterM3S2: mu } = orbit;
  const radiusM = a * (1 - e ** 2) / (1 + e * Math.cos(trueAnomalyRad));
  const speedMS = Math.sqrt(mu * (2 / radiusM - 1 / a));
  return { trueAnomalyRad, radiusM, speedMS };
}

/** Position for elapsed time from periapsis; mean motion uses the two-body model. */
export function stateAtTime(orbit: EllipticOrbit, elapsedSeconds: number): OrbitalState {
  assertOrbit(orbit);
  if (!Number.isFinite(elapsedSeconds)) throw new RangeError('elapsedSeconds must be finite');
  const meanMotion = Math.sqrt(orbit.gravitationalParameterM3S2 / orbit.semiMajorAxisM ** 3);
  const eccentric = eccentricAnomalyFromMean(meanMotion * elapsedSeconds, orbit.eccentricity);
  const trueAnomalyRad = 2 * Math.atan2(Math.sqrt(1 + orbit.eccentricity) * Math.sin(eccentric / 2), Math.sqrt(1 - orbit.eccentricity) * Math.cos(eccentric / 2));
  return stateAtTrueAnomaly(orbit, trueAnomalyRad);
}
