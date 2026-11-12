/** The construction stage is complete after its geometry is checked and observed. */
export function isConstructionReady(submitted: boolean, geometryCorrect: boolean, observation: string): boolean {
  return submitted && geometryCorrect && observation.trim().length > 0;
}
