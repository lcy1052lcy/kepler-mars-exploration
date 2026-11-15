import { ASTRONOMICAL_UNIT_M, SECONDS_PER_DAY } from './constants';
import { stateAtTime, stateAtTrueAnomaly } from './kepler';
import type { ApsisOrbit } from './transfers';

export type EncounterStatus = 'no-orbit-crossing' | 'different-position' | 'same-position';
export interface OrbitCrossing { trueAnomalyRad: number; elapsedSeconds: number; radiusAU: number }
export interface MarsEncounterResult {
  status: EncounterStatus;
  crossing: OrbitCrossing | null;
  probeAngleRad: number | null;
  marsAngleRad: number | null;
  separationAU: number | null;
}

/** Time of the outbound crossing of a circular orbit. The ellipse starts at periapsis on +x. */
export function outboundCircleCrossing(model: ApsisOrbit, circleRadiusAU: number): OrbitCrossing | null {
  if (!Number.isFinite(circleRadiusAU) || circleRadiusAU <= 0) throw new RangeError('circleRadiusAU must be positive and finite');
  const tolerance = 1e-12;
  if (circleRadiusAU < model.periapsisAU - tolerance || circleRadiusAU > model.apoapsisAU + tolerance) return null;
  if (Math.abs(circleRadiusAU - model.periapsisAU) <= tolerance) return { trueAnomalyRad: 0, elapsedSeconds: 0, radiusAU: model.periapsisAU };
  const a = model.semiMajorAxisAU;
  const e = model.eccentricity;
  if (e < 1e-14) return null;
  const p = a * (1 - e * e);
  const cosNu = Math.max(-1, Math.min(1, (p / circleRadiusAU - 1) / e));
  const nu = Math.acos(cosNu);
  const eccentric = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  const mean = eccentric - e * Math.sin(eccentric);
  return { trueAnomalyRad: nu, elapsedSeconds: mean * model.periodSeconds / (2 * Math.PI), radiusAU: circleRadiusAU };
}

export function circularPlanetAngle(startAngleRad: number, elapsedSeconds: number, periodDays: number): number {
  if (![startAngleRad, elapsedSeconds, periodDays].every(Number.isFinite) || elapsedSeconds < 0 || periodDays <= 0) throw new RangeError('Invalid circular-orbit state');
  return startAngleRad + elapsedSeconds / (periodDays * SECONDS_PER_DAY) * 2 * Math.PI;
}

/** Compares the probe and Mars at their actual outbound orbit-crossing time in the ideal model. */
export function evaluateMarsEncounter(
  model: ApsisOrbit,
  marsStartAngleRad: number,
  marsPeriodDays = 686.98,
  marsOrbitRadiusAU = 1.524,
  positionToleranceAU = 0.003,
): MarsEncounterResult {
  const crossing = outboundCircleCrossing(model, marsOrbitRadiusAU);
  if (!crossing) return { status: 'no-orbit-crossing', crossing: null, probeAngleRad: null, marsAngleRad: null, separationAU: null };
  const probe = stateAtTime(model.orbit, crossing.elapsedSeconds);
  const probeAngleRad = Math.atan2(probe.positionYM, probe.positionXM);
  const marsAngleRad = circularPlanetAngle(marsStartAngleRad, crossing.elapsedSeconds, marsPeriodDays);
  const marsX = marsOrbitRadiusAU * Math.cos(marsAngleRad);
  const marsY = marsOrbitRadiusAU * Math.sin(marsAngleRad);
  const separationAU = Math.hypot(probe.positionXM / ASTRONOMICAL_UNIT_M - marsX, probe.positionYM / ASTRONOMICAL_UNIT_M - marsY);
  return { status: separationAU <= positionToleranceAU ? 'same-position' : 'different-position', crossing, probeAngleRad, marsAngleRad, separationAU };
}

/** Kepler-state point helper in AU, useful to keep drawing and numerical model aligned. */
export function transferPositionAU(model: ApsisOrbit, elapsedSeconds: number): { x: number; y: number; radius: number; speedMS: number } {
  const state = stateAtTime(model.orbit, elapsedSeconds);
  return { x: state.positionXM / ASTRONOMICAL_UNIT_M, y: state.positionYM / ASTRONOMICAL_UNIT_M, radius: state.radiusM / ASTRONOMICAL_UNIT_M, speedMS: state.speedMS };
}

export function transferEllipsePointAU(model: ApsisOrbit, trueAnomalyRad: number): { x: number; y: number } {
  const state = stateAtTrueAnomaly(model.orbit, trueAnomalyRad);
  return { x: state.positionXM / ASTRONOMICAL_UNIT_M, y: state.positionYM / ASTRONOMICAL_UNIT_M };
}
