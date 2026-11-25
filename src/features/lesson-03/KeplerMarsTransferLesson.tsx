import { useEffect, useMemo, useState } from 'react';
import { ASTRONOMICAL_UNIT_M, distanceTraveledBetweenTimes, stateAtTime } from '../../physics';
import { ellipseFromApsisDistancesAU, hohmannTransfer, type ApsisOrbit } from '../../physics/transfers';
import { isConstructionReady } from './constructionReadiness';
import { isRoundedNumericAnswer, isRoundedNumericAnswerAmong, transferCalculationValues } from './calculationValidation';
import { ellipseOrbitPath, orbitalStateSvgPoint, transferFrameAtProgress, transferTrailPath } from './orbitAnimation';
import LessonCompletion from '../../ui/LessonCompletion';
import LessonStepNavigation from '../../ui/LessonStepNavigation';
import { clearLessonStoredState, isBoolean, isIndexList, isIntegerBetween, isNumberBetween, isString, isStringRecord, useLessonStoredState } from '../../ui/lessonProgress';
import './lesson-03.css';

type Step = 0 | 1 | 2 | 3 | 4 | 5;
type RouteAnswer = 'line' | 'circle' | 'ellipse' | 'other' | null;
type SpeedAnswer = 'departure' | 'arrival' | 'same' | null;
type DistanceAnswer = 'decreases' | 'increases' | 'same' | null;
type LawAnswer = 'equal-area' | 'not-equal' | 'unrelated' | null;
type Notes = Record<'prediction' | 'construction' | 'motion' | 'calculation' | 'comparison' | 'summary' | 'arrival', string>;
type Summary = Record<'first' | 'second' | 'third', string>;
type CalculationResult = 'correct' | 'retry' | null;

const STEPS = ['경로 예상', '전이 타원 구성', '운동 관찰', '이동 시간 계산', '예상과 결과', '법칙 정리'];
const DEFAULT_NOTES: Notes = { prediction: '', construction: '', motion: '', calculation: '', comparison: '', summary: '', arrival: '' };
const DEFAULT_SUMMARY: Summary = { first: '', second: '', third: '' };
const SIMULATION_SECONDS = 18;

function validSpeedAnswer(value: unknown): value is SpeedAnswer { return value === null || value === 'departure' || value === 'arrival' || value === 'same'; }
function validDistanceAnswer(value: unknown): value is DistanceAnswer { return value === null || value === 'decreases' || value === 'increases' || value === 'same'; }
function validLawAnswer(value: unknown): value is LawAnswer { return value === null || value === 'equal-area' || value === 'not-equal' || value === 'unrelated'; }
function validRouteAnswer(value: unknown): value is RouteAnswer { return value === null || value === 'line' || value === 'circle' || value === 'ellipse' || value === 'other'; }

function Feedback({ correct, children }: { correct: boolean | undefined; children: string }) {
  return <div className={`l3-feedback ${correct === undefined ? 'neutral' : correct ? 'correct' : 'retry'}`} role="status"><b>{correct === undefined ? '확인' : correct ? '잘 관찰했어요' : '다시 살펴볼까요?'}</b><span>{children}</span></div>;
}

function svgPoint(model: ApsisOrbit, seconds: number, cx = 360, cy = 250, scale = 118): [number, number] {
  const state = stateAtTime(model.orbit, seconds);
  return orbitalStateSvgPoint(state, cx, cy, scale);
}

