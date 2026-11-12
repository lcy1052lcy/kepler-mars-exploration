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

/** Dimensional Kepler ratio T²/a³ in s²/m³. */
export function thirdLawRatio(periodSeconds: number, semiMajorAxisM: number): number {
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) throw new RangeError('periodSeconds must be positive and finite');
  if (!Number.isFinite(semiMajorAxisM) || semiMajorAxisM <= 0) throw new RangeError('semiMajorAxisM must be positive and finite');
  return periodSeconds ** 2 / semiMajorAxisM ** 3;
}

/** Average speed over a path interval: distance divided by elapsed time. */
export function averageSpeedMS(distanceM: number, elapsedSeconds: number): number {
  if (!Number.isFinite(distanceM) || distanceM < 0) throw new RangeError('distanceM must be nonnegative and finite');
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) throw new RangeError('elapsedSeconds must be positive and finite');
  return distanceM / elapsedSeconds;
}

/** Position and speed from true anomaly using the conic equation and vis-viva equation. */
export function stateAtTrueAnomaly(orbit: EllipticOrbit, trueAnomalyRad: number): OrbitalState {
  assertOrbit(orbit);
  if (!Number.isFinite(trueAnomalyRad)) throw new RangeError('trueAnomalyRad must be finite');
  const { semiMajorAxisM: a, eccentricity: e, gravitationalParameterM3S2: mu } = orbit;
  const radiusM = a * (1 - e ** 2) / (1 + e * Math.cos(trueAnomalyRad));
  const speedMS = Math.sqrt(mu * (2 / radiusM - 1 / a));
  return {
    trueAnomalyRad,
    radiusM,
    speedMS,
    positionXM: radiusM * Math.cos(trueAnomalyRad),
    positionYM: radiusM * Math.sin(trueAnomalyRad),
  };
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

/**
 * Exact swept area for a two-body orbit over an elapsed-time interval.
 * Kepler's second law gives dA/dt = h/2, where h = sqrt(μa(1-e²)).
 */
export function sweptAreaBetweenTimes(orbit: EllipticOrbit, startSeconds: number, endSeconds: number): number {
  assertOrbit(orbit);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds < startSeconds) {
    throw new RangeError('time interval must be finite and endSeconds must not precede startSeconds');
  }
  const h = Math.sqrt(orbit.gravitationalParameterM3S2 * orbit.semiMajorAxisM * (1 - orbit.eccentricity ** 2));
  return 0.5 * h * (endSeconds - startSeconds);
}

/**
 * Path length over an elapsed-time interval, integrated with composite Simpson's rule.
 * The interval is subdivided into an even number of steps and speed is evaluated from
 * the Kepler-equation state at each sample; this is useful for distance comparisons,
 * while the swept-area result above remains analytical.
 */
export function distanceTraveledBetweenTimes(
  orbit: EllipticOrbit,
  startSeconds: number,
  endSeconds: number,
  intervals = 256,
): number {
  assertOrbit(orbit);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds < startSeconds) {
    throw new RangeError('time interval must be finite and endSeconds must not precede startSeconds');
  }
  if (!Number.isInteger(intervals) || intervals < 2 || intervals % 2 !== 0) {
    throw new RangeError('intervals must be an even integer of at least 2');
  }
  const duration = endSeconds - startSeconds;
  if (duration === 0) return 0;
  const step = duration / intervals;
  let weightedSpeed = stateAtTime(orbit, startSeconds).speedMS + stateAtTime(orbit, endSeconds).speedMS;
  for (let i = 1; i < intervals; i += 1) {
    weightedSpeed += (i % 2 === 0 ? 2 : 4) * stateAtTime(orbit, startSeconds + step * i).speedMS;
  }
  return (step / 3) * weightedSpeed;
}
