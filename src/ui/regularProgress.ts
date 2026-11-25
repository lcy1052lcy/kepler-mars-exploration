export type RegularLearningProgress = { completed: number; total: 3; percent: number };

export function regularLearningProgress(completedLessons: readonly boolean[]): RegularLearningProgress {
  const completed = completedLessons.slice(0, 3).filter(Boolean).length;
  return { completed, total: 3, percent: Math.round(completed / 3 * 100) };
}
