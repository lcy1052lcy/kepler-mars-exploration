import { useEffect, useMemo, useState } from 'react';
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

const DEMO_ECCENTRICITY = 0.62;
const ORBIT_PERIOD_SECONDS = 60;
const SECTOR_FRACTION = 0.035;
type LessonStep = 0 | 1 | 2 | 3 | 4;
type AreaAnswer = 'same' | 'different' | null;
type SpeedAnswer = 'near-faster' | 'far-faster' | 'same' | null;
type PlanetPeriodAnswer = 'proportional' | 'nonlinear' | null;

function Feedback({ correct, children }: { correct?: boolean; children: string }) {
  return <div className={`l2-feedback ${correct === undefined ? 'neutral' : correct ? 'correct' : 'retry'}`} role="status"><b>{correct === undefined ? '기록했어요' : correct ? '관찰이 잘 맞아요' : '다시 비교해 볼까요?'}</b><span>{children}</span></div>;
}

function StepProgress({ step }: { step: LessonStep }) {
  const labels = ['예상하기', '면적 비교', '속도 비교', '행성 자료', '법칙 정리'];
  return <div className="l2-progress" aria-label={`2차시 ${step + 1}단계, 전체 5단계`}>
    {labels.map((label, index) => <div key={label} className={`${index === step ? 'current' : ''} ${index < step ? 'done' : ''}`}><span>{index < step ? '✓' : index + 1}</span><b>{label}</b></div>)}
  </div>;
}

function formatDistance(meters: number): string {
  return (meters / 1_000_000_000).toFixed(3);
}

