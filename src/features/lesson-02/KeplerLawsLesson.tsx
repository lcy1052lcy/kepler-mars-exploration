import { useEffect, useMemo, useRef, useState } from 'react';
import { PLANET_ORBIT_DATA, PLANET_ORBIT_DATA_SOURCE } from '../../content/planetOrbitData';
import {
  ASTRONOMICAL_UNIT_M,
  SECONDS_PER_DAY,
  SECONDS_PER_JULIAN_YEAR,
  SOLAR_MU_M3_S2,
  averageSpeedMS,
  distanceTraveledBetweenTimes,
  orbitalPeriodSeconds,
  stateAtTime,
  stateAtTrueAnomaly,
  sweptAreaBetweenTimes,
} from '../../physics';
import './lesson-02.css';
import LessonCompletion from '../../ui/LessonCompletion';
import LessonStepNavigation from '../../ui/LessonStepNavigation';
import { clearLessonStoredState, isBoolean, isIndexList, isIntegerBetween, isNumberBetween, isString, isStringRecord, useLessonStoredState } from '../../ui/lessonProgress';

const DEMO_ECCENTRICITY = 0.62;
const ORBIT_PERIOD_SECONDS = 60;
const SECTOR_COUNT = 12;
const SECTOR_COLORS = ['#35c4b4', '#6ba8e8', '#b28be2', '#e78caf', '#ef9b64', '#d8bf57', '#48b6d2', '#7bc48e', '#dd7a62', '#8f9de5', '#c68e58', '#6ab6a1'];
type LessonStep = 0 | 1 | 2 | 3 | 4;
type AreaAnswer = 'same' | 'different' | null;
type SpeedAnswer = 'near-faster' | 'far-faster' | 'same' | null;
type PlanetPeriodAnswer = 'proportional' | 'nonlinear' | null;

function Feedback({ correct, children }: { correct?: boolean; children: string }) {
  return <div className={`l2-feedback ${correct === undefined ? 'neutral' : correct ? 'correct' : 'retry'}`} role="status"><b>{correct === undefined ? '기록했어요' : correct ? '관찰이 잘 맞아요' : '다시 비교해 볼까요?'}</b><span>{children}</span></div>;
}

function formatDistance(meters: number): string {
  return (meters / 1_000_000_000).toFixed(1);
}

function orbitPoint(orbit: ReturnType<typeof makeOrbit>, seconds: number): readonly [number, number] {
  const state = stateAtTime(orbit.physical, seconds);
  return [orbit.focusX - state.positionXM * orbit.scale, orbit.cy + state.positionYM * orbit.scale];
}

