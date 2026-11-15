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
