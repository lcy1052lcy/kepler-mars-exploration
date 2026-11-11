/** Two-body orbital elements in SI units. Angles are radians. */
export interface EllipticOrbit {
  semiMajorAxisM: number;
  eccentricity: number;
  gravitationalParameterM3S2: number;
}

export interface OrbitalState {
  /** True anomaly from periapsis, radians. */
  trueAnomalyRad: number;
  radiusM: number;
  speedMS: number;
}