function sectorPath(orbit: ReturnType<typeof makeOrbit>, startSeconds: number, endSeconds: number, samples = 48): string {
  const points = Array.from({ length: samples + 1 }, (_, i) => {
    return orbitPoint(orbit, startSeconds + ((endSeconds - startSeconds) * i) / samples);
  });
  return `M ${orbit.focusX} ${orbit.cy} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
}

function orbitArcPath(orbit: ReturnType<typeof makeOrbit>, startSeconds: number, endSeconds: number, samples = 60): string {
  const points = Array.from({ length: samples + 1 }, (_, i) => orbitPoint(orbit, startSeconds + ((endSeconds - startSeconds) * i) / samples));
  return `M ${points.map(([x, y]) => `${x} ${y}`).join(' L ')}`;
}

function makeOrbit(eccentricity = DEMO_ECCENTRICITY) {
  const semiMajorAxisM = ASTRONOMICAL_UNIT_M;
  const semiMinorAxisM = semiMajorAxisM * Math.sqrt(1 - eccentricity ** 2);
  const scale = 178 / semiMajorAxisM;
  const cx = 350;
  const cy = 220;
  return {
    semiMajorAxisM,
    eccentricity,
    semiMinorAxisM,
    scale,
    cx,
    cy,
    focusX: cx - semiMajorAxisM * eccentricity * scale,
    rx: semiMajorAxisM * scale,
    ry: semiMinorAxisM * scale,
    periodSeconds: orbitalPeriodSeconds({ semiMajorAxisM, eccentricity, gravitationalParameterM3S2: SOLAR_MU_M3_S2 }),
    physical: { semiMajorAxisM, eccentricity, gravitationalParameterM3S2: SOLAR_MU_M3_S2 },
  };
}

function AreaComparisonFigure({ orbit, firstIndex, secondIndex, interval, firstAreaAU2, secondAreaAU2, showLaw, onComplete }: {
  orbit: ReturnType<typeof makeOrbit>;
  firstIndex: number;
  secondIndex: number;
  interval: number;
  firstAreaAU2: number;
  secondAreaAU2: number;
  showLaw: boolean;
  onComplete: (complete: boolean) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const sliceCount = 8;
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  progressRef.current = progress;
  const days = interval / SECONDS_PER_DAY;
  const comparisons = [
    { index: firstIndex, name: firstIndex === 0 ? '근일점 부근' : firstIndex === 6 ? '원일점 부근' : `${firstIndex + 1}번 영역`, color: SECTOR_COLORS[firstIndex], area: firstAreaAU2 },
    { index: secondIndex, name: secondIndex === 0 ? '근일점 부근' : secondIndex === 6 ? '원일점 부근' : `${secondIndex + 1}번 영역`, color: SECTOR_COLORS[secondIndex], area: secondAreaAU2 },
  ];
  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = now;
      const delta = now - lastFrameRef.current;
      lastFrameRef.current = now;
      setProgress((current) => {
        const next = Math.min(sliceCount, current + (delta * speed * sliceCount) / 5200);
        if (next >= sliceCount) {
          setPlaying(false);
          onComplete(true);
        }
        return next;
      });
      if (progressRef.current < sliceCount) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameRef.current = null;
    };
  }, [playing, speed, onComplete]);
  const displayedSlices = Math.min(sliceCount, Math.ceil(progress));
  const accumulatedAreaAU2 = (index: number) => {
    const start = (index === 0 ? firstIndex : secondIndex) * interval;
    const pieceDuration = interval / sliceCount;
    const completeCount = Math.min(sliceCount, Math.floor(progress));
    const partialFraction = progress - completeCount;
    const completeArea = Array.from({ length: completeCount }, (_, piece) => sweptAreaBetweenTimes(orbit.physical, start + piece * pieceDuration, start + (piece + 1) * pieceDuration)).reduce((sum, area) => sum + area, 0);
    const partialArea = completeCount < sliceCount && partialFraction > 0
      ? sweptAreaBetweenTimes(orbit.physical, start + completeCount * pieceDuration, start + (completeCount + partialFraction) * pieceDuration)
      : 0;
    return (completeArea + partialArea) / ASTRONOMICAL_UNIT_M ** 2;
  };
  const beginAnimation = () => {
    if (progress >= sliceCount) setProgress(0);
    onComplete(false);
    lastFrameRef.current = null;
    setPlaying(true);
  };
  const replay = () => {
    setPlaying(false);
    setProgress(0);
    onComplete(false);
    lastFrameRef.current = null;
  };
  return <section className="l2-sector-comparison" aria-label="선택한 두 실제 궤도 영역 비교">
    <div className="l2-sector-comparison-heading"><div><b>두 영역을 같은 축척으로 보기</b><span>그림은 궤도에서 쓸린 실제 부채꼴 모양을 유지합니다.</span></div><span>같은 확대 배율</span></div>
    <div className="l2-sector-comparison-grid">{comparisons.map(({ index, name, color, area }) => {
      const start = index * interval;
      const end = (index + 1) * interval;
      const [planetX, planetY] = orbitPoint(orbit, end);
      const translateX = 350 - orbit.focusX;
      const translateY = 230 - orbit.cy;
      const pieceDuration = interval / sliceCount;
      const pieces = Array.from({ length: displayedSlices }, (_, piece) => {
        const fraction = piece === Math.floor(progress) ? progress - piece : 1;
        if (fraction <= 0) return null;
        const pieceStart = start + piece * pieceDuration;
        return <path key={piece} d={sectorPath(orbit, pieceStart, pieceStart + pieceDuration * fraction, 32)} transform={`translate(${translateX} ${translateY})`} fill={color} fillOpacity={0.48 + (piece % 2) * 0.16} stroke="#fff" strokeWidth="1.4"/>;
      });
      return <article className="l2-sector-comparison-item" key={index}>
        <h3><i style={{ background: color }}/>{index + 1}번 · {name}</h3>
        <svg viewBox="0 0 700 460" role="img" aria-label={`${index + 1}번 ${name} 영역, 태양 초점부터 행성 궤도까지 실제 축척의 부채꼴`}>
          <line x1="22" y1="230" x2="678" y2="230" stroke="#dbe2eb" strokeDasharray="4 6"/>
          <path d={sectorPath(orbit, start, end)} transform={`translate(${translateX} ${translateY})`} fill={color} fillOpacity={progress === 0 ? '.78' : '.12'} stroke={color} strokeWidth="2"/>
          {pieces}
          <circle cx="350" cy="230" r="8" fill="#f0b53c" stroke="#704d22" strokeWidth="2"/>
          <circle cx={planetX + translateX} cy={planetY + translateY} r="6" fill="#fff" stroke="#283d59" strokeWidth="2"/>
          <text x="350" y="255" textAnchor="middle" className="l2-comparison-sun-label">태양</text>
        </svg>
        <div className="l2-sector-comparison-metrics"><span>이동 시간</span><b>약 {Math.round(days)}일</b><span>쓸린 면적</span><b>{area.toFixed(3)} AU²</b></div>
        <details><summary>정확한 계산값 보기</summary><p>구간 시간 {days.toFixed(3)}일 · 면적 {area.toFixed(8)} AU²</p></details>
      </article>;
    })}</div>
    <div className="l2-area-build">
      <div className="l2-area-build-head"><div><b>면적 조각을 같은 시간만큼 모으기</b><span>각 영역을 8조각으로 나누어, 조각마다 쓸린 면적을 누적합니다.</span></div><label>속도 <select aria-label="면적 비교 애니메이션 속도" value={speed} disabled={playing} onChange={(event) => setSpeed(Number(event.target.value))}><option value="0.5">느리게</option><option value="1">보통</option><option value="2">빠르게</option></select></label></div>
      <div className="l2-area-build-rows">{comparisons.map((item, index) => {
        const accumulated = accumulatedAreaAU2(index);
        return <div className="l2-area-build-row" key={item.index}>
          <b>{item.index + 1}번</b><div className="l2-area-build-track" role="img" aria-label={`${item.index + 1}번 면적 조각 ${Math.ceil(progress)} / ${sliceCount}, 누적 ${accumulated.toFixed(6)} AU²`}><i style={{ width: `${(accumulated / Math.max(firstAreaAU2, secondAreaAU2)) * 100}%`, background: item.color }}/></div><strong>{accumulated.toFixed(3)} <small>AU²</small></strong>
        </div>;
      })}</div>
      <div className="l2-area-animation-controls">
        {!playing && progress === 0 && <button onClick={beginAnimation}>면적 비교 애니메이션</button>}
        {playing && <button onClick={() => setPlaying(false)}>일시정지</button>}
        {!playing && progress > 0 && progress < sliceCount && <button onClick={() => { lastFrameRef.current = null; setPlaying(true); }}>계속 재생</button>}
        {progress >= sliceCount && <span className="l2-area-animation-done">조각 누적 완료 · 이제 관찰 질문에 답해 보세요.</span>}
        {(progress > 0 || playing) && <button className="secondary" onClick={replay}>다시 보기</button>}
      </div>
    </div>
    <div className="l2-area-values"><b>선택한 영역 정보</b>{comparisons.map((item) => <span key={item.index}>{item.index + 1}번 · {item.name} · 약 {Math.round(days)}일 · {item.area.toFixed(3)} AU²</span>)}</div>
    {showLaw && <div className="l2-equal-area-callout"><span>케플러 제2법칙</span><b>{firstAreaAU2.toFixed(3)} AU² = {secondAreaAU2.toFixed(3)} AU²</b><small>모양이 다른 부채꼴이어도 같은 시간 동안 쓸린 면적은 같습니다.</small></div>}
  </section>;
}

function AreaInvestigation({ answer, onAnswer, pairReady, comparisonComplete, note, onNoteChange, onNext }: {
  answer: AreaAnswer;
  onAnswer: (answer: Exclude<AreaAnswer, null>) => void;
  pairReady: boolean;
  comparisonComplete: boolean;
  note: string;
  onNoteChange: (note: string) => void;
  onNext: () => void;
}) {
  return <section className="l2-activity">
    <div className="l2-heading"><span>전개 1 · 15분</span><h2>같은 시간, 같은 면적일까요?</h2></div>
    <p><b>목표</b> 근일점과 원일점 부근에서 같은 시간 동안 쓸린 면적을 비교합니다.</p>
    <p>재생해 12개 영역이 차례로 쌓이는 모습을 먼저 보세요. 비교할 두 영역을 선택한 뒤 면적 조각을 나누어 모으는 애니메이션을 관찰합니다.</p>
    <div className="l2-observe-prompts"><span>관찰 순서</span><ol><li>12개 영역이 모두 나타나도록 재생·배속을 조절합니다.</li><li>두 영역의 실제 모양을 보고 면적 비교 애니메이션을 실행합니다.</li><li>조각이 누적되는 모습을 끝까지 관찰한 뒤 면적 관계를 답합니다.</li></ol></div>
    {!pairReady && <p className="l2-selection-hint">먼저 두 영역을 선택하세요. 번호를 바꾸면 비교 화면도 바로 갱신됩니다.</p>}
    <fieldset className="l2-options" disabled={!pairReady || !comparisonComplete}><legend>{!comparisonComplete ? '애니메이션을 끝까지 관찰한 뒤 답해 보세요.' : '두 영역의 모양은 다를 수 있지만, 면적은 어떤 관계인가요?'}</legend>
      <label><input type="radio" name="area" checked={answer === 'same'} onChange={() => onAnswer('same')}/> 같다</label>
      <label><input type="radio" name="area" checked={answer === 'different'} onChange={() => onAnswer('different')}/> 다르다</label>
    </fieldset>
    {answer && pairReady && <Feedback correct={answer === 'same'}>{answer === 'same' ? '맞아요. 모양은 달라도 같은 시간 동안 태양과 행성을 잇는 선분이 쓸고 간 면적은 같습니다. 이것이 케플러 제2법칙입니다.' : '수치의 넓이 차이를 확인해 보세요. 같은 시간 동안 쓸린 면적은 같습니다.'}</Feedback>}
    <label className="l2-reflection">관찰 기록<textarea rows={2} value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="1번과 7번 영역의 모양과 넓이를 비교해 적어 보세요."/></label>
    <button className="l2-next" disabled={!answer || !pairReady} onClick={onNext}>속도 비교 <span>→</span></button>
  </section>;
}

function SpeedInvestigation({ eccentricity, durationDays, periInstant, apoInstant, periDistance, apoDistance, periAverage, apoAverage, comparisonComplete, answer, onAnswer, note, onNoteChange, onNext }: {
  eccentricity: number;
  durationDays: number;
  periInstant: number;
  apoInstant: number;
  periDistance: number;
  apoDistance: number;
  periAverage: number;
  apoAverage: number;
  comparisonComplete: boolean;
  answer: SpeedAnswer;
  onAnswer: (answer: Exclude<SpeedAnswer, null>) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onNext: () => void;
}) {
  const maxDistance = Math.max(periDistance, apoDistance);
  return <section className="l2-activity">
    <div className="l2-heading"><span>전개 2 · 10분</span><h2>어디에서 더 빠르게 움직일까요?</h2></div>
    <p><b>관찰</b> 전개 1과 같은 궤도(이심률 {eccentricity.toFixed(2)})를 사용합니다. 태양에서의 거리와 궤도 위에서 움직인 거리를 구분하며, 청록색·주황색 행성이 같은 시간 동안 이동하는 모습을 먼저 보세요.</p>
    <div className="l2-speed-method"><b>비교 조건</b><span>두 행성은 각각 근일점·원일점 부근에서 동시에 출발해 같은 약 {Math.round(durationDays)}일 동안 움직입니다. 두꺼운 곡선은 타원 궤도 위의 이동 경로입니다.</span></div>
    {!comparisonComplete && <p className="l2-selection-hint">재생을 눌러 두 행성의 같은 시간 운동을 먼저 관찰하세요. 관찰이 끝나면 예상 질문이 열립니다.</p>}
    <fieldset className="l2-options" disabled={!comparisonComplete}><legend>{comparisonComplete ? '같은 시간 동안 더 긴 거리를 이동한 곳은 어디일까요?' : '두 경로의 움직임을 관찰한 다음 답해 보세요.'}</legend>
      <label><input type="radio" name="speed" checked={answer === 'near-faster'} onChange={() => onAnswer('near-faster')}/> 태양에 가까운 근일점 부근</label>
      <label><input type="radio" name="speed" checked={answer === 'far-faster'} onChange={() => onAnswer('far-faster')}/> 태양에서 먼 원일점 부근</label>
      <label><input type="radio" name="speed" checked={answer === 'same'} onChange={() => onAnswer('same')}/> 두 곳에서 같다</label>
    </fieldset>
    {answer && <>
      <div className="l2-speed-result-intro"><b>같은 시간 동안 움직인 결과</b><span>평균 속력 = 이동 거리 ÷ 걸린 시간</span></div>
      <div className="l2-velocity-readouts">
        {[{ label: '근일점 부근', distance: periDistance, average: periAverage, color: 'near' }, { label: '원일점 부근', distance: apoDistance, average: apoAverage, color: 'far' }].map((item) => <article key={item.color} className={`l2-speed-card ${item.color}`}>
          <h3>{item.label}</h3><div className="l2-distance-readout"><span>이동 거리 · 같은 약 {Math.round(durationDays)}일</span><div className="l2-distance-track" role="img" aria-label={`${item.label} 이동 거리 ${formatDistance(item.distance)} 백만 km`}><i style={{ width: `${(item.distance / maxDistance) * 100}%` }}/></div><b>{formatDistance(item.distance)} <small>백만 km</small></b></div>
          <div className="l2-average-readout"><span>구간 평균 속력</span><b>{(item.average / 1000).toFixed(1)} <small>km/s</small></b></div>
        </article>)}
      </div>
      <details className="l2-instant-details"><summary>정확한 계산값과 순간 속력 보기</summary><p>계산에 사용한 시간: {durationDays.toFixed(3)}일. 근일점 구간 거리 {(periDistance / 1_000_000_000).toFixed(3)}백만 km, 평균 속력 {(periAverage / 1000).toFixed(3)} km/s.</p><p>원일점 구간 거리 {(apoDistance / 1_000_000_000).toFixed(3)}백만 km, 평균 속력 {(apoAverage / 1000).toFixed(3)} km/s.</p><p>근일점 순간 속력 {(periInstant / 1000).toFixed(2)} km/s · 원일점 순간 속력 {(apoInstant / 1000).toFixed(2)} km/s</p></details>
      <Feedback correct={answer === 'near-faster'}>{answer === 'near-faster' ? '맞아요. 같은 시간 동안 태양 가까운 근일점 구간에서 더 긴 궤도 거리를 이동합니다. 태양에서 먼 원일점에서는 더 짧게 이동합니다. 같은 시간의 면적이 같다는 전개 1의 관찰과 함께, 케플러 제2법칙은 행성의 속력이 위치에 따라 달라지는 이유를 설명합니다.' : '두꺼운 곡선으로 표시한 궤도 위 이동 경로를 비교해 보세요. 태양으로부터의 거리가 아니라, 두 구간에서 행성이 실제로 따라간 궤도 길이를 비교합니다.'}</Feedback>
    </>}
    <label className="l2-reflection">관찰 기록<textarea rows={2} value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="같은 시간 동안 이동한 거리와 속력은 어떻게 달랐나요?"/></label>
    <button className="l2-next" disabled={!answer || !comparisonComplete} onClick={onNext}>행성 자료 분석 <span>→</span></button>
  </section>;
}

function AreaSimulation({ orbit, eccentricity, onEccentricityChange, playing, setPlaying, elapsedSeconds, setElapsedSeconds, speedFactor, setSpeedFactor, selectedSegments, onToggleSegment, onReset, onComparisonComplete, revealAreaResult, revealSpeedResult, stage }: {
  orbit: ReturnType<typeof makeOrbit>;
  eccentricity: number;
  onEccentricityChange: (value: number) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  elapsedSeconds: number;
  setElapsedSeconds: (seconds: number) => void;
  speedFactor: number;
  setSpeedFactor: (factor: number) => void;
  selectedSegments: number[];
  onToggleSegment: (segment: number) => void;
  onReset: () => void;
  onComparisonComplete: (complete: boolean) => void;
  revealAreaResult: boolean;
  revealSpeedResult: boolean;
  stage: 'area' | 'speed';
}) {
  const period = orbit.periodSeconds;
  const interval = period / SECTOR_COUNT;
  const animationDuration = stage === 'speed' ? ORBIT_PERIOD_SECONDS / SECTOR_COUNT : ORBIT_PERIOD_SECONDS;
  const completeCount = stage === 'speed' ? SECTOR_COUNT : Math.min(SECTOR_COUNT, Math.floor((elapsedSeconds / ORBIT_PERIOD_SECONDS) * SECTOR_COUNT + 1e-8));
  const speedProgress = Math.min(1, Math.max(0, elapsedSeconds / animationDuration));
  const physicalElapsed = stage === 'speed' ? speedProgress * interval : (elapsedSeconds / ORBIT_PERIOD_SECONDS) * period;
  const current = stateAtTime(orbit.physical, Math.min(period, physicalElapsed));
  const currentX = orbit.focusX - current.positionXM * orbit.scale;
  const currentY = orbit.cy + current.positionYM * orbit.scale;
  const days = interval / SECONDS_PER_DAY;
  const palette = SECTOR_COLORS;
  const comparisonIndices = [...selectedSegments].sort((a, b) => a - b);
  const comparison = comparisonIndices.length === 2 ? {
    firstIndex: comparisonIndices[0],
    secondIndex: comparisonIndices[1],
    firstAreaAU2: sweptAreaBetweenTimes(orbit.physical, comparisonIndices[0] * interval, (comparisonIndices[0] + 1) * interval) / ASTRONOMICAL_UNIT_M ** 2,
    secondAreaAU2: sweptAreaBetweenTimes(orbit.physical, comparisonIndices[1] * interval, (comparisonIndices[1] + 1) * interval) / ASTRONOMICAL_UNIT_M ** 2,
  } : null;
  const speedArcsReady = stage === 'speed' && speedProgress > 0;
  const speedAnimationComplete = stage === 'speed' && speedProgress >= 1;
  const periCurrent = orbitPoint(orbit, speedProgress * interval);
  const apoCurrent = orbitPoint(orbit, 6 * interval + speedProgress * interval);
  const periDistance = distanceTraveledBetweenTimes(orbit.physical, 0, interval, 128);
  const apoDistance = distanceTraveledBetweenTimes(orbit.physical, 6 * interval, 7 * interval, 128);

  return <div className="l2-orbit-shell">
    <div className="l2-orbit-head"><div><b>{stage === 'area' ? '동일 시간 영역이 쌓이는 궤도' : '같은 시간 동안 이동한 궤도 거리'}</b><span>교육용 예시 궤도 · 이심률 {eccentricity.toFixed(2)}{stage === 'area' ? ' · 12개 동일 시간 구간' : ' · 근일점과 원일점 구간을 동시에 비교'}</span></div><span>{stage === 'area' ? '한 바퀴 = 60초 (1배속)' : `비교 시간 약 ${Math.round(days)}일 · 화면 배속은 아래에서 조절`}</span></div>
    {stage === 'area' && <label className="l2-eccentricity-control">교육용 궤도의 이심률 <b>{eccentricity.toFixed(2)}</b><input type="range" min="0" max="0.8" step="0.01" value={eccentricity} onChange={(event) => onEccentricityChange(Number(event.target.value))}/><small>이심률이 큰 예시 궤도입니다. 실제 행성 자료와 구분해 관찰하세요.</small></label>}
    <svg className="l2-orbit-svg l2-sector-orbit" viewBox="0 0 700 470" role="group" aria-label={stage === 'area' ? `이심률 ${eccentricity.toFixed(2)}인 궤도에서 케플러 방정식으로 계산한 12개의 동일 시간 영역을 선택하는 시뮬레이션입니다.` : `이심률 ${eccentricity.toFixed(2)}인 타원 궤도에서 근일점과 원일점 구간의 같은 시간 이동 경로를 동시에 비교합니다.`}>
      <defs>
        <radialGradient id="l2-sun"><stop stopColor="#fff3bd"/><stop offset=".45" stopColor="#ffc957"/><stop offset="1" stopColor="#ffae45" stopOpacity=".12"/></radialGradient>
      </defs>
      <line x1={orbit.cx - orbit.rx} y1={orbit.cy} x2={orbit.cx + orbit.rx} y2={orbit.cy} stroke="#566680" strokeDasharray="5 6"/>
      <ellipse cx={orbit.cx} cy={orbit.cy} rx={orbit.rx} ry={orbit.ry} fill="rgba(160,180,219,.035)" stroke="#b6c7eb" strokeWidth="2.5"/>
      {stage === 'area' && Array.from({ length: completeCount }, (_, index) => {
        const start = index * interval;
        const selected = selectedSegments.includes(index);
        const point = orbitPoint(orbit, start + interval / 2);
        const labelX = orbit.focusX + (point[0] - orbit.focusX) * 0.58;
        const labelY = orbit.cy + (point[1] - orbit.cy) * 0.58;
        const areaModeOpacity = selected ? 0.96 : selectedSegments.length ? 0.12 : 0.43;
        return <g key={index} className={`l2-orbit-sector ${selected ? 'selected' : ''}`} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${index + 1}번 영역 선택${index === 0 ? ', 근일점 부근' : index === 6 ? ', 원일점 부근' : ''}`} onClick={() => onToggleSegment(index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggleSegment(index); } }}><path d={sectorPath(orbit, start, start + interval)} fill={palette[index]} fillOpacity={areaModeOpacity} stroke={selected ? '#fff' : palette[index]} strokeOpacity={selectedSegments.length && !selected ? 0.24 : 1} strokeWidth={selected ? 3 : 1.2}/><text x={labelX} y={labelY + 4} textAnchor="middle" className="l2-sector-number" opacity={selectedSegments.length && !selected ? 0.25 : 1}>{index + 1}</text></g>;
      })}
      {stage === 'area' && elapsedSeconds < ORBIT_PERIOD_SECONDS && elapsedSeconds > 0 && completeCount < SECTOR_COUNT && <path d={sectorPath(orbit, completeCount * interval, physicalElapsed)} fill={palette[completeCount]} fillOpacity=".18" stroke={palette[completeCount]} strokeDasharray="4 4"/>}
      {speedArcsReady && <><path d={orbitArcPath(orbit, 0, speedProgress * interval)} fill="none" stroke="#5de1cf" strokeWidth="8" strokeLinecap="round"/><path d={orbitArcPath(orbit, 6 * interval, (6 + speedProgress) * interval)} fill="none" stroke="#ffb06d" strokeWidth="8" strokeLinecap="round"/></>}
      <circle cx={orbit.focusX} cy={orbit.cy} r="13" fill="url(#l2-sun)"/><circle cx={orbit.focusX} cy={orbit.cy} r="5" fill="#ffd16b"/>
      <circle cx={orbit.cx - orbit.rx} cy={orbit.cy} r="5" fill="#65e2c8" stroke="#112039" strokeWidth="2"/>
      <circle cx={orbit.cx + orbit.rx} cy={orbit.cy} r="5" fill="#ffb06d" stroke="#112039" strokeWidth="2"/>
      {stage === 'area' && <circle cx={currentX} cy={currentY} r="8" fill="#f1f5ff" stroke="#a6b7fb" strokeWidth="3"/>}
      {stage === 'speed' && <>
        <circle cx={orbitPoint(orbit, 0)[0]} cy={orbitPoint(orbit, 0)[1]} r="6" fill="#5de1cf" stroke="#102038" strokeWidth="2" aria-label="근일점 구간 시작점"/>
        <circle cx={orbitPoint(orbit, interval)[0]} cy={orbitPoint(orbit, interval)[1]} r="6" fill="#fff" stroke="#5de1cf" strokeWidth="3" aria-label="근일점 구간 끝점"/>
        <circle cx={orbitPoint(orbit, 6 * interval)[0]} cy={orbitPoint(orbit, 6 * interval)[1]} r="6" fill="#ffb06d" stroke="#102038" strokeWidth="2" aria-label="원일점 구간 시작점"/>
        <circle cx={orbitPoint(orbit, 7 * interval)[0]} cy={orbitPoint(orbit, 7 * interval)[1]} r="6" fill="#fff" stroke="#ffb06d" strokeWidth="3" aria-label="원일점 구간 끝점"/>
        {speedProgress < 1 && <>
          <circle cx={periCurrent[0]} cy={periCurrent[1]} r="10" fill="#5de1cf" stroke="#fff" strokeWidth="3"><title>근일점 구간 행성</title></circle>
          <circle cx={apoCurrent[0]} cy={apoCurrent[1]} r="10" fill="#ffb06d" stroke="#fff" strokeWidth="3"><title>원일점 구간 행성</title></circle>
        </>}
      </>}
      <text x={Math.max(50, orbit.cx - orbit.rx - 12)} y={orbit.cy - orbit.ry - 14} textAnchor="start" className="l2-svg-label">근일점</text>
      <text x={Math.min(650, orbit.cx + orbit.rx + 12)} y={orbit.cy - orbit.ry - 14} textAnchor="end" className="l2-svg-label">원일점</text>
      <text x={orbit.focusX} y={orbit.cy + 30} textAnchor="middle" className="l2-svg-label">태양</text>
      <text x="350" y="456" textAnchor="middle" className="l2-svg-hint">{stage === 'area' ? '번호 영역을 선택해 비교하세요 · 각 영역 경계는 케플러 방정식으로 같은 시간 간격에 계산됩니다.' : '청록색과 주황색 곡선은 타원 궤도 위 이동 경로 · 원은 시작과 끝 위치입니다.'}</text>
    </svg>
    <div className="l2-sector-status" aria-live="polite"><b>{stage === 'area' ? `누적된 영역 ${completeCount}/${SECTOR_COUNT}` : `같은 시간 비교 진행 ${Math.round(speedProgress * 100)}%`}</b><span>{stage === 'area' ? comparison ? '두 영역을 같은 축척으로 나란히 비교합니다.' : `선택한 영역: ${selectedSegments.length}/2 · 1번은 근일점, 7번은 원일점 부근` : revealSpeedResult ? `같은 약 ${Math.round(days)}일 동안 이동 · 근일점 호 ${formatDistance(periDistance)}백만 km · 원일점 호 ${formatDistance(apoDistance)}백만 km` : `두 행성이 동시에 출발해 각각 같은 약 ${Math.round(days)}일 동안 움직입니다. 궤도 위 두 경로의 길이를 살펴보세요.`}</span></div>
    {comparison && stage === 'area' && <AreaComparisonFigure key={`${comparison.firstIndex}-${comparison.secondIndex}-${eccentricity}`} orbit={orbit} firstIndex={comparison.firstIndex} secondIndex={comparison.secondIndex} interval={interval} firstAreaAU2={comparison.firstAreaAU2} secondAreaAU2={comparison.secondAreaAU2} showLaw={revealAreaResult} onComplete={onComparisonComplete}/>}
    {stage === 'speed' && <div className="l2-speed-arc-key"><span><i className="near"/>청록색 경로·행성: 근일점 구간</span><span><i className="far"/>주황색 경로·행성: 원일점 구간</span><span><i className="endpoint"/>흰 테두리 원: 구간 끝점</span></div>}
    <div className="l2-playback">
      <div className="l2-play-buttons"><button onClick={() => { if (elapsedSeconds >= animationDuration) { setElapsedSeconds(0); setPlaying(true); } else setPlaying(!playing); }}>{playing ? '일시정지' : stage === 'speed' && speedAnimationComplete ? '다시 재생' : '재생'}</button><button onClick={onReset}>초기화</button></div>
      <label>배속 <select value={speedFactor} onChange={(event) => setSpeedFactor(Number(event.target.value))}><option value="0.5">0.5배</option><option value="1">1배</option><option value="2">2배</option><option value="4">4배</option></select></label>
      <span>{stage === 'speed' ? `같은 시간 운동 ${Math.round(speedProgress * 100)}% · 약 ${Math.round(days)}일 구간` : `현재 위치: ${(elapsedSeconds / ORBIT_PERIOD_SECONDS * 100).toFixed(1)}% 공전`}</span>
    </div>
  </div>;
}

