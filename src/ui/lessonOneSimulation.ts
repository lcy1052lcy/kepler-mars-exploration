export type LessonOneSimulationSettings = {
  freeEccentricity: number;
  focusEccentricity: number;
  planetEccentricity: number;
};

export type LessonOneSimulationState = {
  mode: 'concept' | 'planet';
  eccentricity: number;
};

/** Resolve the 1st-lesson controls from the restored exploration step. */
export function lessonOneSimulationState(step: number, settings: LessonOneSimulationSettings): LessonOneSimulationState {
  if (step === 2 || step === 3) return { mode: 'planet', eccentricity: settings.planetEccentricity };
  return { mode: 'concept', eccentricity: step === 1 ? settings.focusEccentricity : settings.freeEccentricity };
}
