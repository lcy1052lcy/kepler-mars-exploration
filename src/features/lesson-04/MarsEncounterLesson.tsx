import { useEffect, useState } from 'react';
import { ellipseFromApsisDistancesAU } from '../../physics/transfers';
import { circularPlanetAngle, evaluateMarsEncounter, transferPositionAU } from '../../physics/encounter';
import { SECONDS_PER_DAY } from '../../physics/constants';
import { readLessonStoredSnapshot, clearLessonStoredState, isBoolean, isIndexList, isIntegerBetween, isNumberBetween, isString, useLessonStoredState } from '../../ui/lessonProgress';
import LessonStepNavigation from '../../ui/LessonStepNavigation';
import { canAdvanceEncounter, encounterRequirements } from './progression';
import { resolveAnimationClock } from './animationClock';
import './lesson-04.css';

const STEPS = ['시간 예상', '화성과 만날까?', '실제 탐사와 비교', '탐구 정리'];
const MARS_RADIUS_AU = 1.524;
const EARTH_PERIOD_DAYS = 365.25;
const MARS_PERIOD_DAYS = 686.98;
const MARS_2020_DAYS = 203;
type Prediction = 'meet' | 'miss' | 'unsure' | 'same' | 'different' | null;
type Status = 'no-orbit-crossing' | 'different-position' | 'same-position' | null;
const validPrediction = (value: unknown): value is Prediction => value === null || value === 'meet' || value === 'miss' || value === 'unsure' || value === 'same' || value === 'different';
const validStatus = (value: unknown): value is Status => value === null || value === 'no-orbit-crossing' || value === 'different-position' || value === 'same-position';
const validSpeed = (value: unknown): value is number => value === 0.5 || value === 1 || value === 2;
const validChoice = (value: unknown): value is string | null => value === null || typeof value === 'string';
const str = (value: unknown): string => typeof value === 'string' ? value : '';
const num = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const statusText = (status: Status): string => status === 'same-position' ? '슬라이더 해상도 안에서 거의 같은 위치' : status === 'different-position' ? '궤도는 교차하지만 위치는 다름' : status === 'no-orbit-crossing' ? '화성 궤도에 닿지 않음' : '미실행';

function importedLesson3() {
  const data = readLessonStoredSnapshot('3');
  const constructionSubmitted = data.constructionSubmitted === true;
  const periAU = num(data.periapsisAU);
  const apoAU = num(data.confirmedApoapsisAU) ?? (constructionSubmitted ? num(data.apoapsisAU) : null);
  const calcReady = data.calcPhase === 3 && data.calcTimeFeedback === 'correct';
  const calcDays = Number(str(data.calcDays));
  if (!constructionSubmitted || periAU === null || apoAU === null || apoAU <= periAU || !calcReady || !Number.isFinite(calcDays) || calcDays <= 0) return { ready: false as const };
  try {
    const model = ellipseFromApsisDistancesAU(periAU, apoAU);
    return {
      ready: true as const,
      periAU,
      apoAU,
      model,
      modeledDays: model.periodSeconds / SECONDS_PER_DAY / 2,
      submittedA: str(data.calcA),
      submittedPeriod: str(data.calcPeriod),
      submittedDays: str(data.calcDays),
      notes: data.notes && typeof data.notes === 'object' ? data.notes as Record<string, unknown> : {},
    };
  } catch { return { ready: false as const }; }
}