function timedPath(model: ApsisOrbit, start: number, end: number, samples = 240): string {
  const count = Math.max(2, Math.ceil(samples * Math.max(0.01, (end - start) / model.periodSeconds)));
  return Array.from({ length: count + 1 }, (_, index) => {
    const [x, y] = svgPoint(model, start + ((end - start) * index) / count);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function OrbitFigure({ model, progress = 0, construction = false, showEqualTimeArcs = false }: { model: ApsisOrbit; progress?: number; construction?: boolean; showEqualTimeArcs?: boolean }) {
  const cx = 360;
  const cy = 250;
  const scale = 118;
  const transferSeconds = model.periodSeconds / 2;
  const periapsisX = cx + model.periapsisAU * scale;
  const apoapsisX = cx - model.apoapsisAU * scale;
  const earthX = cx + scale;
  const marsX = cx - 1.524 * scale;
  const transferFrame = transferFrameAtProgress(model, progress, cx, cy, scale);
  const interval = transferSeconds * 0.05;
  const probeX = transferFrame.x;
  const probeY = transferFrame.y;
  const [arrivalStartX, arrivalStartY] = svgPoint(model, transferSeconds - interval);
  return <svg className="l3-orbit-svg" viewBox="0 0 720 500" role="img" aria-label="태양을 중심으로 한 지구 원궤도, 화성 원궤도와 탐사선 전이 타원">
    <circle cx={cx} cy={cy} r={scale} fill="none" stroke="#5c9fe2" strokeWidth="2" strokeDasharray="6 5"/>
    <circle cx={cx} cy={cy} r={1.524 * scale} fill="none" stroke="#db9870" strokeWidth="2" strokeDasharray="6 5"/>
    {!construction && <path d={ellipseOrbitPath(model, cx, cy, scale)} fill="rgba(112,211,198,.035)" stroke="#b6c4d3" strokeWidth="3" strokeDasharray="7 5"/>}
    <path d={construction ? ellipseOrbitPath(model, cx, cy, scale) : transferTrailPath(model, progress, cx, cy, scale)} fill="none" stroke="#59d7c6" strokeWidth={construction ? 4 : 7} strokeLinecap="round" opacity={construction ? 0.96 : 1}/>
    {showEqualTimeArcs && <>
      <path d={timedPath(model, 0, interval)} fill="none" stroke="#58dfce" strokeWidth="9" strokeLinecap="round"/>
      <path d={timedPath(model, transferSeconds - interval, transferSeconds)} fill="none" stroke="#ffad70" strokeWidth="9" strokeLinecap="round"/>
      <circle cx={earthX} cy={cy} r="5" fill="#eafffd" stroke="#227d75" strokeWidth="2"/>
      <circle cx={arrivalStartX} cy={arrivalStartY} r="5" fill="#fff0e4" stroke="#a45b30" strokeWidth="2"/>
      <circle cx={cx - 1.524 * scale} cy={cy} r="5" fill="#fff0e4" stroke="#a45b30" strokeWidth="2"/>
    </>}
    <line x1={cx} y1={cy} x2={periapsisX} y2={cy} stroke="#b9c5d2" strokeWidth="1.5" strokeDasharray="4 5"/>
    <line x1={cx} y1={cy} x2={apoapsisX} y2={cy} stroke="#b9c5d2" strokeWidth="1.5" strokeDasharray="4 5"/>
    <circle cx={earthX} cy={cy} r="8" fill="#78b8ff" stroke="#102033" strokeWidth="2"/>
    <circle cx={marsX} cy={cy} r="9" fill="#ff9b68" stroke="#102033" strokeWidth="2"/>
    <circle cx={cx} cy={cy} r="12" fill="rgba(255,211,112,.23)"/>
    <circle cx={cx} cy={cy} r="6" fill="#ffd166" stroke="#8a6327" strokeWidth="2"/>
    <circle cx={periapsisX} cy={cy} r="5" fill="#59d7c6" stroke="#122436" strokeWidth="2"/>
    <circle cx={apoapsisX} cy={cy} r="5" fill="#9ed5ca" stroke="#122436" strokeWidth="2"/>
    <circle cx={probeX} cy={probeY} r="17" fill="rgba(89,215,198,.20)"/>
    <circle cx={probeX} cy={probeY} r="9" fill="#fff" stroke="#13786f" strokeWidth="3"/>
    <text x={cx} y="32" textAnchor="middle" className="l3-svg-label">태양 중심 궤도 모형</text>
    <text x={earthX} y={cy + 34} textAnchor="middle" className="l3-svg-earth-label">지구 궤도 · 1.00 AU</text>
    <text x={marsX} y={cy + 34} textAnchor="middle" className="l3-svg-mars-label">화성 궤도 · 1.524 AU</text>
    <text x={cx + 11} y={cy - 13} className="l3-svg-sun-label">태양</text>
    <text x={periapsisX} y={cy - 15} textAnchor="middle" className="l3-svg-hint">근일점</text>
    <text x={apoapsisX} y={cy - 15} textAnchor="middle" className="l3-svg-hint">원일점</text>
  </svg>;
}

function Calculator({ left, right, operation, result, onLeft, onRight, onOperation, onCalculate }: {
  left: string; right: string; operation: string; result: string; onLeft: (value: string) => void; onRight: (value: string) => void; onOperation: (value: string) => void; onCalculate: () => void;
}) {
  return <details className="l3-calculator"><summary>계산 도구 열기</summary><div className="l3-calc-controls">
    <input type="number" step="any" aria-label="계산기 첫 번째 수" value={left} onChange={(event) => onLeft(event.target.value)} placeholder="수 입력"/>
    <select aria-label="계산기 연산" value={operation} onChange={(event) => onOperation(event.target.value)}><option value="+">더하기 +</option><option value="-">빼기 −</option><option value="*">곱하기 ×</option><option value="/">나누기 ÷</option><option value="square">제곱 x²</option><option value="cube">세제곱 x³</option><option value="sqrt">제곱근 √x</option></select>
    {operation !== 'square' && operation !== 'cube' && operation !== 'sqrt' && <input type="number" step="any" aria-label="계산기 두 번째 수" value={right} onChange={(event) => onRight(event.target.value)} placeholder="수 입력"/>}
    <button type="button" onClick={onCalculate}>계산</button>{result && <output>{result}</output>}
  </div></details>;
}

function ProgressNote({ children }: { children: string }) { return <div className="l3-note" role="status">{children}</div>; }

export default function KeplerMarsTransferLesson({ onOpenRegularReport }: { onOpenRegularReport?: () => void } = {}) {
  const [step, setStep] = useLessonStoredState<Step>('3', 'step', 0, (value): value is Step => isIntegerBetween(value, 0, 5));
  const [highestStep, setHighestStep] = useLessonStoredState('3', 'highestStep', 0, (value): value is number => isIntegerBetween(value, 0, 5));
  const [completedSteps, setCompletedSteps] = useLessonStoredState('3', 'completedSteps', [] as number[], (value): value is number[] => isIndexList(value, 5));
  const [completed, setCompleted] = useLessonStoredState('3', 'completed', false, isBoolean);
  const [prediction, setPrediction] = useLessonStoredState<RouteAnswer>('3', 'prediction', null, validRouteAnswer);
  const [notes, setNotes] = useLessonStoredState('3', 'notes', DEFAULT_NOTES, isStringRecord(['prediction', 'construction', 'motion', 'calculation', 'comparison', 'summary', 'arrival'] as const));
  const [periapsisAU, setPeriapsisAU] = useLessonStoredState('3', 'periapsisAU', 0.82, (value): value is number => isNumberBetween(value, 0.7, 1.3));
  const [apoapsisAU, setApoapsisAU] = useLessonStoredState('3', 'apoapsisAU', 1.72, (value): value is number => isNumberBetween(value, 1.1, 1.8));
  const [constructionSubmitted, setConstructionSubmitted] = useLessonStoredState('3', 'constructionSubmitted', false, isBoolean);
  const [confirmedApoapsisAU, setConfirmedApoapsisAU] = useLessonStoredState<number | null>('3', 'confirmedApoapsisAU', constructionSubmitted ? apoapsisAU : null, (value): value is number | null => value === null || isNumberBetween(value, 1.1, 1.8));
  const [animationProgress, setAnimationProgress] = useLessonStoredState('3', 'animationProgress', 0, (value): value is number => isNumberBetween(value, 0, 1));
  const [animationSpeed, setAnimationSpeed] = useLessonStoredState('3', 'animationSpeed', 1, (value): value is number => value === 0.5 || value === 1 || value === 2);
  const [motionSpeedAnswer, setMotionSpeedAnswer] = useLessonStoredState<SpeedAnswer>('3', 'motionSpeedAnswer', null, validSpeedAnswer);
  const [motionDistanceAnswer, setMotionDistanceAnswer] = useLessonStoredState<DistanceAnswer>('3', 'motionDistanceAnswer', null, validDistanceAnswer);
  const [motionLawAnswer, setMotionLawAnswer] = useLessonStoredState<LawAnswer>('3', 'motionLawAnswer', null, validLawAnswer);
  const [calcA, setCalcA] = useLessonStoredState('3', 'calcA', '', isString);
  const [calcPeriod, setCalcPeriod] = useLessonStoredState('3', 'calcPeriod', '', isString);
  const [calcDays, setCalcDays] = useLessonStoredState('3', 'calcDays', '', isString);
  const [calcPhase, setCalcPhase] = useLessonStoredState('3', 'calcPhase', 0, (value): value is number => isIntegerBetween(value, 0, 3));
  const [calcAFeedback, setCalcAFeedback] = useLessonStoredState<CalculationResult>('3', 'calcAFeedback', null, (value): value is CalculationResult => value === null || value === 'correct' || value === 'retry');
  const [calcPeriodFeedback, setCalcPeriodFeedback] = useLessonStoredState<CalculationResult>('3', 'calcPeriodFeedback', null, (value): value is CalculationResult => value === null || value === 'correct' || value === 'retry');
  const [calcTimeFeedback, setCalcTimeFeedback] = useLessonStoredState<CalculationResult>('3', 'calcTimeFeedback', null, (value): value is CalculationResult => value === null || value === 'correct' || value === 'retry');
  const [hintLevel, setHintLevel] = useLessonStoredState('3', 'hintLevel', 0, (value): value is number => isIntegerBetween(value, 0, 3));
  const [halfProgress, setHalfProgress] = useLessonStoredState('3', 'halfProgress', 0, (value): value is number => isNumberBetween(value, 0, 1));
  const [calcLeft, setCalcLeft] = useLessonStoredState('3', 'calcLeft', '', isString);
  const [calcRight, setCalcRight] = useLessonStoredState('3', 'calcRight', '', isString);
  const [calcOperation, setCalcOperation] = useLessonStoredState('3', 'calcOperation', '+', (value): value is string => value === '+' || value === '-' || value === '*' || value === '/' || value === 'square' || value === 'cube' || value === 'sqrt');
  const [calcResult, setCalcResult] = useLessonStoredState('3', 'calcResult', '', isString);
  const [summary, setSummary] = useLessonStoredState('3', 'summary', DEFAULT_SUMMARY, isStringRecord(['first', 'second', 'third'] as const));
  const [summaryChecked, setSummaryChecked] = useLessonStoredState('3', 'summaryChecked', false, isBoolean);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHalfPlaying, setIsHalfPlaying] = useState(false);
  const [animationRunId, setAnimationRunId] = useState(0);
  const [halfAnimationRunId, setHalfAnimationRunId] = useState(0);
  const transfer = useMemo(() => ellipseFromApsisDistancesAU(periapsisAU, apoapsisAU), [periapsisAU, apoapsisAU]);
  const calculationApoapsisAU = confirmedApoapsisAU ?? apoapsisAU;
  const target = useMemo(() => hohmannTransfer(1, calculationApoapsisAU), [calculationApoapsisAU]);
  const calculationValues = useMemo(() => transferCalculationValues(calculationApoapsisAU), [calculationApoapsisAU]);
  const constructionCorrect = Math.abs(periapsisAU - 1) <= 0.01 && Math.abs(apoapsisAU - 1.524) <= 0.01;
  const constructionReady = isConstructionReady(constructionSubmitted, constructionCorrect, notes.construction);
  const calculationReady = constructionReady && confirmedApoapsisAU !== null && Math.abs(confirmedApoapsisAU - apoapsisAU) < 1e-9;
  const elapsedModelSeconds = animationProgress * transfer.periodSeconds / 2;
  const liveState = stateAtTime(transfer.orbit, elapsedModelSeconds);
  const interval = (transfer.periodSeconds / 2) * 0.05;
  const departureDistance = distanceTraveledBetweenTimes(transfer.orbit, 0, interval, 96);
  const arrivalDistance = distanceTraveledBetweenTimes(transfer.orbit, transfer.periodSeconds / 2 - interval, transfer.periodSeconds / 2, 96);
  const calcCorrect = calcPhase === 3;
  const allMotionAnswered = motionSpeedAnswer !== null && motionDistanceAnswer !== null && motionLawAnswer !== null;
  const radioHasFeedback = animationProgress >= 1;

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    const startedAt = performance.now();
    const startingProgress = animationProgress;
    const remainingDurationMs = (1 - startingProgress) * SIMULATION_SECONDS * 1000 / animationSpeed;
    const tick = (now: number) => {
      const progress = Math.min(1, startingProgress + (now - startedAt) / remainingDurationMs);
      setAnimationProgress(progress);
      if (progress >= 1) {
        setIsPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, animationSpeed, animationRunId]);

  useEffect(() => {
    if (!isHalfPlaying) return;
    let frame = 0;
    const startedAt = performance.now();
    const startingProgress = halfProgress;
    const remainingDurationMs = (1 - startingProgress) * 5000;
    const tick = (now: number) => {
      const progress = Math.min(1, startingProgress + (now - startedAt) / remainingDurationMs);
      setHalfProgress(progress);
      if (progress >= 1) {
        setIsHalfPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isHalfPlaying, halfAnimationRunId]);

  function toggleTransferPlayback() {
    if (isPlaying) { setIsPlaying(false); return; }
    if (animationProgress >= 1) setAnimationProgress(0);
    setAnimationRunId((run) => run + 1);
    setIsPlaying(true);
  }

  function restartTransferPlayback() {
    setAnimationProgress(0);
    setAnimationRunId((run) => run + 1);
    setIsPlaying(true);
  }

  function toggleHalfPlayback() {
    if (isHalfPlaying) { setIsHalfPlaying(false); return; }
    if (halfProgress >= 1) setHalfProgress(0);
    setHalfAnimationRunId((run) => run + 1);
    setIsHalfPlaying(true);
  }

  function navigateTo(next: number) {
    if (next > Math.max(highestStep, step)) return;
    setIsPlaying(false);
    setIsHalfPlaying(false);
    setStep(next as Step);
    setCompleted(false);
  }

  function advanceTo(next: Step) {
    setCompletedSteps((current) => current.includes(step) ? current : [...current, step]);
    setHighestStep((current) => Math.max(current, next));
    setStep(next);
    setCompleted(false);
    setIsPlaying(false);
    setIsHalfPlaying(false);
  }

  function finishLesson() {
    setCompletedSteps((current) => current.includes(step) ? current : [...current, step]);
    setHighestStep(5);
    setCompleted(true);
    setIsPlaying(false);
    setIsHalfPlaying(false);
  }

  function restart() {
    if (!window.confirm('3차시를 처음부터 다시 시작할까요? 답변과 관찰 기록이 모두 지워집니다.')) return;
    clearLessonStoredState('3');
    setStep(0); setHighestStep(0); setCompletedSteps([]); setCompleted(false);
    setPrediction(null); setNotes(DEFAULT_NOTES);
    setPeriapsisAU(0.82); setApoapsisAU(1.72); setConfirmedApoapsisAU(null); setConstructionSubmitted(false);
    setAnimationProgress(0); setAnimationSpeed(1); setMotionSpeedAnswer(null); setMotionDistanceAnswer(null); setMotionLawAnswer(null); setIsPlaying(false); setIsHalfPlaying(false);
    setCalcA(''); setCalcPeriod(''); setCalcDays(''); setCalcPhase(0); setCalcAFeedback(null); setCalcPeriodFeedback(null); setCalcTimeFeedback(null); setHintLevel(0); setHalfProgress(0);
    setCalcLeft(''); setCalcRight(''); setCalcOperation('+'); setCalcResult(''); setSummary(DEFAULT_SUMMARY); setSummaryChecked(false);
  }

  function setNote(key: keyof Notes, value: string) { setNotes((current) => ({ ...current, [key]: value })); }
  function changePeriapsis(value: number) { setPeriapsisAU(value); setConstructionSubmitted(false); }
  function changeApoapsis(value: number) {
    const nextValues = transferCalculationValues(value);
    setApoapsisAU(value);
    setConfirmedApoapsisAU(null);
    setConstructionSubmitted(false);

    if (calcAFeedback === 'correct' && !isRoundedNumericAnswer(calcA, nextValues.semiMajorAxisAU, 3)) {
      setCalcAFeedback('retry'); setCalcPeriodFeedback(null); setCalcTimeFeedback(null); setCalcPhase(0);
      return;
    }

    const roundedSemiMajorAxisAU = Number(nextValues.semiMajorAxisAU.toFixed(3));
    const periodFromRoundedAxis = Math.sqrt(roundedSemiMajorAxisAU ** 3);
    if (calcPeriodFeedback === 'correct' && !isRoundedNumericAnswerAmong(calcPeriod, [nextValues.periodYears, periodFromRoundedAxis], 2)) {
      setCalcPeriodFeedback('retry'); setCalcTimeFeedback(null); setCalcPhase(1);
      return;
    }

    const roundedPeriodYears = Number(nextValues.periodYears.toFixed(2));
    const roundedPeriodFromRoundedAxis = Number(periodFromRoundedAxis.toFixed(2));
    const travelDaysFromRoundedPeriod = roundedPeriodYears * 365.25 / 2;
    const travelDaysFromRoundedAxisAndPeriod = roundedPeriodFromRoundedAxis * 365.25 / 2;
    if (calcTimeFeedback === 'correct' && !isRoundedNumericAnswerAmong(calcDays, [
      nextValues.transferDays,
      travelDaysFromRoundedPeriod,
      periodFromRoundedAxis * 365.25 / 2,
      travelDaysFromRoundedAxisAndPeriod,
    ], 1)) {
      setCalcTimeFeedback('retry'); setCalcPhase(2);
    }
  }
  function confirmConstruction() {
    setConfirmedApoapsisAU(apoapsisAU);
    setConstructionSubmitted(true);
  }
  function submitSemiMajor() {
    if (!calculationReady) return;
    const correct = isRoundedNumericAnswer(calcA, calculationValues.semiMajorAxisAU, 3);
    setCalcAFeedback(correct ? 'correct' : 'retry');
    if (correct) setCalcPhase(1);
  }

  function submitPeriod() {
    if (!calculationReady) return;
    const roundedSemiMajorAxisAU = Number(calculationValues.semiMajorAxisAU.toFixed(3));
    const periodFromRoundedAxis = Math.sqrt(roundedSemiMajorAxisAU ** 3);
    const correct = isRoundedNumericAnswerAmong(calcPeriod, [calculationValues.periodYears, periodFromRoundedAxis], 2);
    setCalcPeriodFeedback(correct ? 'correct' : 'retry');
    if (correct) setCalcPhase(2);
  }

  function submitTravelTime() {
    if (!calculationReady) return;
    const roundedSemiMajorAxisAU = Number(calculationValues.semiMajorAxisAU.toFixed(3));
    const periodFromRoundedAxis = Math.sqrt(roundedSemiMajorAxisAU ** 3);
    const roundedPeriodYears = Number(calculationValues.periodYears.toFixed(2));
    const roundedPeriodFromRoundedAxis = Number(periodFromRoundedAxis.toFixed(2));
    const correct = isRoundedNumericAnswerAmong(calcDays, [
      calculationValues.transferDays,
      roundedPeriodYears * 365.25 / 2,
      periodFromRoundedAxis * 365.25 / 2,
      roundedPeriodFromRoundedAxis * 365.25 / 2,
    ], 1);
    setCalcTimeFeedback(correct ? 'correct' : 'retry');
    if (correct) setCalcPhase(3);
  }

  function runCalculator() {
    const left = Number(calcLeft);
    const right = Number(calcRight);
    if (!Number.isFinite(left) || (calcOperation !== 'square' && calcOperation !== 'cube' && calcOperation !== 'sqrt' && !Number.isFinite(right))) { setCalcResult('숫자를 입력해 주세요.'); return; }
    const result = calcOperation === '+' ? left + right : calcOperation === '-' ? left - right : calcOperation === '*' ? left * right : calcOperation === '/' ? (right === 0 ? NaN : left / right) : calcOperation === 'square' ? left ** 2 : calcOperation === 'cube' ? left ** 3 : Math.sqrt(left);
    setCalcResult(Number.isFinite(result) ? String(Number(result.toPrecision(8))) : '계산할 수 없습니다.');
  }

  function renderCalculation() {
    return <section className="l3-stage" aria-label="케플러 제3법칙 계산 활동">
      <div className="l3-stage-heading"><span>전개 3</span><h2>케플러 제3법칙으로 이동 시간을 계산해요</h2></div>
      <p>AU와 년 단위를 쓰는 태양 중심 궤도에서는 <b>P² = a³</b>입니다. 단계별로 계산하고 마지막에 전이 구간을 확인해 보세요.</p>
      <p className="l3-transfer-basis">계산 기준: 근일점 1.000 AU · 현재 {confirmedApoapsisAU === null ? "선택" : "확정"} 원일점 {target.apoapsisAU.toFixed(3)} AU</p>
      {Math.abs(target.apoapsisAU - 1.524) >= 0.0005 && <ProgressNote>원일점이 화성 궤도 1.524 AU와 달라, 이번 계산은 학생이 설정한 근사 전이 궤도를 기준으로 합니다.</ProgressNote>}
      {!calculationReady && <ProgressNote>계산을 시작하려면 전개 1에서 원일점 값을 확정하고, 궤도 확인과 관찰 기록을 완료해 주세요. 이전 계산 답변은 남아 있습니다.</ProgressNote>}
      <div className="l3-calc-orbit"><OrbitFigure model={target} progress={halfProgress} showEqualTimeArcs={false}/><div className="l3-calc-orbit-key"><p><i className="whole-orbit"/><b>회색 점선</b> 전체 전이 타원 한 바퀴</p><p><i className="travelled-orbit"/><b>청록색 선</b> 근일점(지구 궤도)에서 원일점(화성 궤도)까지 지난 길</p><span>재생하면 탐사선이 지구 궤도에서 출발해 화성 궤도까지 타원의 절반을 따라갑니다.</span></div><div className="l3-calc-play"><button onClick={toggleHalfPlayback}>{isHalfPlaying ? '일시정지' : halfProgress >= 1 ? '다시 재생: 근일점 → 원일점' : '근일점에서 원일점까지 재생'}</button><progress max="1" value={halfProgress}/><span>{Math.round(halfProgress * 100)}%</span></div></div>
      <ol className="l3-calculation-steps">
        <li className={calcPhase >= 1 ? 'done' : 'active'}><b>1. 두 궤도 사이 타원의 크기</b><p>질문: 타원의 긴반지름을 왜 두 끝 거리의 평균으로 구할까요?</p><p>근일점 거리 1.000 AU와 현재 원일점 거리 {target.apoapsisAU.toFixed(3)} AU의 중간이 긴반지름입니다.<br/>a = (r근일점 + r원일점) / 2</p><p className="l3-rounding-hint">소수 셋째 자리까지 작성하세요.</p><label>내 계산값 <input aria-label="긴반지름 계산값 AU" type="number" step="0.001" value={calcA} onChange={(event) => { setCalcA(event.target.value); setCalcAFeedback(null); setCalcPeriodFeedback(null); setCalcTimeFeedback(null); setCalcPhase(0); }}/><span>AU</span></label><button disabled={!calculationReady} onClick={submitSemiMajor}>긴반지름 확인</button>{calcAFeedback && <Feedback correct={calcAFeedback === 'correct'}>{calcAFeedback === 'correct' ? `맞아요. 두 끝 거리의 평균은 ${calculationValues.semiMajorAxisAU.toFixed(3)} AU입니다. 타원의 중심은 근일점과 원일점의 중간에 있습니다.` : `원일점 ${target.apoapsisAU.toFixed(3)} AU 기준의 답과 다릅니다. 근일점 1.000 AU와 현재 원일점을 이용해 다시 계산해 제출해 보세요.`}</Feedback>}</li>
        <li className={calcPhase >= 2 ? 'done' : calcPhase === 1 ? 'active' : 'locked'}><b>2. 케플러 제3법칙으로 전체 주기</b><p>질문: 긴반지름 a로 전체 공전주기 P를 어떻게 구할까요?</p><p>AU와 년을 사용하는 태양 중심 궤도에서는 P² = a³, 따라서 P = √(a³)입니다.</p><p className="l3-rounding-hint">소수 둘째 자리까지 작성하세요.</p><label>내 계산값 <input aria-label="공전주기 계산값 년" type="number" step="0.01" value={calcPeriod} disabled={calcPhase < 1} onChange={(event) => { setCalcPeriod(event.target.value); setCalcPeriodFeedback(null); setCalcTimeFeedback(null); setCalcPhase(1); }}/><span>년</span></label><button disabled={!calculationReady || calcPhase < 1} onClick={submitPeriod}>주기 확인</button>{calcPeriodFeedback && <Feedback correct={calcPeriodFeedback === 'correct'}>{calcPeriodFeedback === 'correct' ? `맞아요. 전체 주기는 약 ${calculationValues.periodYears.toFixed(2)}년입니다.` : `원일점 ${target.apoapsisAU.toFixed(3)} AU에 맞춰 긴반지름을 세제곱하고 제곱근을 구한 뒤, 소수 둘째 자리로 반올림해 보세요.`}</Feedback>}</li>
        <li className={calcPhase === 3 ? 'done' : calcPhase === 2 ? 'active' : 'locked'}><b>3. 타원의 절반을 이동하는 시간</b><p>앞에서 구한 전체 공전주기를 이용하여 탐사선이 전이 타원의 절반을 이동하는 데 걸리는 시간을 계산해 보세요.</p><p>이동 시간 = 전체 공전주기 ÷ 2</p><p className="l3-rounding-hint">소수 첫째 자리까지 작성하세요.</p><label>내 계산값 <input aria-label="이동 시간 계산값 일" type="number" step="0.1" value={calcDays} disabled={calcPhase < 2 || halfProgress < 1} onChange={(event) => { setCalcDays(event.target.value); setCalcTimeFeedback(null); setCalcPhase(2); }}/><span>일</span></label><button disabled={!calculationReady || calcPhase < 2 || halfProgress < 1} onClick={submitTravelTime}>이동 시간 제출</button>{calcTimeFeedback && <Feedback correct={calcTimeFeedback === 'correct'}>{calcTimeFeedback === 'correct' ? `계산을 확인했어요. 이상적인 이동 시간은 약 ${calculationValues.transferDays.toFixed(1)}일입니다.` : `이전 답변은 남아 있습니다. 원일점 ${target.apoapsisAU.toFixed(3)} AU 기준의 주기와 절반 이동 시간을 이용해 다시 계산해 제출해 보세요.`}</Feedback>}</li>
      </ol>
      <section className="l3-calculation-reflection"><h3>탐구 결과 정리하기</h3><p>전이 타원의 긴반지름을 구하는 과정부터 케플러 제3법칙으로 이동 시간을 계산하는 과정까지 설명해 보세요. 또한 탐사선의 이동 시간이 전이 타원 전체 공전주기의 절반인 이유를 함께 서술해 보세요.</p><label>계산 과정과 이유<textarea rows={4} value={notes.calculation} onChange={(event) => setNote('calculation', event.target.value)} placeholder="긴반지름, 공전주기, 절반 이동 시간을 연결해 설명해 보세요."/></label></section><div className="l3-hints"><div><b>계산 힌트</b><button onClick={() => setHintLevel((current) => Math.min(3, current + 1))}>힌트 보기 {hintLevel > 0 ? `(${hintLevel}/3)` : ''}</button></div>{hintLevel >= 1 && <p>1) 긴반지름은 타원의 두 끝(근일점·원일점) 거리의 평균입니다.</p>}{hintLevel >= 2 && <p>2) P²=a³에서 양변의 제곱근을 구하면 P=√(a³)입니다. a는 AU, P는 년입니다.</p>}{hintLevel >= 3 && <p>3) 탐사선은 반 바퀴만 가므로 P/2에 365.25일/년을 곱합니다.</p>}</div>

      <button className="l3-next" disabled={!calcCorrect || notes.calculation.trim().length < 8} onClick={() => advanceTo(4)}>예상과 결과 비교 <span>→</span></button>
    </section>;
  }

  return <main className="lesson-main l3-main">
    <section className="lesson-intro"><div className="lesson-number">3차시 · 케플러 법칙을 활용한 화성 탐사</div><h1>지구에서 화성까지 어떤 길로 갈까요?</h1><p>이상적인 전이 타원을 구성하고, 세 케플러 법칙으로 탐사선의 운동과 이동 시간을 살펴봅니다.</p><div className="learning-objective"><b>오늘의 목표</b><span>전이 타원의 모양과 속도 변화를 관찰하고, 케플러 제3법칙으로 이동 시간을 계산합니다.</span></div></section>
    <section className="investigation-layout l3-layout" aria-label="화성 탐사선 전이 궤도 단계별 탐구">
      <div className="exploration-column">
        <LessonStepNavigation lessonLabel="3차시" steps={STEPS.map((label) => ({ label }))} currentStep={step} highestStep={completed ? 5 : highestStep} completedSteps={completedSteps} onNavigate={navigateTo}/>
        {(step === 1 || step === 2) && <section className="l3-orbit-panel"><div className="l3-orbit-title"><b>{step === 1 ? '전이 타원 구성' : '탐사선 운동 관찰'}</b><span>원형 · 동일 평면 · 태양 중심의 이상 모델</span></div><OrbitFigure model={transfer} progress={step === 2 ? animationProgress : 0} construction={step === 1} showEqualTimeArcs={step === 2 && animationProgress >= 1}/><div className="l3-legend"><span><i className="earth"/>지구 궤도</span><span><i className="mars"/>화성 궤도</span><span><i className="transfer"/>전이 타원</span><span><i className="probe"/>탐사선</span></div></section>}
        {step === 0 && <section className="l3-stage"><div className="l3-stage-heading"><span>도입</span><h2>탐사선은 어떤 길로 가야 할까요?</h2></div><p><b>질문</b> 지구에서 화성까지 탐사선을 보내려면 어떤 경로가 적절할까요?</p><fieldset className="answer-options"><legend>먼저 예상해 봅시다</legend><label><input type="radio" name="route" checked={prediction === 'line'} onChange={() => setPrediction('line')}/> 지구와 화성을 연결하는 직선 경로</label><label><input type="radio" name="route" checked={prediction === 'circle'} onChange={() => setPrediction('circle')}/> 태양을 중심으로 하는 원형 경로</label><label><input type="radio" name="route" checked={prediction === 'ellipse'} onChange={() => setPrediction('ellipse')}/> 태양을 한 초점으로 하는 타원형 경로</label><label><input type="radio" name="route" checked={prediction === 'other'} onChange={() => setPrediction('other')}/> 다른 경로 또는 잘 모르겠음</label></fieldset>{prediction && <ProgressNote>예상을 기록했습니다. 전이 궤도를 구성한 뒤 처음 생각과 비교해 보세요.</ProgressNote>}<label className="reflection-field">그렇게 예상한 까닭<textarea rows={3} value={notes.prediction} onChange={(event) => setNote('prediction', event.target.value)} placeholder="중력과 행성의 운동을 떠올려 이유를 적어 보세요."/></label><button className="next-step" disabled={!prediction} onClick={() => advanceTo(1)}>전이 타원 구성 <span>→</span></button></section>}
        {step === 1 && <section className="l3-stage"><div className="l3-stage-heading"><span>전개 1</span><h2>전이 타원의 양 끝을 맞춰 봅시다</h2></div><p>근일점이 지구 궤도에, 원일점이 화성 궤도에 닿도록 두 조절기를 움직여 보세요. 태양은 타원의 한 초점입니다.</p><div className="l3-controls"><label>근일점 거리 <b>{periapsisAU.toFixed(2)} AU</b><input aria-label="전이 타원 근일점 거리" type="range" min="0.7" max={Math.min(1.3, apoapsisAU - 0.02)} step="0.01" value={periapsisAU} onChange={(event) => changePeriapsis(Number(event.target.value))}/><span>0.70 AU <span>1.30 AU</span></span></label><label>원일점 거리 <b>{apoapsisAU.toFixed(3)} AU</b><input aria-label="전이 타원 원일점 거리" type="range" min={Math.max(1.1, periapsisAU + 0.02)} max="1.8" step="0.001" value={apoapsisAU} onChange={(event) => changeApoapsis(Number(event.target.value))}/><span>1.10 AU <span>1.80 AU</span></span></label></div><button className="l3-check" onClick={confirmConstruction}>내가 구성한 궤도 확인</button>{constructionSubmitted && <Feedback correct={constructionCorrect}>{constructionCorrect ? `근일점 ${periapsisAU.toFixed(2)} AU가 지구 궤도에, 원일점 ${apoapsisAU.toFixed(3)} AU가 화성 궤도에 닿습니다. 태양이 한 초점에 있는 타원 궤도이므로 케플러 제1법칙과 연결됩니다.` : '궤도 양 끝의 점이 각각 파란 지구 궤도와 주황 화성 궤도에 닿는지 확인하고 다시 조절해 보세요.'}</Feedback>}<label className="l3-reflection">관찰 기록<textarea rows={2} value={notes.construction} onChange={(event) => setNote('construction', event.target.value)} placeholder="두 원과 타원이 만나는 위치를 적어 보세요."/></label>{constructionReady ? <ProgressNote>궤도 확인과 관찰 기록이 모두 완료됐습니다. 다음 단계로 이동할 수 있습니다.</ProgressNote> : !constructionSubmitted ? <ProgressNote>다음 단계로 가려면 조절한 뒤 ‘내가 구성한 궤도 확인’을 눌러 결과를 확인하고, 관찰 기록을 작성하세요.</ProgressNote> : !constructionCorrect ? <ProgressNote>궤도 확인 결과가 아직 맞지 않습니다. 근일점 1.00 AU, 원일점 1.524 AU에 맞게 조절한 뒤 다시 확인하세요.</ProgressNote> : <ProgressNote>궤도는 맞게 구성됐습니다. 관찰 기록을 한 문장 이상 작성하면 다음 단계로 갈 수 있습니다.</ProgressNote>}<button className="next-step" disabled={!constructionReady} onClick={() => advanceTo(2)}>탐사선 운동 관찰 <span>→</span></button></section>}
        {step === 2 && <section className="l3-stage"><div className="l3-stage-heading"><span>전개 2</span><h2>탐사선의 속도는 어떻게 달라질까요?</h2></div><p>탐사선의 운동은 케플러 방정식으로 계산합니다. 밝은 점은 타원 궤도 위에서 실제 궤도 시간에 맞춰 움직이며, 속력은 태양 중심 관성계 기준입니다.</p><div className="l3-playback"><div><button onClick={toggleTransferPlayback}>{isPlaying ? '일시정지' : animationProgress >= 1 ? '다시 보기' : '재생'}</button><button className="secondary" onClick={restartTransferPlayback}>처음부터 재생</button></div><label>재생 속도 <select aria-label="탐사선 애니메이션 속도" value={animationSpeed} onChange={(event) => setAnimationSpeed(Number(event.target.value))}><option value="0.5">느리게</option><option value="1">보통</option><option value="2">빠르게</option></select></label><progress max="1" value={animationProgress}/><span>{Math.round(animationProgress * 100)}% 진행</span></div><div className="l3-live-data"><div><span>현재 태양 거리</span><b>{(liveState.radiusM / ASTRONOMICAL_UNIT_M).toFixed(2)} <small>AU</small></b></div><div><span>태양 기준 속력</span><b>{(liveState.speedMS / 1000).toFixed(1)} <small>km/s</small></b></div><p>속력은 태양 중심 관성계에서 본 값입니다. 전체 이동 시간은 계산 활동 후에 확인합니다.</p></div>{animationProgress >= 1 && <><div className="l3-distance-comparison"><b>같은 시간 동안 이동한 궤도 거리</b><span>두 구간은 같은 길이의 시간 간격입니다.</span>{[{ label: '출발 부근', distance: departureDistance, className: 'departure' }, { label: '도착 부근', distance: arrivalDistance, className: 'arrival' }].map((item) => <div className={`l3-distance-row ${item.className}`} key={item.className}><span>{item.label}</span><div><i style={{ width: `${(item.distance / departureDistance) * 100}%` }}/></div><b>{(item.distance / 1e9).toFixed(1)} <small>백만 km</small></b></div>)}</div><div className="l3-motion-questions"><fieldset className="answer-options"><legend>1. 더 빠르게 움직이는 곳은?</legend><label><input type="radio" name="motion-speed" checked={motionSpeedAnswer === 'departure'} onChange={() => setMotionSpeedAnswer('departure')}/> 출발 부근</label><label><input type="radio" name="motion-speed" checked={motionSpeedAnswer === 'arrival'} onChange={() => setMotionSpeedAnswer('arrival')}/> 도착 부근</label><label><input type="radio" name="motion-speed" checked={motionSpeedAnswer === 'same'} onChange={() => setMotionSpeedAnswer('same')}/> 두 곳이 같다</label></fieldset>{motionSpeedAnswer && <Feedback correct={motionSpeedAnswer === 'departure'}>{motionSpeedAnswer === 'departure' ? '맞아요. 가까운 근일점에서 더 빠르게 출발합니다.' : '같은 시간 간격의 출발·도착 구간과 속력 표시를 다시 비교해 보세요.'}</Feedback>}<fieldset className="answer-options"><legend>2. 태양에서 멀어질수록 속력은?</legend><label><input type="radio" name="motion-distance" checked={motionDistanceAnswer === 'decreases'} onChange={() => setMotionDistanceAnswer('decreases')}/> 느려진다</label><label><input type="radio" name="motion-distance" checked={motionDistanceAnswer === 'increases'} onChange={() => setMotionDistanceAnswer('increases')}/> 빨라진다</label><label><input type="radio" name="motion-distance" checked={motionDistanceAnswer === 'same'} onChange={() => setMotionDistanceAnswer('same')}/> 거의 같다</label></fieldset>{motionDistanceAnswer && <Feedback correct={motionDistanceAnswer === 'decreases'}>{motionDistanceAnswer === 'decreases' ? '맞아요. 타원 궤도에서는 태양에서 멀어질수록 속력이 작아집니다.' : '탐사선의 현재 태양 거리와 속력 수치를 함께 살펴보세요.'}</Feedback>}<fieldset className="answer-options"><legend>3. 케플러 제2법칙과 연결하면?</legend><label><input type="radio" name="motion-law" checked={motionLawAnswer === 'equal-area'} onChange={() => setMotionLawAnswer('equal-area')}/> 같은 시간 동안 쓸고 간 면적은 같다</label><label><input type="radio" name="motion-law" checked={motionLawAnswer === 'not-equal'} onChange={() => setMotionLawAnswer('not-equal')}/> 태양에서 멀수록 쓸린 면적이 더 크다</label><label><input type="radio" name="motion-law" checked={motionLawAnswer === 'unrelated'} onChange={() => setMotionLawAnswer('unrelated')}/> 제2법칙과 관련이 없다</label></fieldset>{motionLawAnswer && <Feedback correct={motionLawAnswer === 'equal-area'}>{motionLawAnswer === 'equal-area' ? '맞아요. 같은 시간 동안 면적은 같고, 태양 가까운 곳에서는 더 긴 궤도 거리를 움직여 속력이 커집니다.' : '쓸린 면적의 변화와 이동 거리·속력 변화를 연결해 보세요.'}</Feedback>}<label className="reflection-field">관찰 기록<textarea rows={2} value={notes.motion} onChange={(event) => setNote('motion', event.target.value)} placeholder="거리, 속력, 쓸린 면적의 관계를 적어 보세요."/></label></div></>}{animationProgress < 1 && <ProgressNote>먼저 재생해 출발에서 도착까지의 속력 변화를 관찰해 보세요.</ProgressNote>}<button className="next-step" disabled={!radioHasFeedback || !allMotionAnswered} onClick={() => advanceTo(3)}>이동 시간 계산 <span>→</span></button></section>}
        {step === 3 && renderCalculation()}
        {step === 4 && <section className="l3-stage"><div className="l3-stage-heading"><span>전개 4</span><h2>처음 예상과 계산 결과를 비교해요</h2></div><div className="l3-comparison-table"><div><b>도입에서 고른 경로</b><span>{prediction === 'line' ? '지구와 화성을 잇는 직선' : prediction === 'circle' ? '태양 중심 원형 경로' : prediction === 'ellipse' ? '태양을 한 초점으로 하는 타원형 경로' : '다른 경로 또는 잘 모르겠음'}</span></div><div><b>내가 계산한 이동 시간</b><span>{calcDays}일</span></div><div><b>이상 모델의 이동 시간</b><span>약 {Math.round(calculationValues.transferDays)}일</span></div></div>{notes.prediction && <p className="l3-original-reason"><b>처음 선택한 이유</b>{notes.prediction}</p>}<div className="l3-explanation"><b>해석</b><p>이 값은 원형·동일 평면 궤도 사이의 이상적인 호만 전이입니다. 실제 탐사에서는 행성의 위치와 발사 시기도 중요하며, 실제 임무 조건은 다음 차시에서 살펴봅니다.</p></div><label className="reflection-field">예상과 계산 결과를 비교해 설명해 보세요<textarea rows={3} value={notes.comparison} onChange={(event) => setNote('comparison', event.target.value)} placeholder="처음 고른 경로와 이동 시간 계산을 연결해 적어 보세요."/></label><button className="next-step" disabled={!calcCorrect || notes.comparison.trim().length < 10} onClick={() => advanceTo(5)}>세 법칙 정리 <span>→</span></button></section>}
        {step === 5 && !completed && <section className="l3-stage"><div className="l3-stage-heading"><span>정리</span><h2>세 법칙을 탐사선 궤도에 연결해요</h2></div><div className="l3-law-list"><label>탐사선의 전이 궤도는 태양을 한 초점으로 하는 타원<select value={summary.first} onChange={(event) => { setSummary({ ...summary, first: event.target.value }); setSummaryChecked(false); }}><option value="">법칙 선택</option><option value="1">제1법칙</option><option value="2">제2법칙</option><option value="3">제3법칙</option></select></label><label>태양에 가까운 구간에서 탐사선은 더 빠르게 움직임<select value={summary.second} onChange={(event) => { setSummary({ ...summary, second: event.target.value }); setSummaryChecked(false); }}><option value="">법칙 선택</option><option value="1">제1법칙</option><option value="2">제2법칙</option><option value="3">제3법칙</option></select></label><label>전이 타원의 긴반지름으로 이동 시간을 예측함<select value={summary.third} onChange={(event) => { setSummary({ ...summary, third: event.target.value }); setSummaryChecked(false); }}><option value="">법칙 선택</option><option value="1">제1법칙</option><option value="2">제2법칙</option><option value="3">제3법칙</option></select></label></div><button className="l3-check" onClick={() => setSummaryChecked(true)} disabled={!summary.first || !summary.second || !summary.third}>정리 확인</button>{summaryChecked && <Feedback correct={summary.first === '1' && summary.second === '2' && summary.third === '3'}>{summary.first === '1' && summary.second === '2' && summary.third === '3' ? '세 법칙을 전이 궤도와 이동 시간에 알맞게 연결했어요.' : '궤도 모양, 속력 변화, 주기와 긴반지름 중 무엇을 설명하는지 다시 생각해 보세요.'}</Feedback>}<div className="l3-next-question"><b>다음 차시 질문</b><p>탐사선이 화성의 공전 궤도에 도착하면 반드시 화성과 만날 수 있을까요?</p><small>선택형 심화 탐구에서는 실제 행성 위치와 발사 시기를 함께 탐구합니다.</small></div><label className="reflection-field">나의 생각<textarea rows={2} value={notes.arrival} onChange={(event) => setNote('arrival', event.target.value)} placeholder="화성의 위치와 탐사선의 도착 위치를 생각해 보세요."/></label><label className="reflection-field">오늘의 한 줄 정리<textarea rows={2} value={notes.summary} onChange={(event) => setNote('summary', event.target.value)} placeholder="세 법칙이 탐사선의 운동과 시간에 어떻게 쓰였나요?"/></label><button className="next-step" disabled={!summaryChecked || summary.first !== '1' || summary.second !== '2' || summary.third !== '3' || notes.summary.trim().length < 8} onClick={finishLesson}>3차시 완료 <span>✓</span></button></section>}
        {completed && <LessonCompletion title="3차시 탐구를 마쳤어요" introduction="이상적인 지구-화성 전이 타원을 구성하고 세 케플러 법칙을 적용했습니다." summaryTitle="오늘의 핵심" summary="전이 타원은 태양을 한 초점으로 하며, 태양에서 가까운 곳에서 더 빠르게 움직입니다. 긴반지름을 이용해 이동 시간을 예측할 수 있습니다." detail={`이상 모델의 계산 이동 시간은 약 ${Math.round(calculationValues.transferDays)}일입니다.`} nextLessonLabel="선택형 심화 탐구" nextLesson="실제 화성 위치와 탐사선의 도착 시점을 비교해 볼 수 있습니다." onRestart={restart} onSaveReport={onOpenRegularReport} reportButtonLabel="정규 학습 보고서 PDF 저장"/>}
      </div>
      <aside className="teacher-strip l3-teacher-strip"><b>모형 안내</b><p>지구·화성 궤도를 원형·동일 평면으로 놓은 이상적인 호만 전이 모형입니다. 실제 행성 위치와 발사 시기는 선택형 심화 탐구에서 다룹니다.</p>{!completed && <button onClick={restart}>처음부터 다시하기</button>}{step === 3 && <section className="l3-sidebar-calculator"><h2>계산 도구</h2><Calculator left={calcLeft} right={calcRight} operation={calcOperation} result={calcResult} onLeft={setCalcLeft} onRight={setCalcRight} onOperation={setCalcOperation} onCalculate={runCalculator}/><section className="l3-unit-help"><h3>단위 변환 도움말</h3><p>지구의 공전주기는 약 365일 6시간이므로 1년을 약 365.25일로 나타낼 수 있습니다.</p><p>년 단위를 일 단위로 바꾸려면 365.25를 곱합니다.</p><p>전이 타원의 절반을 이동하는 시간(일) = 전체 공전주기(년) ÷ 2 × 365.25</p></section></section>}</aside>
    </section>
  </main>;
}
