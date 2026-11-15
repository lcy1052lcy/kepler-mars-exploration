/** Accept answers that round to the requested decimal precision without rounding the model value. */
export function isRoundedNumericAnswer(input: string, expected: number, decimalPlaces: number): boolean {
  if (!input.trim() || !Number.isInteger(decimalPlaces) || decimalPlaces < 0 || !Number.isFinite(expected)) return false;
  const value = Number(input);
  if (!Number.isFinite(value)) return false;
  const halfUnit = 0.5 * 10 ** -decimalPlaces;
  return Math.abs(value - expected) <= halfUnit + Number.EPSILON * Math.max(1, Math.abs(expected)) * 4;
}

export function isRoundedNumericAnswerAmong(input: string, expectedValues: number[], decimalPlaces: number): boolean {
  return expectedValues.some((expected) => isRoundedNumericAnswer(input, expected, decimalPlaces));
}

export function transferCalculationValues(apoapsisAU: number) {
  if (!Number.isFinite(apoapsisAU) || apoapsisAU <= 1) throw new RangeError('apoapsisAU must be greater than the 1 AU periapsis');
  const semiMajorAxisAU = (1 + apoapsisAU) / 2;
  const periodYears = Math.sqrt(semiMajorAxisAU ** 3);
  return { semiMajorAxisAU, periodYears, transferDays: periodYears * 365.25 / 2 };
}
