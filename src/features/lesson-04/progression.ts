export type ObservationChoice = 'yes' | 'no' | '';
export interface EncounterProgress {
  firstRunComplete: boolean;
  changedPositionRunComplete: boolean;
  resultConfirmed: boolean;
  predictionCompared: ObservationChoice;
}

/** Advancement depends on completing observations, never on a successful encounter. */
export function canAdvanceEncounter(progress: EncounterProgress): boolean {
  return progress.firstRunComplete
    && progress.changedPositionRunComplete
    && progress.resultConfirmed
    && (progress.predictionCompared === 'yes' || progress.predictionCompared === 'no');
}

export function encounterRequirements(progress: EncounterProgress): string[] {
  const requirements: string[] = [];
  if (!progress.firstRunComplete) requirements.push('시뮬레이션을 한 번 실행해 보세요.');
  if (progress.firstRunComplete && !progress.changedPositionRunComplete) requirements.push('화성의 출발 위치를 변경하고 다시 관찰해 보세요.');
  if (progress.firstRunComplete && progress.predictionCompared !== 'yes' && progress.predictionCompared !== 'no') requirements.push('첫 관찰 결과를 도입의 예상과 비교해 선택해 주세요.');
  if (progress.changedPositionRunComplete && !progress.resultConfirmed) requirements.push('변경한 조건에서 관찰 결과 확인을 눌러 보세요.');
  return requirements;
}