function OrbitalScene({ model, progress, marsPhaseDeg, durationSeconds, highlighted }: { model: ReturnType<typeof ellipseFromApsisDistancesAU>; progress: number; marsPhaseDeg: number; durationSeconds: number; highlighted: boolean }) {
  const cx = 360, cy = 255;
  const scale = 145 / Math.max(1.58, model.apoapsisAU, MARS_RADIUS_AU);
  const clock = resolveAnimationClock(progress, durationSeconds, model.periodSeconds / 2);
  const elapsed = clock.elapsedSeconds;
  const probe = transferPositionAU(model, elapsed);
  const earthAngle = circularPlanetAngle(0, elapsed, EARTH_PERIOD_DAYS);
  const marsAngle = circularPlanetAngle(marsPhaseDeg * Math.PI / 180, elapsed, MARS_PERIOD_DAYS);
  const px = cx + probe.x * scale, py = cy - probe.y * scale;
  const ex = cx + Math.cos(earthAngle) * scale, ey = cy - Math.sin(earthAngle) * scale;
  const mx = cx + MARS_RADIUS_AU * Math.cos(marsAngle) * scale, my = cy - MARS_RADIUS_AU * Math.sin(marsAngle) * scale;
  const ellipse = Array.from({ length: 241 }, (_, index) => {
    const anomaly = 2 * Math.PI * index / 240;
    const r = model.semiMajorAxisAU * (1 - model.eccentricity ** 2) / (1 + model.eccentricity * Math.cos(anomaly));
    const x = cx + r * Math.cos(anomaly) * scale, y = cy - r * Math.sin(anomaly) * scale;
    return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ') + ' Z';
  const trailCount = Math.max(2, Math.ceil(clock.progress * 120));
  const trail = Array.from({ length: trailCount + 1 }, (_, index) => {
    const state = transferPositionAU(model, elapsed * index / trailCount);
    return `${index ? 'L' : 'M'}${(cx + state.x * scale).toFixed(2)},${(cy - state.y * scale).toFixed(2)}`;
  }).join(' ');
  return <div className="l4-scene-wrap"><svg className="l4-scene" viewBox="0 0 720 510" role="img" aria-label="태양, 지구와 화성의 원 궤도, 학생이 설계한 전이 타원과 탐사선">
    <circle cx={cx} cy={cy} r={scale} fill="none" stroke="#5c9fe2" strokeWidth="2.5" strokeDasharray="8 6"/>
    <circle cx={cx} cy={cy} r={MARS_RADIUS_AU * scale} fill="none" stroke="#db9870" strokeWidth="2.5" strokeDasharray="8 6"/>
    <path d={ellipse} fill="none" stroke="#b7c1d0" strokeWidth="3" strokeDasharray="8 7" opacity=".9"/>
    <path d={trail} fill="none" stroke="#56ddca" strokeWidth="7" strokeLinecap="round"/>
    <circle cx={cx} cy={cy} r="15" fill="rgba(255,209,102,.2)"/><circle cx={cx} cy={cy} r="7" fill="#ffd166" stroke="#9b752f" strokeWidth="2"/>
    <circle cx={ex} cy={ey} r="17" fill="none" stroke="#78b8ff" strokeWidth="3"/><circle cx={mx} cy={my} r="10" fill="#ff9864" stroke="#fff1e6" strokeWidth="2"/>
    <circle cx={px} cy={py} r="19" fill="rgba(86,221,202,.24)"/><circle cx={px} cy={py} r="11" fill="#fff" stroke="#087f78" strokeWidth="4"/>
    <text x={cx+10} y={cy-15} fill="#ffe4a0" fontSize="14" fontWeight="700">태양</text>
    <text x={ex} y={ey-15} textAnchor="middle" fill="#cde5ff" fontSize="14" fontWeight="700">지구</text>
    <text x={mx} y={my-16} textAnchor="middle" fill="#ffd1b5" fontSize="14" fontWeight="700">화성</text>
    <text x={px+16} y={py+5} fill="#fff" fontSize="14" fontWeight="700">탐사선</text>
    <text x="22" y="32" fill="#eef3fb" fontSize="14">학생 설정 궤도 · a = {model.semiMajorAxisAU.toFixed(3)} AU · e = {model.eccentricity.toFixed(3)}</text>
    <text x="22" y="485" fill="#c5cfde" fontSize="13">{highlighted ? '밝은 청록색 선: 탐사선이 지금까지 지나온 길' : '회색 점선: 전체 전이 타원 · 청록색 실선: 지나온 경로'}</text>
  </svg><div className="l4-scene-legend"><span><i className="earth"/>지구 궤도와 지구</span><span><i className="mars"/>화성 궤도와 화성</span><span><i className="transfer"/>전이 타원</span><span><i className="probe"/>탐사선</span></div></div>;
}

export default function MarsEncounterLesson({ onReturnToLesson3, onOpenAdvancedReport }: { onReturnToLesson3: () => void; onOpenAdvancedReport?: () => void }) {
  const [step, setStep] = useLessonStoredState('4', 'step', 0, (v): v is number => isIntegerBetween(v, 0, 3));
  const [highest, setHighest] = useLessonStoredState('4', 'highestStep', 0, (v): v is number => isIntegerBetween(v, 0, 3));
  const [completedSteps, setCompletedSteps] = useLessonStoredState('4', 'completedSteps', [] as number[], (v): v is number[] => isIndexList(v, 3));
  const [completed, setCompleted] = useLessonStoredState('4', 'completed', false, isBoolean);
  const [prediction, setPrediction] = useLessonStoredState<Prediction>('4', 'introEncounterPrediction', null, validPrediction);
  const hasPrediction = prediction === 'meet' || prediction === 'miss' || prediction === 'unsure';
  const arrivalPrediction = hasPrediction ? prediction : null;
  const setArrivalPrediction = (value: 'meet' | 'miss' | 'unsure') => setPrediction(value);
  const [predictionReason, setPredictionReason] = useLessonStoredState('4', 'introEncounterReason', '', isString);
  const [marsPhase, setMarsPhase] = useLessonStoredState('4', 'marsStartPhaseDeg', 0, (v): v is number => isNumberBetween(v, 0, 359));
  const [progress, setProgress] = useLessonStoredState('4', 'simulationProgress', 0, (v): v is number => isNumberBetween(v, 0, 1));
  const [speed, setSpeed] = useLessonStoredState('4', 'simulationSpeed', 1, validSpeed);
  const [initialStatus, setInitialStatus] = useLessonStoredState<Status>('4', 'initialResult', null, validStatus);
  const [currentStatus, setCurrentStatus] = useLessonStoredState<Status>('4', 'currentResult', null, validStatus);
  const [initialPhase, setInitialPhase] = useLessonStoredState('4', 'initialPhase', 0, (v): v is number => isNumberBetween(v, 0, 359));
  const [hasRun, setHasRun] = useLessonStoredState('4', 'hasRun', false, isBoolean);
  const [adjustedRun, setAdjustedRun] = useLessonStoredState('4', 'adjustedRunComplete', false, isBoolean);
  const [firstRunPhase, setFirstRunPhase] = useLessonStoredState('4', 'firstRunPhase', hasRun ? initialPhase : null as number | null, (v): v is number | null => v === null || isNumberBetween(v, 0, 359));
  const [observedPrediction, setObservedPrediction] = useLessonStoredState('4', 'observedPrediction', '', isString);
  const [encounterNotes, setEncounterNotes] = useLessonStoredState('4', 'encounterNotes', '', isString);
  const [periodNotes, setPeriodNotes] = useLessonStoredState('4', 'periodNotes', '', isString);
  const [dayDifference, setDayDifference] = useLessonStoredState('4', 'dayDifferenceAnswer', '', isString);
  const [actualSameConditions, setActualSameConditions] = useLessonStoredState<string | null>('4', 'actualSameConditions', null, validChoice);
  const [actualReason, setActualReason] = useLessonStoredState('4', 'actualReason', '', isString);
  const [actualFeedback, setActualFeedback] = useLessonStoredState('4', 'actualFeedback', false, isBoolean);
  const [summary, setSummary] = useLessonStoredState('4', 'summary', '', isString);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showActual, setShowActual] = useLessonStoredState('4', 'actualDataRevealed', false, isBoolean);
  const [showEncounterResult, setShowEncounterResult] = useLessonStoredState('4', 'encounterResultRevealed', false, isBoolean);
  const [source, setSource] = useState(() => importedLesson3());
  const model = source.ready ? source.model : null;
  const crossing = model ? evaluateMarsEncounter(model, marsPhase * Math.PI / 180) : null;
  const fallbackTripSeconds = model && Number.isFinite(model.periodSeconds) && model.periodSeconds > 0 ? model.periodSeconds / 2 : 0;
  const crossingSeconds = crossing?.crossing?.elapsedSeconds;
  const tripSeconds = Number.isFinite(crossingSeconds) && (crossingSeconds ?? -1) >= 0 ? crossingSeconds! : fallbackTripSeconds;
  const safeClock = resolveAnimationClock(progress, tripSeconds, fallbackTripSeconds);
  const live = model ? transferPositionAU(model, safeClock.elapsedSeconds) : null;
  const resultStatus = currentStatus ?? crossing?.status ?? null;

  // Re-read after mount: switching away from Lesson 3 flushes its pending debounced saves on unmount.
  useEffect(() => { setSource(importedLesson3()); }, []);

  useEffect(() => {
    if (!isPlaying || !model) return;
    let frame = 0;
    const started = performance.now();
    const initial = resolveAnimationClock(progress, tripSeconds, fallbackTripSeconds).progress;
    const duration = (1 - initial) * 9000 / (validSpeed(speed) ? speed : 1);
    const tick = (now: number) => {
      const next = Number.isFinite(now) && Number.isFinite(duration) && duration > 0
        ? Math.min(1, Math.max(0, initial + (now - started) / duration))
        : 1;
      setProgress(next);
      if (next >= 1) {
        setIsPlaying(false);
        const status = evaluateMarsEncounter(model, marsPhase * Math.PI / 180).status;
        setCurrentStatus(status);
        setShowEncounterResult(false);
        if (firstRunPhase === null) { setInitialStatus(status); setInitialPhase(marsPhase); setFirstRunPhase(marsPhase); setHasRun(true); }
        else if (Math.abs(marsPhase - firstRunPhase) > 1e-6) setAdjustedRun(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, speed, model, marsPhase, firstRunPhase, tripSeconds, fallbackTripSeconds]);

  function moveTo(next: number) {
    if (next > Math.max(highest, step)) return;
    setIsPlaying(false); setStep(next); setCompleted(false);
  }
  function advance() {
    setCompletedSteps((current) => current.includes(step) ? current : [...current, step]);
    setHighest((current) => Math.max(current, step + 1));
    setStep((current) => Math.min(3, current + 1)); setCompleted(false);
  }
  function restartPlayback() { setProgress(0); setCurrentStatus(null); setShowEncounterResult(false); setIsPlaying(true); }
  function changeMarsPhase(value: number) {
    setIsPlaying(false); setMarsPhase(value); setProgress(0); setCurrentStatus(null); setShowEncounterResult(false);
    setAdjustedRun(false);
  }
  function submitActual() {
    setActualFeedback(true);
    setShowActual(true);
  }
  function restartLesson() {
    if (!window.confirm('선택형 심화 탐구를 처음부터 다시 시작할까요? 이 활동의 답변과 설정만 삭제됩니다.')) return;
    setIsPlaying(false);
    setStep(0); setHighest(0); setCompletedSteps([]); setCompleted(false);
    setPrediction(null); setPredictionReason('');
    setMarsPhase(0); setProgress(0); setSpeed(1); setInitialStatus(null); setCurrentStatus(null); setInitialPhase(0);
    setHasRun(false); setAdjustedRun(false); setFirstRunPhase(null); setObservedPrediction(''); setEncounterNotes(''); setPeriodNotes('');
    setDayDifference(''); setActualSameConditions(null); setActualReason(''); setActualFeedback(false); setSummary('');
    setShowActual(false); setShowEncounterResult(false);
    // Clearing after React commits prevents the save-hook cleanup from restoring the pre-reset values.
    window.setTimeout(() => clearLessonStoredState('4'), 0);
  }

  if (!source.ready || !model) return <main className="lesson-main l4-main"><section className="lesson-intro"><div className="lesson-number">선택형 심화 탐구 · 실제 화성 탐사</div><h1>실제 탐사선도 같은 궤도를 따라 이동할까?</h1><p>이 활동은 3차시에서 확정한 궤도와 계산 결과를 이어서 사용합니다.</p></section><div className="l4-missing"><h2>먼저 3차시 계산을 완료해 주세요</h2><p>이 활동은 저장된 근일점·원일점과 제출한 공전주기·이동 시간을 불러옵니다. 3차시 자료를 임의의 값으로 대신하지 않습니다.</p><button type="button" onClick={onReturnToLesson3}>3차시로 돌아가기</button></div></main>;

  const expectedDifference = Math.abs(MARS_2020_DAYS - Number(source.submittedDays));
  const readyForStage1 = prediction === 'meet' || prediction === 'miss' || prediction === 'unsure';
  const stage1Progress = { firstRunComplete: hasRun, changedPositionRunComplete: adjustedRun, resultConfirmed: showEncounterResult && currentStatus !== null, predictionCompared: observedPrediction as 'yes' | 'no' | '' };
  const stage1Ready = canAdvanceEncounter(stage1Progress);
  const stage1Requirements = encounterRequirements(stage1Progress);
  const correctDifference = Number.isFinite(Number(dayDifference)) && Math.abs(Number(dayDifference) - expectedDifference) <= 1;

  return <main className="lesson-main l4-main">
    <section className="lesson-intro"><div className="lesson-number">선택형 심화 탐구 · 케플러 법칙의 실제 적용</div><h1>실제 탐사선도 같은 궤도를 따라 이동할까?</h1><p>내가 설계한 전이 궤도에서 화성이 움직이는 모습을 살펴보고, 이상적인 계산과 실제 탐사 기록을 비교합니다.</p><div className="learning-objective"><b>이어 보기</b><span>3차시에서 확정한 학생별 궤도와 제출한 계산값을 불러왔습니다. 궤도 모형 계산값과 학생 입력값은 따로 표시합니다.</span></div></section>
    <div className="investigation-layout l4-layout"><div className="exploration-column">
      <LessonStepNavigation lessonLabel="선택형 심화 탐구" steps={STEPS.map((label) => ({ label }))} currentStep={step} highestStep={completed ? 3 : highest} completedSteps={completedSteps} onNavigate={moveTo}/>
      {completed && step === 3 && <button type="button" className="sr-completion-report" onClick={onOpenAdvancedReport}>심화 탐구 보고서 PDF 저장</button>}
      {step === 1 && !stage1Ready && stage1Requirements.length > 0 && <ul className="l4-requirements l4-requirements-live" aria-live="polite">{stage1Requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>}
      {step === 0 && <section className="activity-panel l4-activity"><div className="activity-heading"><span>도입</span><h2>나의 탐사선은 화성과 만날 수 있을까요?</h2></div><div className="l4-student-model"><b>3차시에서 가져온 나의 설정</b><div><span>근일점 <strong>{source.periAU.toFixed(3)} AU</strong></span><span>원일점 <strong>{source.apoAU.toFixed(3)} AU</strong></span><span>긴반지름 <strong>{source.submittedA.trim() || '미제출'}{source.submittedA.trim() ? ' AU' : ''}</strong></span><span>공전주기 <strong>{source.submittedPeriod.trim() || '미제출'}{source.submittedPeriod.trim() ? '년' : ''}</strong></span><span>이동 시간 <strong>{source.submittedDays.trim() || '미제출'}{source.submittedDays.trim() ? '일' : ''}</strong></span></div><div className="l4-model-reference"><b>모형 계산 참고값</b><span>긴반지름 {source.model.semiMajorAxisAU.toFixed(4)} AU · 전체 주기 {(source.model.periodSeconds / SECONDS_PER_DAY / 365.25).toFixed(4)}년 · 절반 이동 {source.modeledDays.toFixed(1)}일</span><small>물리 모형의 계산값이며 학생이 제출한 답을 대신하지 않습니다.</small></div>{Object.entries(source.notes).filter(([, value]) => typeof value === 'string' && value.trim()).length > 0 && <details className="l4-prior-notes"><summary>3차시 탐구 기록 확인</summary>{Object.entries(source.notes).filter(([, value]) => typeof value === 'string' && value.trim()).map(([key, value]) => <p key={key}><b>{({ prediction: '경로 예상', construction: '궤도 구성', motion: '운동 관찰', calculation: '계산 과정', comparison: '결과 비교', summary: '정리', arrival: '도착 질문' } as Record<string, string>)[key] ?? key}</b> · {String(value)}</p>)}</details>}</div><p className="l4-question">내가 설계한 궤도로 이동하면 탐사선은 화성과 만날 수 있을까요?</p><p className="l4-prompt-note">3차시에서 설계한 전이 궤도와 지구·화성의 운동을 떠올리며 예상해 보세요. 아직 정답을 몰라도 괜찮습니다.</p><fieldset className="answer-options"><legend>먼저 예상해 봅시다</legend><label><input type="radio" name="l4-prediction" checked={prediction === 'meet'} onChange={() => setPrediction('meet')}/> 만날 수 있을 것이다</label><label><input type="radio" name="l4-prediction" checked={prediction === 'miss'} onChange={() => setPrediction('miss')}/> 만나지 못할 것이다</label><label><input type="radio" name="l4-prediction" checked={prediction === 'unsure'} onChange={() => setPrediction('unsure')}/> 잘 모르겠다</label></fieldset>{(prediction === 'same' || prediction === 'different') && <p className="l4-hint">이전 도입 질문의 답은 유지되어 있습니다. 새 질문에 대한 예상도 선택해 주세요.</p>}<label className="reflection-field">그렇게 예상한 이유<textarea rows={3} value={predictionReason} onChange={(e) => setPredictionReason(e.target.value)} placeholder="궤도와 행성의 운동에 대한 생각을 적어 보세요."/></label><button className="next-step" disabled={!readyForStage1} onClick={advance}>화성과 만날지 탐구하기 →</button></section>}
      {step === 1 && <>
        <section className="l4-orbit-panel"><div className="l4-panel-title"><b>같은 경과 시간에 움직이는 천체</b><span>태양 중심 · 동일 평면 · 원형 행성 궤도 가정</span></div><OrbitalScene model={model} progress={safeClock.progress} marsPhaseDeg={marsPhase} durationSeconds={tripSeconds} highlighted={progress > 0}/><div className="l4-controls"><button type="button" onClick={() => setIsPlaying((value) => !value)} disabled={progress >= 1 || (!hasRun && !arrivalPrediction)}>{isPlaying ? '일시정지' : '재생'}</button><button type="button" className="secondary" onClick={restartPlayback} disabled={!hasRun && !arrivalPrediction}>{progress >= 1 ? '다시 보기' : '처음부터 재생'}</button><label>재생 속도 <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={0.5}>느리게</option><option value={1}>보통</option><option value={2}>빠르게</option></select></label><progress max="1" value={safeClock.progress}/><b>{Math.round(safeClock.progress * 100)}%</b></div><div className="l4-live-readout"><span>경과 시간 <b>{(safeClock.elapsedSeconds / SECONDS_PER_DAY).toFixed(1)}일</b></span><span>탐사선-태양 거리 <b>{live?.radius.toFixed(3)} AU</b></span><span>태양 기준 속력 <b>{live ? (live.speedMS / 1000).toFixed(2) : '—'} km/s</b></span><span>지구 공전 위치 <b>같은 시간으로 계산</b></span></div><div className="l4-phase-control l4-sim-phase-control"><label htmlFor="mars-phase">화성의 출발 위치 <b>{marsPhase}°</b></label><input id="mars-phase" type="range" min="0" max="359" step="1" value={marsPhase} disabled={!hasRun || isPlaying} onChange={(e) => changeMarsPhase(Number(e.target.value))}/><div><span>0°</span><span>{!hasRun ? '먼저 재생해 화성의 움직임을 관찰하세요.' : isPlaying ? '재생을 마치면 위치를 바꿀 수 있습니다.' : '위치를 바꾼 뒤 다시 재생해 두 결과를 비교하세요.'}</span><span>359°</span></div></div></section>
        <section className="activity-panel l4-activity"><div className="activity-heading"><span>전개 1</span><h2>탐사선은 화성과 만날까요?</h2></div><div className="l4-activity-guide"><b>활동 안내</b><p>탐사선이 이동하는 동안 화성도 태양 주위를 공전합니다. 화성의 출발 위치를 바꾸고 시뮬레이션을 다시 실행하여 탐사선과 화성의 위치 관계가 어떻게 달라지는지 관찰해 보세요.</p><ol><li>첫 조건에서 실행하고 위치 관계 관찰</li><li>화성의 출발 위치를 변경</li><li>변경한 조건으로 다시 실행</li><li>두 결과를 비교하고 예상과 대조</li></ol></div><fieldset className="answer-options"><legend>첫 실행 전에 예상</legend><label><input type="radio" name="l4-arrival" checked={arrivalPrediction === 'meet'} onChange={() => setArrivalPrediction('meet')}/> 화성과 같은 위치에 도착할 것이다</label><label><input type="radio" name="l4-arrival" checked={arrivalPrediction === 'miss'} onChange={() => setArrivalPrediction('miss')}/> 화성은 다른 위치에 있을 것이다</label><label><input type="radio" name="l4-arrival" checked={arrivalPrediction === 'unsure'} onChange={() => setArrivalPrediction('unsure')}/> 잘 모르겠다</label></fieldset>{hasRun && <fieldset className="answer-options"><legend>첫 실행 결과와 나의 예상 비교</legend><label><input type="radio" name="l4-observed" value="yes" checked={observedPrediction === 'yes'} onChange={() => setObservedPrediction('yes')}/> 예상과 관찰 결과가 같았다</label><label><input type="radio" name="l4-observed" value="no" checked={observedPrediction === 'no'} onChange={() => setObservedPrediction('no')}/> 예상과 관찰 결과가 달랐다</label></fieldset>}<label className="reflection-field">화성의 초기 위치를 바꾸고 다시 실행한 결과를 적어 보세요<textarea rows={3} value={encounterNotes} onChange={(e) => setEncounterNotes(e.target.value)} placeholder="화성은 탐사선이 이동하는 동안에도 공전합니다. 초기 위치를 바꾸어 관찰해 보세요."/></label><label className="reflection-field">케플러 제3법칙과 행성의 위치 변화를 연결해 설명해 보세요<textarea rows={3} value={periodNotes} onChange={(e) => setPeriodNotes(e.target.value)} placeholder="지구와 화성의 공전주기가 서로 다른 점을 생각해 보세요."/></label>{progress >= 1 && !showEncounterResult && <button type="button" className="l4-reveal" onClick={() => setShowEncounterResult(true)}>현재 조건의 관찰 결과 확인</button>}{showEncounterResult && currentStatus !== null && <div className={`l4-result ${resultStatus === 'same-position' ? 'success' : ''}`} role="status"><b>{resultStatus === 'no-orbit-crossing' ? '이 궤도는 화성 궤도까지 닿지 않습니다.' : resultStatus === 'same-position' ? '이상 모형에서 탐사선과 화성이 슬라이더 해상도 안에서 거의 같은 위치에 도달합니다.' : '이 궤도는 화성 궤도와 교차하지만, 화성은 그 시각에 다른 위치에 있습니다.'}</b><p>{resultStatus === 'no-orbit-crossing' ? `내 전이 타원의 원일점 ${source.apoAU.toFixed(3)} AU는 화성 궤도 1.524 AU보다 안쪽입니다.` : `내 조건에서는 두 천체가 화성 궤도 반지름을 통과하는 시각(약 ${(tripSeconds / SECONDS_PER_DAY).toFixed(1)}일)에 위치를 비교했습니다. 화성 초기 위치 ${marsPhase}°를 사용했습니다.`}</p>{crossing && crossing.separationAU !== null && <p>탐사선과 화성의 위치 차이: 약 {crossing.separationAU.toFixed(4)} AU ({crossing.angularDifferenceDeg?.toFixed(2)}°). 이 판정은 1° 간격 슬라이더의 해상도에 맞춘 최대 {crossing.positionToleranceAU.toFixed(4)} AU 허용 범위를 사용합니다.</p>}{initialStatus !== null && <small>첫 실행({initialPhase}°): {statusText(initialStatus)} · 현재 실행: {statusText(currentStatus)}</small>}<small>이상적인 원형·동일 평면 모형에서의 근접 위치 판정이며 실제 충돌이나 도킹을 뜻하지 않습니다.</small></div>}<button className="next-step" disabled={!stage1Ready} onClick={advance}>실제 탐사 자료와 비교 →</button></section>
      </>}
      {step === 2 && <section className="activity-panel l4-activity"><div className="activity-heading"><span>전개 2</span><h2>퍼서비어런스 실제 비행과 비교</h2></div><p>이제 실제 임무 기록을 열어 3차시 계산값과 비교합니다.</p><button type="button" className="l4-reveal" onClick={() => setShowActual(true)}>{showActual ? '실제 자료 확인됨' : 'NASA/JPL 실제 자료 보기'}</button>{showActual && <div className="l4-real-data"><b>NASA/JPL 퍼서비어런스</b><span>발사일 · 2020년 7월 30일</span><span>화성 착륙일 · 2021년 2월 18일</span><strong>실제 비행 기간 · 약 203일</strong><a href="https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/" target="_blank" rel="noreferrer">출처: NASA/JPL Mars 2020 Mission Press Kit</a></div>}<div className="l4-comparison-values"><div><small>내가 3차시에서 제출한 이동 시간</small><b>{source.submittedDays}일</b></div>{showActual && <div><small>실제 비행 기간</small><b>약 203일</b></div>}</div>{showActual && <><label className="reflection-field">두 이동 시간의 차이를 계산해 입력하세요 (일)<input type="number" step="any" value={dayDifference} onChange={(e) => setDayDifference(e.target.value)} placeholder="차이(일)"/></label><fieldset className="answer-options"><legend>실제 탐사 기록과 이상적인 모형의 전제는 같은가요?</legend><label><input type="radio" name="same-conditions" checked={actualSameConditions === 'same'} onChange={() => setActualSameConditions('same')}/> 같다</label><label><input type="radio" name="same-conditions" checked={actualSameConditions === 'different'} onChange={() => setActualSameConditions('different')}/> 다르다</label></fieldset><p className="l4-condition-help">이상적인 모형은 지구·화성 궤도를 원형·같은 평면으로 두고 태양 중심 전이를 가정합니다. 실제 임무에는 실제 행성 위치, 발사 시점, 비행 경로와 도착 조건이 반영됩니다.</p><label className="reflection-field">실제 비행 기간이 이상적인 모형과 다를 수 있는 이유<textarea rows={3} value={actualReason} onChange={(e) => setActualReason(e.target.value)} placeholder="원형 궤도 가정과 실제 임무의 조건을 비교해 보세요."/></label><button type="button" className="l4-reveal" onClick={submitActual}>비교 답변 확인</button>{actualFeedback && <div className={`l4-result ${correctDifference && actualSameConditions === 'different' ? 'success' : ''}`} role="status"><b>{correctDifference && actualSameConditions === 'different' ? '차이를 잘 계산하고 조건을 구분했어요.' : '계산과 조건을 다시 확인해 볼까요?'}</b><p>내 계산은 {dayDifference || '—'}일 차이입니다. 3차시 제출값 기준 차이는 약 {expectedDifference.toFixed(1)}일입니다.</p><p>실제 임무와 이상적인 두 원형·동일 평면 궤도 모형은 같은 조건의 측정값이 아닙니다. 실제 임무에는 행성의 실제 위치, 출발 조건, 경로와 도착 조건이 반영되므로 차이가 케플러 법칙의 오류를 뜻하지 않습니다.</p></div>}</>}<button className="next-step" disabled={!showActual || !actualFeedback || !correctDifference || actualSameConditions !== 'different' || actualReason.trim().length < 12} onClick={advance}>탐구 정리하기 →</button></section>}
      {step === 3 && <section className="activity-panel l4-activity"><div className="activity-heading"><span>정리</span><h2>탐구 결과와 모형의 한계</h2></div><p className="l4-question">케플러 법칙을 이용해 화성 탐사선의 운동을 어디까지 예측할 수 있을까요?</p><p>나의 궤도 설정, 계산한 이동 시간, 이동 중 화성의 위치 변화, 퍼서비어런스 실제 비행과의 차이를 근거로 정리해 보세요.</p><label className="reflection-field">탐구 결과<textarea rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="케플러 법칙으로 예측할 수 있는 점과 이상화 모형의 한계를 함께 적어 보세요."/></label><div className="l4-summary-model"><b>이번 탐구에서 확인한 점</b><ul><li>제1법칙으로 태양을 초점에 둔 타원 전이 궤도를 표현했습니다.</li><li>제2법칙에 따라 탐사선은 태양 가까이에서 더 빠르게 움직입니다.</li><li>제3법칙과 행성의 서로 다른 공전주기로 이동 시간과 화성의 위치 변화를 예측했습니다.</li></ul></div>{completed ? <><div className="l4-result success">선택형 심화 탐구 기록이 저장되었습니다.</div><button type="button" className="l4-report-button" onClick={() => window.print()}>학습 보고서 인쇄 · PDF로 저장</button><p className="l4-report-instruction">인쇄 창에서 ‘PDF로 저장’을 선택하면 이 보고서를 파일로 저장할 수 있습니다.</p><article className="l4-report-print"><h1>케플러 법칙으로 떠나는 화성 탐사</h1><p className="l4-report-subtitle">선택형 심화 탐구 보고서 · 실제 화성 탐사선 도착 탐구</p><p className="l4-report-date">작성일: {new Date().toLocaleDateString('ko-KR')}</p><h2>1. 3차시에서 가져온 나의 탐구 결과</h2><dl><dt>전이 궤도 근일점</dt><dd>{source.periAU.toFixed(3)} AU</dd><dt>전이 궤도 원일점</dt><dd>{source.apoAU.toFixed(3)} AU</dd><dt>긴반지름(제출)</dt><dd>{source.submittedA.trim() || '미제출'}{source.submittedA.trim() ? ' AU' : ''}</dd><dt>공전주기(제출)</dt><dd>{source.submittedPeriod.trim() || '미제출'}{source.submittedPeriod.trim() ? '년' : ''}</dd><dt>이동 시간(제출)</dt><dd>{source.submittedDays.trim() || '미제출'}{source.submittedDays.trim() ? '일' : ''}</dd></dl><h2>2. 도입 예상과 근거</h2><p><b>예상:</b> {prediction === 'meet' ? '만날 수 있을 것이다' : prediction === 'miss' ? '만나지 못할 것이다' : prediction === 'unsure' ? '잘 모르겠다' : '미응답'}</p><p><b>이유:</b> {predictionReason.trim() || '미작성'}</p><h2>3. 화성 위치 변화 시뮬레이션</h2><p><b>첫 실행:</b> 화성 초기 위치 {initialPhase}° · {statusText(initialStatus)}</p><p><b>두 번째 실행:</b> 화성 초기 위치 {marsPhase}° · {statusText(currentStatus)}</p><p><b>관찰과 예상 비교:</b> {observedPrediction === 'yes' ? '같았다' : observedPrediction === 'no' ? '달랐다' : '미응답'}</p><p><b>위치 변화 기록:</b> {encounterNotes.trim() || '미작성'}</p><p><b>공전주기와 연결한 설명:</b> {periodNotes.trim() || '미작성'}</p><p>시뮬레이션은 이상적인 원형·동일 평면 모형에서 궤도 교차와 같은 시각의 행성 위치를 비교합니다. 궤도가 화성 궤도에 닿는 것과 탐사선이 화성과 같은 시각·위치에 도착하는 것은 다릅니다.</p><h2>4. 실제 탐사 자료 비교</h2><p>퍼서비어런스 실제 비행 기간: 약 {MARS_2020_DAYS}일 · 내 계산과의 차이: {dayDifference.trim() || '미작성'}일</p><p><b>모형과 실제 임무의 전제:</b> {actualSameConditions === 'different' ? '다르다' : actualSameConditions === 'same' ? '같다' : '미응답'}</p><p><b>이유:</b> {actualReason.trim() || '미작성'}</p><p className="l4-report-source">자료 출처: NASA/JPL Mars 2020 Mission Press Kit (발사 2020년 7월 30일, 착륙 2021년 2월 18일)</p><h2>5. 나의 탐구 정리</h2><p className="l4-report-summary">{summary}</p><footer>본 보고서는 이 브라우저에 저장된 학생의 답변과 탐구 기록을 바탕으로 생성했습니다.</footer></article></> : <button className="next-step" disabled={summary.trim().length < 20} onClick={() => { setCompletedSteps((current) => current.includes(3) ? current : [...current, 3]); setHighest(3); setCompleted(true); }}>탐구 마치기</button>}</section>}
    </div><aside className="teacher-strip l4-sidebar"><b>3차시 나의 탐구 결과</b><p>학생이 설정하고 직접 제출한 값을 먼저 표시합니다.</p><div className="l4-side-data"><span>근일점 <b>{source.periAU.toFixed(3)} AU</b></span><span>원일점 <b>{source.apoAU.toFixed(3)} AU</b></span><span>긴반지름(제출) <b>{source.submittedA.trim() ? `${source.submittedA} AU` : '미제출'}</b></span><span>공전주기(제출) <b>{source.submittedPeriod.trim() ? `${source.submittedPeriod}년` : '미제출'}</b></span><span>이동 시간(제출) <b>{source.submittedDays.trim() ? `${source.submittedDays}일` : '미제출'}</b></span></div><details className="l4-side-reference"><summary>모형 계산 참고값</summary><p>긴반지름 {source.model.semiMajorAxisAU.toFixed(4)} AU</p><p>전체 주기 {(source.model.periodSeconds / SECONDS_PER_DAY / 365.25).toFixed(4)}년</p><p>절반 이동 {source.modeledDays.toFixed(1)}일</p><small>시뮬레이션 계산용 정밀값입니다. 학생 제출값을 대체하지 않습니다.</small></details><button type="button" onClick={restartLesson}>처음부터 다시하기</button></aside></div>
  </main>;
}
