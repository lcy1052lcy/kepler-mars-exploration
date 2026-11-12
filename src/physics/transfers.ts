import { ASTRONOMICAL_UNIT_M, SECONDS_PER_DAY, SECONDS_PER_JULIAN_YEAR, SOLAR_MU_M3_S2 } from './constants';
import { orbitalPeriodSeconds } from './kepler';
import type { EllipticOrbit } from './types';

export interface ApsisOrbit {
  periapsisAU: number;
  apoapsisAU: number;
  semiMajorAxisAU: number;
  eccentricity: number;
  orbit: EllipticOrbit;
  periodSeconds: number;
}

export interface HohmannTransfer extends ApsisOrbit {
  transferSeconds: number;
  periodYears: number;
  transferDays: number;
}

/** Create a Sun-centred two-body ellipse from its periapsis and apoapsis distances. */
export function ellipseFromApsisDistancesAU(
  periapsisAU: number,
  apoapsisAU: number,
  gravitationalParameterM3S2 = SOLAR_MU_M3_S2,
): ApsisOrbit {
  if (!Number.isFinite(periapsisAU) || !Number.isFinite(apoapsisAU) || periapsisAU <= 0 || apoapsisAU <= periapsisAU) {
    throw new RangeError('Apsis distances must be finite, positive, and apoapsis must exceed periapsis');
  }
  if (!Number.isFinite(gravitationalParameterM3S2) || gravitationalParameterM3S2 <= 0) {
    throw new RangeError('gravitationalParameterM3S2 must be positive and finite');
  }
  const semiMajorAxisAU = (periapsisAU + apoapsisAU) / 2;
  const eccentricity = (apoapsisAU - periapsisAU) / (apoapsisAU + periapsisAU);
  const orbit = {
    semiMajorAxisM: semiMajorAxisAU * ASTRONOMICAL_UNIT_M,
    eccentricity,
    gravitationalParameterM3S2,
  };
  return {
    periapsisAU,
    apoapsisAU,
    semiMajorAxisAU,
    eccentricity,
    orbit,
    periodSeconds: orbitalPeriodSeconds(orbit),
  };
}

/** Ideal coplanar Hohmann transfer between circular heliocentric orbits. */
export function hohmannTransfer(innerOrbitAU = 1, outerOrbitAU = 1.524): HohmannTransfer {
  const apsis = ellipseFromApsisDistancesAU(innerOrbitAU, outerOrbitAU);
  const transferSeconds = apsis.periodSeconds / 2;
  return {
    ...apsis,
    transferSeconds,
    periodYears: apsis.periodSeconds / SECONDS_PER_JULIAN_YEAR,
    transferDays: transferSeconds / SECONDS_PER_DAY,
  };
}
