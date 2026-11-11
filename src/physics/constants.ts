/** SI constants; keep calculations independent from UI and convert for display at the boundary. */
export const GRAVITATIONAL_CONSTANT_M3_KG_S2 = 6.67430e-11;
export const SOLAR_MASS_KG = 1.98847e30;
export const ASTRONOMICAL_UNIT_M = 149_597_870_700;
export const SECONDS_PER_DAY = 86_400;
export const SECONDS_PER_JULIAN_YEAR = 365.25 * SECONDS_PER_DAY;
export const SOLAR_MU_M3_S2 = GRAVITATIONAL_CONSTANT_M3_KG_S2 * SOLAR_MASS_KG;