function PlanetGraph({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [range, setRange] = useState<'all' | 'inner' | 'outer'>('all');
  const selected = PLANET_ORBIT_DATA.find((planet) => planet.id === selectedId)!;
  const toAU = (planet: typeof selected) => (planet.meanSunDistanceMillionKm * 1e9) / ASTRONOMICAL_UNIT_M;
  const toYears = (planet: typeof selected) => (planet.orbitalPeriodDays * SECONDS_PER_DAY) / SECONDS_PER_JULIAN_YEAR;
  const selectedAU = toAU(selected);
  const selectedYears = toYears(selected);
  const innerIds = new Set(['mercury', 'venus', 'earth', 'mars']);
  const planets = PLANET_ORBIT_DATA.filter((planet) => range === 'all' || (range === 'inner' ? innerIds.has(planet.id) : !innerIds.has(planet.id)));

  function choosePlanet(id: string) {
    const isInner = innerIds.has(id);
    if (range === 'inner' && !isInner) setRange('outer');
    if (range === 'outer' && isInner) setRange('inner');
    onSelect(id);
  }

  const drawGraph = (kind: 'a-p' | 'cube-square') => {
    const left = 70;
    const top = 20;
    const width = 255;
    const height = 255;
    const values = planets.map((planet) => ({
      planet,
      x: kind === 'a-p' ? toAU(planet) : toAU(planet) ** 3,
      y: kind === 'a-p' ? toYears(planet) : toYears(planet) ** 2,
    }));
    const maxX = Math.max(...values.map(({ x }) => x)) * 1.08;
    const maxY = Math.max(...values.map(({ y }) => y)) * 1.08;
    const commonMax = kind === 'cube-square' ? Math.max(maxX, maxY) : 0;
    const xMax = kind === 'cube-square' ? commonMax : maxX;
    const yMax = kind === 'cube-square' ? commonMax : maxY;
    const xPos = (value: number) => left + (value / xMax) * width;
    const yPos = (value: number) => top + height - (value / yMax) * height;
    const axisValues = (max: number) => Array.from({ length: 5 }, (_, index) => (index * max) / 4);
    const formatTick = (value: number) => value === 0 ? '0' : value >= 100 ? Math.round(value).toLocaleString('en-US') : value.toFixed(value < 10 ? 1 : 0);
    const xTicks = axisValues(xMax);
    const yTicks = axisValues(yMax);
    return <svg className={`l2-data-graph ${kind}`} viewBox="0 0 420 330" role="img" aria-label={kind === 'a-p' ? '일반 눈금의 행성별 궤도 긴반지름과 공전주기 산점도' : '일반 눈금의 긴반지름 세제곱과 공전주기 제곱의 산점도'}>
      {xTicks.map((tick) => <g key={`x-${tick}`}><line x1={xPos(tick)} y1={top} x2={xPos(tick)} y2={top + height} stroke="#e1e5eb"/><text x={xPos(tick)} y={top + height + 18} textAnchor="middle" className="l2-tick">{formatTick(tick)}</text></g>)}
      {yTicks.map((tick) => <g key={`y-${tick}`}><line x1={left} y1={yPos(tick)} x2={left + width} y2={yPos(tick)} stroke="#e1e5eb"/><text x={left - 8} y={yPos(tick) + 4} textAnchor="end" className="l2-tick">{formatTick(tick)}</text></g>)}
      <line x1={left} y1={top + height} x2={left + width} y2={top + height} stroke="#536174" strokeWidth="1.5"/><line x1={left} y1={top} x2={left} y2={top + height} stroke="#536174" strokeWidth="1.5"/>
      {kind === 'cube-square' && <line x1={xPos(0)} y1={yPos(0)} x2={xPos(commonMax)} y2={yPos(commonMax)} stroke="#8795a8" strokeDasharray="6 5"/>}
      {values.map(({ planet, x, y }) => <g key={planet.id} className={`l2-graph-point ${selectedId === planet.id ? 'selected' : ''}`} onClick={() => choosePlanet(planet.id)} role="button" tabIndex={0} aria-label={`${planet.name} 선택`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choosePlanet(planet.id); } }}><circle cx={xPos(x)} cy={yPos(y)} r={selectedId === planet.id ? 7 : 5} fill={selectedId === planet.id ? '#bd6c37' : '#277f77'} stroke="white" strokeWidth="2"/><title>{planet.name}</title></g>)}
      <text x={left + width / 2} y="320" textAnchor="middle" className="l2-axis-title">{kind === 'a-p' ? '긴반지름 a (AU) · 일반 눈금' : '긴반지름 세제곱 a³ (AU³) · 일반 눈금'}</text>
      <text transform={`translate(15 ${top + height / 2}) rotate(-90)`} textAnchor="middle" className="l2-axis-title">{kind === 'a-p' ? '공전주기 P (년)' : '공전주기 제곱 P² (년²)'}</text>
    </svg>;
  };

  return <div className="l2-graph-wrap">
    <div className="l2-range-select" role="group" aria-label="그래프에 표시할 행성 범위"><span>자료 범위</span><button className={range === 'all' ? 'selected' : ''} aria-pressed={range === 'all'} onClick={() => setRange('all')}>전체 행성</button><button className={range === 'inner' ? 'selected' : ''} aria-pressed={range === 'inner'} onClick={() => { setRange('inner'); onSelect('earth'); }}>내행성</button><button className={range === 'outer' ? 'selected' : ''} aria-pressed={range === 'outer'} onClick={() => { setRange('outer'); onSelect('jupiter'); }}>외행성</button></div>
    <div className="l2-graph-grid"><section><h3>공전주기 P와 긴반지름 a</h3>{drawGraph('a-p')}<p className="l2-graph-key">함께 커지는 점이 직선 위에 놓이는지도 살펴보세요.</p></section><section><h3>P²와 a³ 비교</h3>{drawGraph('cube-square')}<p className="l2-graph-key"><i/> 점선은 P² = a³인 위치입니다. 점들이 가까운지 살펴보세요.</p></section></div>
    <div className="l2-planet-select"><span>행성을 선택해 값을 확인하세요</span><div>{PLANET_ORBIT_DATA.map((planet) => <button key={planet.id} className={selectedId === planet.id ? 'selected' : ''} aria-pressed={selectedId === planet.id} onClick={() => choosePlanet(planet.id)}>{planet.name}</button>)}</div></div>
    <div className="l2-selected-values" aria-live="polite"><b>{selected.name}</b><span>a = {selectedAU.toFixed(3)} AU</span><span>P = {selectedYears.toFixed(3)} 년</span><span>a³ = {(selectedAU ** 3).toFixed(3)} AU³</span><span>P² = {(selectedYears ** 2).toFixed(3)} 년²</span><strong>P²/a³ = {(selectedYears ** 2 / selectedAU ** 3).toFixed(3)}</strong></div>
  </div>;
}