function sectorPath(orbit: ReturnType<typeof makeOrbit>, startSeconds: number, endSeconds: number, samples = 30): string {
  const points = Array.from({ length: samples + 1 }, (_, i) => {
    const state = stateAtTime(orbit.physical, startSeconds + ((endSeconds - startSeconds) * i) / samples);
    return [orbit.focusX - state.positionXM * orbit.scale, orbit.cy + state.positionYM * orbit.scale] as const;
  });
  return `M ${orbit.focusX} ${orbit.cy} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
}

function makeOrbit() {
  const semiMajorAxisM = ASTRONOMICAL_UNIT_M;
  const eccentricity = DEMO_ECCENTRICITY;
  const semiMinorAxisM = semiMajorAxisM * Math.sqrt(1 - eccentricity ** 2);
  const scale = 178 / semiMajorAxisM;
  const cx = 350;
  const cy = 190;
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

function AreaComparisonFigure() {
  return <div className="l2-area-unfolding" aria-label="같은 넓이 단위 칸으로 펼친 면적 비교 그림">
    <div><b>같은 넓이 칸으로 펼쳐 보기</b><span>위 궤도 그림의 실제 부채꼴을 칸으로 나누어 비교한 모형입니다.</span></div>
    <svg viewBox="0 0 470 150" role="img" aria-label="근일점은 15 곱하기 6, 원일점은 18 곱하기 5의 같은 크기 칸으로 나타내 두 영역 모두 90칸입니다.">
      <defs><pattern id="l2-equal-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1"/></pattern></defs>
      <g transform="translate(20 18)"><rect width="150" height="60" rx="2" fill="#35bfae"/><rect width="150" height="60" rx="2" fill="url(#l2-equal-grid)"/><text x="75" y="99" textAnchor="middle" className="l2-unfold-label">근일점 · 15 × 6 = 90칸</text></g>
      <g transform="translate(248 23)"><rect width="180" height="50" rx="2" fill="#eb965c"/><rect width="180" height="50" rx="2" fill="url(#l2-equal-grid)"/><text x="90" y="94" textAnchor="middle" className="l2-unfold-label">원일점 · 18 × 5 = 90칸</text></g>
    </svg>
    <p>칸 그림은 실제 부채꼴의 모양을 그린 것이 아니라, 같은 넓이를 서로 다른 직사각형으로 펼쳐 나타낸 비교 모형입니다.</p>
  </div>;
}

function AreaInvestigation({ answer, onAnswer, comparisonShown, onCompare, note, onNoteChange, onNext }: {
  answer: AreaAnswer;
  onAnswer: (answer: Exclude<AreaAnswer, null>) => void;
  comparisonShown: boolean;
  onCompare: () => void;
  note: string;
  onNoteChange: (note: string) => void;
  onNext: () => void;
}) {
  return <section className="l2-activity">
    <div className="l2-heading"><span>전개 1 · 15분</span><h2>같은 시간, 같은 면적일까요?</h2></div>
    <p><b>목표</b> 근일점과 원일점 부근에서 같은 시간 동안 쓸린 면적을 비교합니다.</p>
    <p>재생을 눌러 실제 부채꼴의 모양을 관찰하세요. 먼저 두 영역의 넓이가 어떻게 될지 예상하고 선택한 다음, 면적 비교하기로 칸을 펼쳐 확인합니다.</p>
    <div className="l2-observe-prompts"><span>관찰 순서</span><ol><li>재생·일시정지와 배속을 조절해 행성의 움직임을 살펴봅니다.</li><li>같은 시간 동안 생긴 두 부채꼴의 모양을 비교합니다.</li><li>넓이에 대한 예상을 선택한 뒤 비교 그림을 확인합니다.</li></ol></div>
    <fieldset className="l2-options"><legend>같은 시간 동안 쓸린 두 면적은 어떠할까요?</legend>
      <label><input type="radio" name="area" checked={answer === 'same'} onChange={() => onAnswer('same')}/> 거의 같다</label>
      <label><input type="radio" name="area" checked={answer === 'different'} onChange={() => onAnswer('different')}/> 차이가 난다</label>
    </fieldset>
    {answer && !comparisonShown && <><Feedback>예상을 기록했어요. 아래 비교 그림을 열어 확인해 보세요.</Feedback><button className="l2-compare-button" onClick={onCompare}>면적 비교하기</button></>}
    {comparisonShown && <><AreaComparisonFigure/><Feedback correct={answer === 'same'}>{answer === 'same' ? '맞아요. 같은 시간 동안 쓸린 두 영역은 넓이가 같습니다. 이것이 케플러 제2법칙의 면적 관계입니다.' : '칸으로 펼친 그림에서 두 영역의 같은 넓이를 확인했어요. 태양과 행성을 잇는 선분이 같은 시간 동안 같은 면적을 쓸고 지나갑니다.'}</Feedback></>}
    <label className="l2-reflection">관찰 기록<textarea rows={2} value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="부채꼴 모양과 펼친 칸 그림에서 무엇을 발견했나요?"/></label>
    <button className="l2-next" disabled={!answer || !comparisonShown} onClick={onNext}>속도 비교 <span>→</span></button>
  </section>;
}

function SpeedInvestigation({ durationDays, periInstant, apoInstant, periDistance, apoDistance, periAverage, apoAverage, answer, onAnswer, note, onNoteChange, onNext }: {
  durationDays: number;
  periInstant: number;
  apoInstant: number;
  periDistance: number;
  apoDistance: number;
  periAverage: number;
  apoAverage: number;
  answer: SpeedAnswer;
  onAnswer: (answer: Exclude<SpeedAnswer, null>) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onNext: () => void;
}) {
  const maxDistance = Math.max(periDistance, apoDistance);
  return <section className="l2-activity">
    <div className="l2-heading"><span>전개 2 · 10분</span><h2>어디에서 더 빠르게 움직일까요?</h2></div>
    <p><b>목표</b> 앞 단계와 같은 궤도에서 같은 시간 동안 이동한 거리와 평균 속력을 비교합니다.</p>
    <div className="l2-speed-method"><b>비교 조건과 계산 방법</b><span>같은 교육용 궤도(이심률 0.62)에서 두 구간 모두 Δt = {durationDays.toFixed(3)}일로 비교합니다.</span><span>평균 속력 = 이동 거리 ÷ 걸린 시간. 순간 속력은 근일점·원일점 바로 그 위치의 값입니다.</span></div>
    <div className="l2-velocity-readouts">
      {[{ label: '근일점 부근', instant: periInstant, distance: periDistance, average: periAverage, color: 'near' }, { label: '원일점 부근', instant: apoInstant, distance: apoDistance, average: apoAverage, color: 'far' }].map((item) => <article key={item.color} className={`l2-speed-card ${item.color}`}>
        <h3>{item.label}</h3><div className="l2-instant-readout"><span>그 위치의 순간 속력</span><b>{(item.instant / 1000).toFixed(2)} <small>km/s</small></b></div>
        <div className="l2-distance-readout"><span>같은 {durationDays.toFixed(3)}일 동안 이동한 거리</span><div className="l2-distance-track" role="img" aria-label={`${item.label} 이동 거리 ${formatDistance(item.distance)} 백만 km`}><i style={{ width: `${(item.distance / maxDistance) * 100}%` }}/></div><b>{formatDistance(item.distance)} <small>백만 km</small></b></div>
        <div className="l2-average-readout"><span>구간 평균 속력 (거리 ÷ 시간)</span><b>{(item.average / 1000).toFixed(2)} <small>km/s</small></b></div>
      </article>)}
    </div>
    <fieldset className="l2-options"><legend>같은 시간 동안 더 긴 거리를 이동하는 곳은 어디일까요?</legend>
      <label><input type="radio" name="speed" checked={answer === 'near-faster'} onChange={() => onAnswer('near-faster')}/> 태양에 가까운 근일점 부근</label>
      <label><input type="radio" name="speed" checked={answer === 'far-faster'} onChange={() => onAnswer('far-faster')}/> 태양에서 먼 원일점 부근</label>
      <label><input type="radio" name="speed" checked={answer === 'same'} onChange={() => onAnswer('same')}/> 두 곳에서 같다</label>
    </fieldset>
    {answer && <Feedback correct={answer === 'near-faster'}>{answer === 'near-faster' ? '맞아요. 같은 시간 동안 근일점 부근에서 더 긴 거리를 이동하고 구간 평균 속력도 큽니다. 같은 시간의 면적이 같다는 앞 활동과 함께 케플러 제2법칙을 설명합니다.' : '두 거리 막대와 평균 속력을 비교해 보세요. 태양에 가까운 근일점 구간의 이동량이 더 큽니다.'}</Feedback>}
    <label className="l2-reflection">관찰 기록<textarea rows={2} value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="같은 시간 동안 이동한 거리와 속력은 어떻게 달랐나요?"/></label>
    <button className="l2-next" disabled={!answer} onClick={onNext}>행성 자료 분석 <span>→</span></button>
  </section>;
}

function AreaSimulation({ playing, setPlaying, elapsedSeconds, setElapsedSeconds, speedFactor, setSpeedFactor }: {
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  elapsedSeconds: number;
  setElapsedSeconds: (seconds: number) => void;
  speedFactor: number;
  setSpeedFactor: (factor: number) => void;
}) {
  const orbit = useMemo(makeOrbit, []);
  const period = orbit.periodSeconds;
  const interval = period * SECTOR_FRACTION;
  const periEnd = interval;
  const apoStart = period / 2 - interval / 2;
  const apoEnd = apoStart + interval;
  const current = stateAtTime(orbit.physical, ((elapsedSeconds / ORBIT_PERIOD_SECONDS) * period) % period);
  const currentX = orbit.focusX - current.positionXM * orbit.scale;
  const currentY = orbit.cy + current.positionYM * orbit.scale;
  const periArea = sweptAreaBetweenTimes(orbit.physical, 0, interval) / ASTRONOMICAL_UNIT_M ** 2;
  const apoArea = sweptAreaBetweenTimes(orbit.physical, apoStart, apoEnd) / ASTRONOMICAL_UNIT_M ** 2;
  const days = interval / SECONDS_PER_DAY;

  return <div className="l2-orbit-shell">
    <div className="l2-orbit-head"><div><b>타원 궤도 관찰</b><span>교육용 예시 궤도 · 이심률 {DEMO_ECCENTRICITY.toFixed(2)}</span></div><span>시뮬레이션 1년 = 60초 (1배속)</span></div>
    <svg className="l2-orbit-svg" viewBox="0 0 700 390" role="img" aria-label="타원 궤도에서 근일점과 원일점 주변의 동일 시간 면적을 서로 다른 색으로 비교합니다.">
      <defs>
        <marker id="l2-radius-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z" fill="#ffe18b"/></marker>
        <radialGradient id="l2-sun"><stop stopColor="#fff3bd"/><stop offset=".45" stopColor="#ffc957"/><stop offset="1" stopColor="#ffae45" stopOpacity=".12"/></radialGradient>
      </defs>
      <line x1={orbit.cx - orbit.rx} y1={orbit.cy} x2={orbit.cx + orbit.rx} y2={orbit.cy} stroke="#566680" strokeDasharray="5 6"/>
      <ellipse cx={orbit.cx} cy={orbit.cy} rx={orbit.rx} ry={orbit.ry} fill="rgba(160,180,219,.035)" stroke="#b6c7eb" strokeWidth="2.5"/>
      <path d={sectorPath(orbit, 0, periEnd)} fill="rgba(75,213,190,.45)" stroke="#61e1ca" strokeWidth="1.5"/>
      <path d={sectorPath(orbit, apoStart, apoEnd)} fill="rgba(245,159,89,.5)" stroke="#ffb06d" strokeWidth="1.5"/>
      <line x1={orbit.focusX} y1={orbit.cy} x2={currentX} y2={currentY} stroke="#ffe18b" strokeWidth="1.6" markerEnd="url(#l2-radius-arrow)"/>
      <circle cx={orbit.focusX} cy={orbit.cy} r="13" fill="url(#l2-sun)"/><circle cx={orbit.focusX} cy={orbit.cy} r="5" fill="#ffd16b"/>
      <circle cx={orbit.cx - orbit.rx} cy={orbit.cy} r="5" fill="#65e2c8" stroke="#112039" strokeWidth="2"/>
      <circle cx={orbit.cx + orbit.rx} cy={orbit.cy} r="5" fill="#ffb06d" stroke="#112039" strokeWidth="2"/>
      <circle cx={currentX} cy={currentY} r="8" fill="#f1f5ff" stroke="#a6b7fb" strokeWidth="3"/>
      <text x={orbit.cx - orbit.rx - 12} y={orbit.cy + 5} textAnchor="end" className="l2-svg-label">근일점</text>
      <text x={orbit.cx + orbit.rx + 12} y={orbit.cy + 5} className="l2-svg-label">원일점</text>
      <text x={orbit.focusX} y={orbit.cy + 29} textAnchor="middle" className="l2-svg-label">태양</text>
      <text x="350" y="370" textAnchor="middle" className="l2-svg-hint">위의 청록색·주황색 부채꼴은 실제 궤도에서 같은 시간 동안 쓸린 영역입니다.</text>
    </svg>
    <div className="l2-area-comparison" aria-live="polite">
      <div className="peri-area"><span><i/>근일점 부근 · 같은 시간 {days.toFixed(3)}일</span><b>{periArea.toFixed(4)} <small>AU²</small></b></div>
      <div className="apo-area"><span><i/>원일점 부근 · 같은 시간 {days.toFixed(3)}일</span><b>{apoArea.toFixed(4)} <small>AU²</small></b></div>
      <div className="same-area">두 면적의 차이 <b>{Math.abs(periArea - apoArea).toExponential(1)} AU²</b></div>
    </div>
    <div className="l2-playback">
      <div className="l2-play-buttons"><button onClick={() => setPlaying(!playing)}>{playing ? '일시정지' : '재생'}</button><button onClick={() => { setPlaying(false); setElapsedSeconds(0); }}>초기화</button></div>
      <label>배속 <select value={speedFactor} onChange={(event) => setSpeedFactor(Number(event.target.value))}><option value="0.5">0.5배</option><option value="1">1배</option><option value="2">2배</option><option value="4">4배</option></select></label>
      <span>현재 위치: {(elapsedSeconds / ORBIT_PERIOD_SECONDS * 100).toFixed(1)}% 공전</span>
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
  const [step, setStep] = useState<LessonStep>(0);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [areaAnswer, setAreaAnswer] = useState<AreaAnswer>(null);
  const [areaComparisonShown, setAreaComparisonShown] = useState(false);
  const [speedAnswer, setSpeedAnswer] = useState<SpeedAnswer>(null);
  const [selectedPlanet, setSelectedPlanet] = useState('earth');
  const [periodAnswer, setPeriodAnswer] = useState<PlanetPeriodAnswer>(null);
  const [thirdAnswer, setThirdAnswer] = useState<string | null>(null);
  const [summary, setSummary] = useState({ first: '', second: '', third: '' });
  const [summarySubmitted, setSummarySubmitted] = useState(false);
  const [notes, setNotes] = useState({ prediction: '', area: '', speed: '', third: '', summary: '' });
  const [completed, setCompleted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [speedFactor, setSpeedFactor] = useState(1);

  const orbit = useMemo(makeOrbit, []);
  const interval = orbit.periodSeconds * SECTOR_FRACTION;
  const periVelocity = stateAtTrueAnomaly(orbit.physical, 0).speedMS;
  const apoVelocity = stateAtTrueAnomaly(orbit.physical, Math.PI).speedMS;
  const periDistance = distanceTraveledBetweenTimes(orbit.physical, 0, interval, 128);
  const apoStart = orbit.periodSeconds / 2 - interval / 2;
  const apoDistance = distanceTraveledBetweenTimes(orbit.physical, apoStart, apoStart + interval, 128);
  const periAverageSpeed = averageSpeedMS(periDistance, interval);
  const apoAverageSpeed = averageSpeedMS(apoDistance, interval);
  const comparisonDays = interval / SECONDS_PER_DAY;

  useEffect(() => {
    if (!playing) return;
    let frameId = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const deltaSeconds = (now - previous) / 1000;
      previous = now;
      setElapsedSeconds((value) => (value + deltaSeconds * (ORBIT_PERIOD_SECONDS / 60) * speedFactor) % ORBIT_PERIOD_SECONDS);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, speedFactor]);

  function restart() {
    if (!window.confirm('2차시를 처음부터 다시 시작할까요? 지금까지의 답변과 관찰 기록이 모두 지워집니다.')) return;
    setStep(0);
    setPrediction(null);
    setAreaAnswer(null);
    setAreaComparisonShown(false);
    setSpeedAnswer(null);
    setSelectedPlanet('earth');
    setPeriodAnswer(null);
    setThirdAnswer(null);
    setSummary({ first: '', second: '', third: '' });
    setSummarySubmitted(false);
    setNotes({ prediction: '', area: '', speed: '', third: '', summary: '' });
    setCompleted(false);
    setPlaying(false);
    setElapsedSeconds(0);
    setSpeedFactor(1);
  }

  return <main className="lesson-main l2-main">
    <section className="lesson-intro">
      <div className="lesson-number">2차시 · 케플러 제2·3법칙</div>
      <h1>행성의 속도와 공전주기에는 어떤 규칙이 있을까?</h1>
      <p>행성의 움직임과 태양계 자료를 관찰해, 면적과 속도 그리고 공전주기에서 규칙을 찾아봅니다.</p>
      <div className="learning-objective"><b>오늘의 목표</b><span>같은 시간 동안 쓸린 면적이 같음을 발견하고, 공전주기와 궤도 긴반지름의 관계를 분석합니다.</span></div>
      <div className="l2-time-plan" aria-label="수업 활동 시간">도입 5분 <i/> 면적 비교 15분 <i/> 속도 비교 10분 <i/> 행성 자료 15분 <i/> 정리 5분</div>
    </section>

    <section className="l2-layout">
      <div className="l2-content">
        <StepProgress step={step}/>
        {(step === 1 || step === 2) && <AreaSimulation playing={playing} setPlaying={setPlaying} elapsedSeconds={elapsedSeconds} setElapsedSeconds={setElapsedSeconds} speedFactor={speedFactor} setSpeedFactor={setSpeedFactor}/ >}
        {step === 0 && <section className="l2-activity"><div className="l2-heading"><span>도입 · 5분</span><h2>행성의 속도는 늘 같을까요?</h2></div><p><b>목표</b> 관찰을 시작하기 전에 자신의 예상을 남깁니다.</p><p>행성은 태양 주위를 공전할 때 항상 일정한 속도로 움직일까요? 태양에서의 거리에 따라 어떻게 달라질지 생각해 보세요.</p><fieldset className="l2-options"><legend>나의 예상</legend><label><input type="radio" name="prediction" checked={prediction === 'constant'} onChange={() => setPrediction('constant')}/> 공전하는 동안 속도는 거의 일정할 것 같다</label><label><input type="radio" name="prediction" checked={prediction === 'changes'} onChange={() => setPrediction('changes')}/> 태양과의 거리에 따라 달라질 것 같다</label><label><input type="radio" name="prediction" checked={prediction === 'unsure'} onChange={() => setPrediction('unsure')}/> 아직 잘 모르겠다</label></fieldset>{prediction && <Feedback>예상을 기록했습니다. 시뮬레이션을 관찰한 뒤 자신의 생각을 비교해 보세요.</Feedback>}<label className="l2-reflection">예상한 까닭<textarea rows={2} value={notes.prediction} onChange={(event) => setNotes({ ...notes, prediction: event.target.value })} placeholder="지금 떠오르는 생각을 짧게 적어 보세요."/></label><button className="l2-next" disabled={!prediction} onClick={() => setStep(1)}>면적 비교 시작 <span>→</span></button></section>}
        {step === 1 && <AreaInvestigation answer={areaAnswer} onAnswer={(value) => { setAreaAnswer(value); setAreaComparisonShown(false); }} comparisonShown={areaComparisonShown} onCompare={() => setAreaComparisonShown(true)} note={notes.area} onNoteChange={(value) => setNotes({ ...notes, area: value })} onNext={() => { setPlaying(false); setAreaComparisonShown(false); setStep(2); }}/ >}
        {step === 2 && <SpeedInvestigation durationDays={comparisonDays} periInstant={periVelocity} apoInstant={apoVelocity} periDistance={periDistance} apoDistance={apoDistance} periAverage={periAverageSpeed} apoAverage={apoAverageSpeed} answer={speedAnswer} onAnswer={setSpeedAnswer} note={notes.speed} onNoteChange={(value) => setNotes({ ...notes, speed: value })} onNext={() => setStep(3)}/>}
        {step === 3 && <PlanetDataInvestigation selectedId={selectedPlanet} onSelect={setSelectedPlanet} periodAnswer={periodAnswer} onPeriodAnswer={setPeriodAnswer} ratioAnswer={thirdAnswer} onRatioAnswer={setThirdAnswer} note={notes.third} onNoteChange={(value) => setNotes({ ...notes, third: value })} onNext={() => setStep(4)}/>}
        {step === 4 && !completed && <section className="l2-activity"><div className="l2-heading"><span>정리 · 5분</span><h2>관찰한 내용을 법칙에 연결해요</h2></div><p><b>목표</b> 케플러 세 법칙이 행성 운동의 어떤 특징을 설명하는지 구분합니다.</p><div className="l2-match-list"><label>행성 궤도는 타원이며 태양은 한 초점에 있다<select value={summary.first} onChange={(event) => setSummary({ ...summary, first: event.target.value })}><option value="">법칙 선택</option><option value="1">제1법칙</option><option value="2">제2법칙</option><option value="3">제3법칙</option></select></label><label>같은 시간 동안 태양-행성 선분이 같은 면적을 쓸고 간다<select value={summary.second} onChange={(event) => setSummary({ ...summary, second: event.target.value })}><option value="">법칙 선택</option><option value="1">제1법칙</option><option value="2">제2법칙</option><option value="3">제3법칙</option></select></label><label>공전주기의 제곱은 긴반지름의 세제곱에 비례한다<select value={summary.third} onChange={(event) => setSummary({ ...summary, third: event.target.value })}><option value="">법칙 선택</option><option value="1">제1법칙</option><option value="2">제2법칙</option><option value="3">제3법칙</option></select></label></div><button className="l2-check" disabled={!summary.first || !summary.second || !summary.third} onClick={() => setSummarySubmitted(true)}>정리 확인</button>{summarySubmitted && <Feedback correct={summary.first === '1' && summary.second === '2' && summary.third === '3'}>{summary.first === '1' && summary.second === '2' && summary.third === '3' ? '세 법칙을 모두 알맞게 연결했어요. 다음 차시에는 이 원리를 이용해 지구에서 화성으로 가는 이상적인 탐사선 궤도를 살펴봅니다.' : '각 문장에서 궤도의 모양, 같은 시간의 면적, 주기와 크기 중 무엇을 설명하는지 다시 생각해 보세요.'}</Feedback>}<label className="l2-reflection">오늘의 한 줄 정리<textarea rows={2} value={notes.summary} onChange={(event) => setNotes({ ...notes, summary: event.target.value })} placeholder="제2법칙과 제3법칙을 한 문장씩 정리해 보세요."/></label><button className="l2-next" disabled={!summarySubmitted || summary.first !== '1' || summary.second !== '2' || summary.third !== '3'} onClick={() => setCompleted(true)}>2차시 완료 <span>✓</span></button></section>}
        {completed && <section className="l2-activity l2-completed"><div className="l2-complete-icon">✓</div><h2>2차시 탐구를 마쳤어요</h2><p>같은 시간의 면적과 행성 자료를 통해 케플러 제2·3법칙의 규칙을 확인했습니다.</p><div className="l2-law-summary"><b>제2법칙</b><span>같은 시간 동안 같은 면적을 쓸고 지나갑니다.</span><b>제3법칙</b><span>P²은 a³에 비례합니다.</span></div><p className="l2-next-lesson-note">다음 차시에서는 케플러 법칙을 활용해 지구에서 화성으로 가는 탐사선의 전이 궤도를 탐구합니다.</p></section>}
      </div>
      <aside className="l2-side"><div className="l2-model-note"><b>모델 안내</b><p>애니메이션은 태양의 중력만 고려한 두 천체 타원 궤도입니다. 이심률 0.62는 차이를 보기 위한 교육용 예시이며 특정 행성의 궤도가 아닙니다.</p></div><button onClick={restart}>처음부터 다시하기</button></aside>
    </section>
  </main>;
}
