import type { CSSProperties } from 'react';
import './lesson-step-navigation.css';

export type LessonStepItem = { label: string };

export default function LessonStepNavigation({
  lessonLabel,
  steps,
  currentStep,
  highestStep,
  completedSteps,
  onNavigate,
}: {
  lessonLabel: string;
  steps: LessonStepItem[];
  currentStep: number;
  highestStep: number;
  completedSteps: number[];
  onNavigate: (step: number) => void;
}) {
  const reached = Math.max(highestStep, currentStep);
  return <nav className="lesson-step-navigation" aria-label={`${lessonLabel} 진행 단계`} style={{ '--lesson-step-count': steps.length } as CSSProperties}>
    {steps.map(({ label }, index) => {
      const isCurrent = index === currentStep;
      const isCompleted = completedSteps.includes(index);
      const isReachable = index <= reached || isCompleted;
      return <button
        key={`${index}-${label}`}
        type="button"
        className={`lesson-step-button${isCurrent ? ' current' : ''}${isCompleted ? ' done' : ''}${isReachable ? ' reached' : ' locked'}`}
        aria-current={isCurrent ? 'step' : undefined}
        aria-label={`${index + 1}단계 ${label}${isCompleted ? ', 완료' : isCurrent ? ', 현재 단계' : isReachable ? ', 방문 가능' : ', 아직 방문할 수 없음'}`}
        disabled={!isReachable}
        onClick={() => onNavigate(index)}
      >
        <span className="lesson-step-number">{isCompleted ? '✓' : index + 1}</span>
        <b>{label}</b>
        <small>{isCurrent ? '현재' : isCompleted ? '완료' : isReachable ? '방문' : '잠김'}</small>
      </button>;
    })}
  </nav>;
}