function PlanetDataInvestigation({ selectedId, onSelect, periodAnswer, onPeriodAnswer, ratioAnswer, onRatioAnswer, note, onNoteChange, onNext }: {
  selectedId: string;
  onSelect: (id: string) => void;
  periodAnswer: PlanetPeriodAnswer;
  onPeriodAnswer: (answer: Exclude<PlanetPeriodAnswer, null>) => void;
  ratioAnswer: string | null;
  onRatioAnswer: (answer: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onNext: () => void;
}) {
  return <section className="l2-activity">
    <div className="l2-heading"><span>전개 3 · 15분</span><h2>공전주기와 궤도 크기의 관계</h2></div>
    <p><b>교과서에서 학습한 케플러 제3법칙을 실제 태양계 행성 자료로 확인해 봅시다.</b></p>
    <p><b>목표</b> 행성의 긴반지름과 공전주기 그래프를 비교해 제3법칙의 관계를 찾아봅니다.</p>
    <p>전체·내행성·외행성 범위를 바꾸며 왼쪽 그래프에서 P와 a가 정비례하는지 살펴보세요. 오른쪽 그래프에서는 P²와 a³ 값이 어떻게 놓이는지 비교합니다. 행성 점이나 이름을 선택하면 수치를 확인할 수 있습니다.</p>
    <PlanetGraph selectedId={selectedId} onSelect={onSelect}/>
    <div className="l2-source">자료 출처: <a href={PLANET_ORBIT_DATA_SOURCE.url} target="_blank" rel="noreferrer">{PLANET_ORBIT_DATA_SOURCE.label}</a> · <a href={PLANET_ORBIT_DATA_SOURCE.notesUrl} target="_blank" rel="noreferrer">자료 설명</a><br/>{PLANET_ORBIT_DATA_SOURCE.note}</div>
    <fieldset className="l2-options"><legend>왼쪽 그래프에서 P와 a의 관계는 어떠한가요?</legend>
      <label><input type="radio" name="period-vs-axis" checked={periodAnswer === 'proportional'} onChange={() => onPeriodAnswer('proportional')}/> P는 a에 정비례한다</label>
      <label><input type="radio" name="period-vs-axis" checked={periodAnswer === 'nonlinear'} onChange={() => onPeriodAnswer('nonlinear')}/> 함께 증가하지만 정비례 관계는 아니다</label>
    </fieldset>
    {periodAnswer && <Feedback correct={periodAnswer === 'nonlinear'}>{periodAnswer === 'nonlinear' ? '맞아요. P와 a는 함께 증가하지만 정비례하지 않습니다. 제3법칙은 P 자체가 아니라 P²과 a³의 비례 관계를 말합니다.' : '범위와 일반 눈금에서 점이 직선 관계인지 비교해 보세요. 제3법칙은 P와 a 자체의 정비례를 말하지 않습니다.'}</Feedback>}
    <fieldset className="l2-options"><legend>오른쪽 그래프에서 P²과 a³의 관계는 어떻게 보이나요?</legend>
      <label><input type="radio" name="third-law" checked={ratioAnswer === 'similar'} onChange={() => onRatioAnswer('similar')}/> 점들이 P² = a³ 점선에 가깝다</label>
      <label><input type="radio" name="third-law" checked={ratioAnswer === 'different'} onChange={() => onRatioAnswer('different')}/> 행성마다 크게 다르다</label>
    </fieldset>
    {ratioAnswer && <Feedback correct={ratioAnswer === 'similar'}>{ratioAnswer === 'similar' ? '맞아요. 태양을 도는 행성은 P를 년, a를 AU로 나타내면 P² ≈ a³입니다. 이것이 케플러 제3법칙입니다.' : '오른쪽 그래프의 점과 같은 눈금의 점선을 비교해 보세요. 행성별 P²/a³ 값도 함께 확인할 수 있습니다.'}</Feedback>}
    <label className="l2-reflection">발견한 규칙<textarea rows={2} value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="P-a 그래프와 P²-a³ 그래프에서 각각 발견한 점을 적어 보세요."/></label>
    <button className="l2-next" disabled={!periodAnswer || !ratioAnswer} onClick={onNext}>법칙 정리 <span>→</span></button>
  </section>;
}

export default function KeplerLawsLesson() {
  const [step, setStep] = useLessonStoredState<LessonStep>('2', 'step', 0, (value): value is LessonStep => isIntegerBetween(value, 0, 4));
  const [highestStep, setHighestStep] = useLessonStoredState('2', 'highestStep', 0, (value): value is number => isIntegerBetween(value, 0, 4));
  const [completedSteps, setCompletedSteps] = useLessonStoredState('2', 'completedSteps', [] as number[], (value): value is number[] => isIndexList(value, 4));
  const [prediction, setPrediction] = useLessonStoredState<string | null>('2', 'prediction', null, (value): value is string | null => value === null || value === 'constant' || value === 'changes' || value === 'unsure');
  const [areaAnswer, setAreaAnswer] = useLessonStoredState<AreaAnswer>('2', 'areaAnswer', null, (value): value is AreaAnswer => value === null || value === 'same' || value === 'different');
  const [areaComparisonComplete, setAreaComparisonComplete] = useLessonStoredState('2', 'areaComparisonComplete', false, isBoolean);
  const [demoEccentricity, setDemoEccentricity] = useLessonStoredState('2', 'demoEccentricity', DEMO_ECCENTRICITY, (value): value is number => isNumberBetween(value, 0, 0.8));
  const [selectedSegments, setSelectedSegments] = useLessonStoredState('2', 'selectedSegments', [] as number[], (value): value is number[] => isIndexList(value, SECTOR_COUNT - 1) && value.length <= 2);
  const [speedAnswer, setSpeedAnswer] = useLessonStoredState<SpeedAnswer>('2', 'speedAnswer', null, (value): value is SpeedAnswer => value === null || value === 'near-faster' || value === 'far-faster' || value === 'same');
  const [selectedPlanet, setSelectedPlanet] = useLessonStoredState('2', 'selectedPlanet', 'earth', isString);
  const [periodAnswer, setPeriodAnswer] = useLessonStoredState<PlanetPeriodAnswer>('2', 'periodAnswer', null, (value): value is PlanetPeriodAnswer => value === null || value === 'proportional' || value === 'nonlinear');
  const [thirdAnswer, setThirdAnswer] = useLessonStoredState<string | null>('2', 'thirdAnswer', null, (value): value is string | null => value === null || typeof value === 'string');
  const [summary, setSummary] = useLessonStoredState('2', 'summary', { first: '', second: '', third: '' }, isStringRecord(['first', 'second', 'third'] as const));
  const [summarySubmitted, setSummarySubmitted] = useLessonStoredState('2', 'summarySubmitted', false, isBoolean);
  const [notes, setNotes] = useLessonStoredState('2', 'notes', { prediction: '', area: '', speed: '', third: '', summary: '' }, isStringRecord(['prediction', 'area', 'speed', 'third', 'summary'] as const));
  const [completed, setCompleted] = useLessonStoredState('2', 'completed', false, isBoolean);
  const [playing, setPlaying] = useState(false);
  const [areaElapsedSeconds, setAreaElapsedSeconds] = useLessonStoredState('2', 'areaElapsedSeconds', 0, (value): value is number => isNumberBetween(value, 0, ORBIT_PERIOD_SECONDS));
  const [speedElapsedSeconds, setSpeedElapsedSeconds] = useLessonStoredState('2', 'speedElapsedSeconds', 0, (value): value is number => isNumberBetween(value, 0, ORBIT_PERIOD_SECONDS / SECTOR_COUNT));
  const [speedFactor, setSpeedFactor] = useLessonStoredState('2', 'speedFactor', 1, (value): value is number => value === 0.25 || value === 0.5 || value === 1 || value === 2 || value === 4);
  const elapsedSeconds = step === 2 ? speedElapsedSeconds : areaElapsedSeconds;
  const setElapsedSeconds = step === 2 ? setSpeedElapsedSeconds : setAreaElapsedSeconds;
  const elapsedRef = useRef(elapsedSeconds);
  elapsedRef.current = elapsedSeconds;

  const orbit = useMemo(() => makeOrbit(demoEccentricity), [demoEccentricity]);
  const interval = orbit.periodSeconds / SECTOR_COUNT;
  const periVelocity = stateAtTrueAnomaly(orbit.physical, 0).speedMS;
  const apoVelocity = stateAtTrueAnomaly(orbit.physical, Math.PI).speedMS;
  const periDistance = distanceTraveledBetweenTimes(orbit.physical, 0, interval, 128);
  const apoStart = 6 * interval;
  const apoDistance = distanceTraveledBetweenTimes(orbit.physical, apoStart, apoStart + interval, 128);
  const periAverageSpeed = averageSpeedMS(periDistance, interval);
  const apoAverageSpeed = averageSpeedMS(apoDistance, interval);
  const comparisonDays = interval / SECONDS_PER_DAY;

  useEffect(() => {
    if (!playing) return;
    let frameId = 0;
    let previous = performance.now();
    let simulatedSeconds = elapsedRef.current;
    const tick = (now: number) => {
      const deltaSeconds = (now - previous) / 1000;
      previous = now;
      simulatedSeconds += deltaSeconds * speedFactor;
      const animationDuration = step === 2 ? ORBIT_PERIOD_SECONDS / SECTOR_COUNT : ORBIT_PERIOD_SECONDS;
      if (simulatedSeconds >= animationDuration) {
        elapsedRef.current = animationDuration;
        setElapsedSeconds(animationDuration);
        setPlaying(false);
        return;
      }
      elapsedRef.current = simulatedSeconds;
      setElapsedSeconds(simulatedSeconds);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, speedFactor, step]);

  function restart() {
    if (!window.confirm('2차시를 처음부터 다시 시작할까요? 지금까지의 답변과 관찰 기록이 모두 지워집니다.')) return;
    clearLessonStoredState('2');
    setStep(0);
    setHighestStep(0);
    setCompletedSteps([]);
    setPrediction(null);
    setAreaAnswer(null);
    setAreaComparisonComplete(false);
    setDemoEccentricity(DEMO_ECCENTRICITY);
    setSelectedSegments([]);
    setSpeedAnswer(null);
    setSelectedPlanet('earth');
    setPeriodAnswer(null);
    setThirdAnswer(null);
    setSummary({ first: '', second: '', third: '' });
    setSummarySubmitted(false);
    setNotes({ prediction: '', area: '', speed: '', third: '', summary: '' });
    setCompleted(false);
    setPlaying(false);
    setAreaElapsedSeconds(0);
    setSpeedElapsedSeconds(0);
    setSpeedFactor(1);
  }

  function navigateTo(next: number) {
    if (next > Math.max(highestStep, step)) return;
    setPlaying(false);
    setStep(next as LessonStep);
    setCompleted(false);
  }

  function advanceTo(next: LessonStep) {
    const firstVisit = next > Math.max(highestStep, step);
    setCompletedSteps((current) => current.includes(step) ? current : [...current, step]);
    setHighestStep((current) => Math.max(current, next));
    setStep(next);
    setCompleted(false);
    setPlaying(false);
    if (firstVisit && next === 2) setSpeedElapsedSeconds(0);
  }

  function finishLesson() {
    setCompletedSteps((current) => current.includes(step) ? current : [...current, step]);
    setHighestStep(4);
    setCompleted(true);
    setPlaying(false);
  }

  return <main className="lesson-main l2-main">
    <section className="lesson-intro">
      <div className="lesson-number">2차시 · 케플러 제2·3법칙</div>
      <h1>행성의 속도와 공전주기에는 어떤 규칙이 있을까?</h1>
      <p>행성의 움직임과 태양계 자료를 관찰해, 면적과 속도 그리고 공전주기에서 규칙을 찾아봅니다.</p>
      <div className="learning-objective"><b>오늘의 목표</b><span>같은 시간 동안 쓸린 면적이 같음을 발견하고, 공전주기와 궤도 긴반지름의 관계를 분석합니다.</span></div>
    </section>

    <section className="l2-layout">
      <div className="l2-content">
        <LessonStepNavigation lessonLabel="2차시" steps={['예상하기', '면적 비교', '속도 비교', '행성 자료', '법칙 정리'].map((label) => ({ label }))} currentStep={step} highestStep={completed ? 4 : highestStep} completedSteps={completedSteps} onNavigate={navigateTo}/>
        {(step === 1 || step === 2) && <AreaSimulation orbit={orbit} eccentricity={demoEccentricity} onEccentricityChange={(value) => { setDemoEccentricity(value); setPlaying(false); setAreaElapsedSeconds(0); setSpeedElapsedSeconds(0); setAreaComparisonComplete(false); }} playing={playing} setPlaying={setPlaying} elapsedSeconds={elapsedSeconds} setElapsedSeconds={setElapsedSeconds} speedFactor={speedFactor} setSpeedFactor={setSpeedFactor} selectedSegments={selectedSegments} onToggleSegment={(index) => { setSelectedSegments((current) => current.includes(index) ? current.filter((item) => item !== index) : current.length < 2 ? [...current, index] : [current[1], index]); setAreaComparisonComplete(false); }} onReset={() => { setPlaying(false); setElapsedSeconds(0); }} onComparisonComplete={setAreaComparisonComplete} revealAreaResult={step === 1 && areaAnswer !== null && selectedSegments.length === 2} revealSpeedResult={step === 2 && speedAnswer !== null} stage={step === 1 ? 'area' : 'speed'}/ >}
        {step === 0 && <section className="l2-activity"><div className="l2-heading"><span>도입 · 5분</span><h2>행성의 속도는 늘 같을까요?</h2></div><p><b>목표</b> 관찰을 시작하기 전에 자신의 예상을 남깁니다.</p><p>행성은 태양 주위를 공전할 때 항상 일정한 속도로 움직일까요? 태양에서의 거리에 따라 어떻게 달라질지 생각해 보세요.</p><fieldset className="l2-options"><legend>나의 예상</legend><label><input type="radio" name="prediction" checked={prediction === 'constant'} onChange={() => setPrediction('constant')}/> 공전하는 동안 속도는 거의 일정할 것 같다</label><label><input type="radio" name="prediction" checked={prediction === 'changes'} onChange={() => setPrediction('changes')}/> 태양과의 거리에 따라 달라질 것 같다</label><label><input type="radio" name="prediction" checked={prediction === 'unsure'} onChange={() => setPrediction('unsure')}/> 아직 잘 모르겠다</label></fieldset>{prediction && <Feedback>예상을 기록했습니다. 시뮬레이션을 관찰한 뒤 자신의 생각을 비교해 보세요.</Feedback>}<label className="l2-reflection">예상한 까닭<textarea rows={2} value={notes.prediction} onChange={(event) => setNotes({ ...notes, prediction: event.target.value })} placeholder="지금 떠오르는 생각을 짧게 적어 보세요."/></label><button className="l2-next" disabled={!prediction} onClick={() => advanceTo(1)}>면적 비교 시작 <span>→</span></button></section>}
        {step === 1 && <AreaInvestigation answer={areaAnswer} onAnswer={setAreaAnswer} pairReady={selectedSegments.length === 2} comparisonComplete={areaComparisonComplete} note={notes.area} onNoteChange={(value) => setNotes({ ...notes, area: value })} onNext={() => advanceTo(2)}/ >}
        {step === 2 && <SpeedInvestigation eccentricity={demoEccentricity} durationDays={comparisonDays} periInstant={periVelocity} apoInstant={apoVelocity} periDistance={periDistance} apoDistance={apoDistance} periAverage={periAverageSpeed} apoAverage={apoAverageSpeed} comparisonComplete={elapsedSeconds >= ORBIT_PERIOD_SECONDS / SECTOR_COUNT} answer={speedAnswer} onAnswer={setSpeedAnswer} note={notes.speed} onNoteChange={(value) => setNotes({ ...notes, speed: value })} onNext={() => advanceTo(3)}/>}
        {step === 3 && <PlanetDataInvestigation selectedId={selectedPlanet} onSelect={setSelectedPlanet} periodAnswer={periodAnswer} onPeriodAnswer={setPeriodAnswer} ratioAnswer={thirdAnswer} onRatioAnswer={setThirdAnswer} note={notes.third} onNoteChange={(value) => setNotes({ ...notes, third: value })} onNext={() => advanceTo(4)}/>}
        {step === 4 && !completed && <section className="l2-activity"><div className="l2-heading"><span>정리 · 5분</span><h2>관찰한 내용을 법칙에 연결해요</h2></div><p><b>목표</b> 케플러 세 법칙이 행성 운동의 어떤 특징을 설명하는지 구분합니다.</p><div className="l2-match-list"><label>행성 궤도는 타원이며 태양은 한 초점에 있다<select value={summary.first} onChange={(event) => setSummary({ ...summary, first: event.target.value })}><option value="">법칙 선택</option><option value="1">제1법칙</option><option value="2">제2법칙</option><option value="3">제3법칙</option></select></label><label>같은 시간 동안 태양-행성 선분이 같은 면적을 쓸고 간다<select value={summary.second} onChange={(event) => setSummary({ ...summary, second: event.target.value })}><option value="">법칙 선택</option><option value="1">제1법칙</option><option value="2">제2법칙</option><option value="3">제3법칙</option></select></label><label>공전주기의 제곱은 긴반지름의 세제곱에 비례한다<select value={summary.third} onChange={(event) => setSummary({ ...summary, third: event.target.value })}><option value="">법칙 선택</option><option value="1">제1법칙</option><option value="2">제2법칙</option><option value="3">제3법칙</option></select></label></div><button className="l2-check" disabled={!summary.first || !summary.second || !summary.third} onClick={() => setSummarySubmitted(true)}>정리 확인</button>{summarySubmitted && <Feedback correct={summary.first === '1' && summary.second === '2' && summary.third === '3'}>{summary.first === '1' && summary.second === '2' && summary.third === '3' ? '세 법칙을 모두 알맞게 연결했어요. 다음 차시에는 이 원리를 이용해 지구에서 화성으로 가는 이상적인 탐사선 궤도를 살펴봅니다.' : '각 문장에서 궤도의 모양, 같은 시간의 면적, 주기와 크기 중 무엇을 설명하는지 다시 생각해 보세요.'}</Feedback>}<label className="l2-reflection">오늘의 한 줄 정리<textarea rows={2} value={notes.summary} onChange={(event) => setNotes({ ...notes, summary: event.target.value })} placeholder="제2법칙과 제3법칙을 한 문장씩 정리해 보세요."/></label><button className="l2-next" disabled={!summarySubmitted || summary.first !== '1' || summary.second !== '2' || summary.third !== '3'} onClick={finishLesson}>2차시 완료 <span>✓</span></button></section>}
        {completed && <LessonCompletion title="2차시 탐구를 마쳤어요" introduction="같은 시간 동안의 면적과 행성 자료를 통해 케플러 제2·3법칙을 확인했습니다." summaryTitle="오늘의 핵심" summary="제2법칙: 같은 시간 동안 같은 면적을 쓸고 지나갑니다. 제3법칙: P²은 a³에 비례합니다." detail="태양에 가까운 구간에서는 같은 시간 동안 더 긴 궤도 거리를 이동합니다." nextLesson="다음 시간에는 케플러 법칙을 활용해 지구에서 화성으로 향하는 탐사선의 전이 궤도를 탐구합니다." onRestart={restart}/>}
      </div>
      <aside className="l2-side"><div className="l2-model-note"><b>모델 안내</b><p>애니메이션은 태양의 중력만 고려한 두 천체 타원 궤도입니다. 이심률은 차이를 보기 위한 교육용 예시이며 특정 행성의 궤도가 아닙니다.</p></div>{!completed && <button onClick={restart}>처음부터 다시하기</button>}</aside>
    </section>
  </main>;
}
