import { useState } from 'react';
import { lessons } from '../content/lessons';
import { PLANET_ECCENTRICITIES, PLANET_ECCENTRICITY_SOURCE } from '../content/planetEccentricities';
import { ASTRONOMICAL_UNIT_M, ellipseGeometry } from '../physics';
import KeplerLawsLesson from '../features/lesson-02/KeplerLawsLesson';
import LessonCompletion from './LessonCompletion';

type Step = 0 | 1 | 2 | 3;

const ORBIT_DETAILS = {
  peri: { title: '근일점', description: '태양과 행성 사이 거리가 가장 짧은 궤도상의 점입니다.' },
  apo: { title: '원일점', description: '태양과 행성 사이 거리가 가장 긴 궤도상의 점입니다.' },
  center: { title: '타원의 중심', description: '타원의 대칭 중심입니다. 이심률이 0인 원에서는 두 초점과 같은 위치가 됩니다.' },
  sun: { title: '태양이 있는 초점', description: '케플러 제1법칙에 따라 태양은 타원의 두 초점 중 한 곳에 있습니다.' },
  focus: { title: '다른 초점', description: '태양은 아니지만 타원의 정의에 포함되는 두 번째 초점입니다.' },
  radius: { title: '긴반지름 a', description: '타원의 중심에서 긴축 방향의 끝점까지의 거리입니다. 태양에서 재는 거리가 아닙니다.' },
} as const;
type OrbitInfoKey = keyof typeof ORBIT_DETAILS;

function OrbitArt({ eccentricity, onSunGuess, submitted }: { eccentricity: number; onSunGuess?: (guess: 'center' | 'left' | 'right' | 'orbit') => void; submitted?: boolean }) {
  const geometry = ellipseGeometry(1, eccentricity);
  const scale = 100;
  const cx = 210;
  const cy = 130;
  const a = geometry.semiMajorAxis * scale;
  const b = geometry.semiMinorAxis * scale;
  const c = geometry.focusDistance * scale;
  const sunX = cx - c;
  const secondFocusX = cx + c;
  const periX = cx - a;
  const apoX = cx + a;
  const canGuess = Boolean(onSunGuess) && !submitted;

  return <svg className="orbit-art" viewBox="0 0 420 270" role="img" aria-label={`이심률 ${eccentricity.toFixed(4)}인 타원 궤도. 긴반지름은 타원의 중심에서 장축 끝까지입니다.`}>
    <defs>
      <radialGradient id="sun-glow"><stop stopColor="#fff6ce"/><stop offset=".5" stopColor="#ffd166"/><stop offset="1" stopColor="#f4a340" stopOpacity=".08"/></radialGradient>
      <marker id="radius-start" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto"><path d="M6 0 1 3.5 6 7" fill="none" stroke="#57d8c6" strokeWidth="1.5"/></marker>
      <marker id="radius-end" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M1 0 6 3.5 1 7" fill="none" stroke="#57d8c6" strokeWidth="1.5"/></marker>
    </defs>
    <line x1={cx - a} y1={cy} x2={cx + a} y2={cy} stroke="#52617d" strokeWidth="1" strokeDasharray="4 6" />
    <ellipse cx={cx} cy={cy} rx={a} ry={b} fill="rgba(147,169,218,.06)" stroke="#b9c8f2" strokeWidth="2.5" />
    <line x1={sunX} y1={cy + 12} x2={secondFocusX} y2={cy + 12} stroke="#8795b0" strokeWidth="1" strokeDasharray="4 5" opacity=".8" />
    <line x1={cx} y1={cy} x2={apoX} y2={cy} stroke="#57d8c6" strokeWidth="3" strokeLinecap="round" markerStart="url(#radius-start)" markerEnd="url(#radius-end)" />
    <circle cx={periX} cy={cy} r="5" fill="#ffc078" stroke="#111827" strokeWidth="2" />
    <circle cx={apoX} cy={cy} r="5" fill="#a6b8ff" stroke="#111827" strokeWidth="2" />
    <circle cx={cx} cy={cy} r="4.5" fill="#f4f6fb" stroke="#152035" strokeWidth="1.5" />

    <g className={canGuess ? 'focus-choice' : ''} onClick={() => canGuess && onSunGuess?.('left')} role={canGuess ? 'button' : undefined} tabIndex={canGuess ? 0 : undefined} aria-label={canGuess ? '왼쪽 초점을 태양의 자리로 선택' : undefined} onKeyDown={(event) => { if (canGuess && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSunGuess?.('left'); } }}>
      <circle cx={sunX} cy={cy} r="14" fill="url(#sun-glow)" />
      <circle cx={sunX} cy={cy} r="6" fill="#ffd166" />
      {canGuess && <circle cx={sunX} cy={cy} r="22" fill="transparent" />}
    </g>
    <g className={canGuess ? 'focus-choice' : ''} onClick={() => canGuess && onSunGuess?.('right')} role={canGuess ? 'button' : undefined} tabIndex={canGuess ? 0 : undefined} aria-label={canGuess ? '오른쪽 초점을 태양의 자리로 선택' : undefined} onKeyDown={(event) => { if (canGuess && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSunGuess?.('right'); } }}>
      <circle cx={secondFocusX} cy={cy} r="9" fill="none" stroke="#e1e8f8" strokeWidth="2" strokeDasharray="3 2" />
      {canGuess && <circle cx={secondFocusX} cy={cy} r="22" fill="transparent" />}
    </g>
    {canGuess && <g className="focus-choice" onClick={() => onSunGuess?.('orbit')} role="button" tabIndex={0} aria-label="궤도 위 지점을 태양의 자리로 선택" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSunGuess?.('orbit'); } }}><circle cx={cx} cy={cy - b} r="20" fill="transparent"/><circle cx={cx} cy={cy - b} r="4" fill="#c8d2e7"/><title>궤도 위</title></g>}
  </svg>;
}

function Feedback({ correct, children }: { correct: boolean; children: string }) {
  return <div className={`answer-feedback ${correct ? 'correct' : 'retry'}`} role="status"><b>{correct ? '잘 관찰했어요' : '다시 생각해 볼까요?'}</b><span>{children}</span></div>;
}

export default function App() {
  const [selectedLesson, setSelectedLesson] = useState(1);
  const [step, setStep] = useState<Step>(0);
  const [eccentricity, setEccentricity] = useState(0.35);
  const [mode, setMode] = useState<'concept' | 'planet'>('concept');
  const [selectedPlanet, setSelectedPlanet] = useState('earth');
  const [answer1, setAnswer1] = useState<string | null>(null);
  const [answer2, setAnswer2] = useState<'center' | 'left' | 'right' | 'orbit' | null>(null);
  const [answer3, setAnswer3] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [finalExplanation, setFinalExplanation] = useState('');
  const [reflection1, setReflection1] = useState('');
  const [reflection2, setReflection2] = useState('');
  const [reflection3, setReflection3] = useState('');
  const [focusAttempted, setFocusAttempted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [orbitInfo, setOrbitInfo] = useState<OrbitInfoKey | null>(null);

  const activePlanet = PLANET_ECCENTRICITIES.find((planet) => planet.id === selectedPlanet)!;
  const activeEccentricity = mode === 'concept' ? eccentricity : activePlanet.eccentricity;
  const orbit = ellipseGeometry(ASTRONOMICAL_UNIT_M, activeEccentricity);
  const lesson = lessons.find((item) => item.id === selectedLesson)!;
  const largestEccentricityPlanet = [...PLANET_ECCENTRICITIES].sort((a, b) => b.eccentricity - a.eccentricity)[0];
  const answer1Correct = answer1 === 'ellipse';
  const answer3Correct = answer3 === largestEccentricityPlanet.id;
  const selectedOrbitInfo = orbitInfo ? ORBIT_DETAILS[orbitInfo] : null;

  function goNext() {
    if (step < 3) enterStep((step + 1) as Step);
    else setCompleted(true);
  }

  function chooseFocus(guess: 'center' | 'left' | 'right' | 'orbit') {
    if (answer2 === null) {
      setAnswer2(guess);
      setFocusAttempted(true);
    }
  }

  function restartFromBeginning() {
    if (!window.confirm('처음부터 다시 시작할까요? 지금까지의 답변과 관찰 기록이 모두 지워집니다.')) return;
    setStep(0);
    setEccentricity(0.35);
    setMode('concept');
    setSelectedPlanet('earth');
    setSelectedLesson(1);
    setAnswer1(null);
    setAnswer2(null);
    setAnswer3(null);
    setExplanation('');
    setFinalExplanation('');
    setReflection1('');
    setReflection2('');
    setReflection3('');
    setFocusAttempted(false);
    setCompleted(false);
    setOrbitInfo(null);
  }

  function enterStep(next: Step) {
    setStep(next);
    if (next === 1) {
      setMode('concept');
      setEccentricity(0.5);
      setAnswer2(null);
      setFocusAttempted(false);
    }
    if (next === 2) setMode('planet');
  }

  return <div className="learning-app" id="top">
    <header className="learning-header">
      <a className="learning-brand" href="#top"><span className="brand-mark">K</span><span>케플러 법칙으로 떠나는 화성 탐사</span></a>
      <nav className="lesson-tabs" aria-label="차시 이동">{lessons.map((item) => <button key={item.id} className={selectedLesson === item.id ? 'active' : ''} onClick={() => setSelectedLesson(item.id)}><span>{item.id}차시</span><small>{['타원 궤도', '속도와 주기', '화성 전이', '실제 탐사'][item.id - 1]}</small></button>)}</nav>
    </header>

    {selectedLesson === 2 ? <KeplerLawsLesson /> : selectedLesson > 2 ? <main className="lesson-main"><section className="lesson-intro"><div className="lesson-number">{selectedLesson}차시</div><h1>{lesson.title}</h1><p>이 차시는 다음 개발 단계에서 구현합니다.</p></section></main> : <main className="lesson-main">
      <section className="lesson-intro">
        <div className="lesson-number">1차시 · 케플러 제1법칙</div>
        <h1>{lesson.title}</h1>
        <p>이심률을 바꾸고 행성 궤도를 비교하며, 태양이 타원에서 어디에 있는지 직접 찾아보세요.</p>
        <div className="learning-objective"><b>오늘의 목표</b><span>이심률에 따른 궤도 모양을 설명하고, 태양이 타원의 한 초점에 있음을 확인합니다.</span></div>
      </section>

      <section className="investigation-layout" aria-label="케플러 제1법칙 단계별 탐구">
        <div className="exploration-column">
          <div className="step-progress" aria-label={`탐구 ${step + 1}단계, 전체 4단계`}>
            {['모양 살펴보기', '태양의 위치 찾기', '행성 비교하기', '정리하기'].map((label, index) => <div key={label} className={`${index === step ? 'current' : ''} ${index < step || completed ? 'done' : ''}`}><span>{index < step || completed ? '✓' : index + 1}</span><b>{label}</b></div>)}
          </div>
          <section className="orbit-panel" aria-label="궤도 시뮬레이션">
            <div className="orbit-panel-heading"><div><span>궤도 관찰</span><b>{mode === 'concept' ? '개념 학습' : `${activePlanet.name} · 실제 이심률 ${activeEccentricity.toFixed(4)}`}</b></div></div>
            <OrbitArt eccentricity={activeEccentricity} onSunGuess={step === 1 ? chooseFocus : undefined} submitted={answer2 !== null} />
            <div className="orbit-legend" aria-label="궤도 표시 범례">
              <button onClick={() => setOrbitInfo('peri')}><i className="legend-peri"/><span>근일점</span></button>
              <button onClick={() => setOrbitInfo('apo')}><i className="legend-apo"/><span>원일점</span></button>
              <button onClick={() => setOrbitInfo('center')}><i className="legend-center"/><span>타원의 중심</span></button>
              <button onClick={() => setOrbitInfo('sun')}><i className="legend-sun"/><span>태양이 있는 초점</span></button>
              <button onClick={() => setOrbitInfo('focus')}><i className="legend-focus"/><span>다른 초점</span></button>
              <button onClick={() => setOrbitInfo('radius')}><i className="legend-a"/><span>긴반지름 a</span></button>
            </div>
            {selectedOrbitInfo && <div className="orbit-info" role="status"><span>{selectedOrbitInfo.title}</span><p>{selectedOrbitInfo.description}</p><button onClick={() => setOrbitInfo(null)} aria-label="설명 닫기">닫기</button></div>}
            <div className="orbit-data" aria-live="polite"><div><span>근일점 거리</span><b>{(orbit.periapsisDistance / ASTRONOMICAL_UNIT_M).toFixed(3)} <small>AU</small></b></div><div><span>원일점 거리</span><b>{(orbit.apoapsisDistance / ASTRONOMICAL_UNIT_M).toFixed(3)} <small>AU</small></b></div><div><span>이심률</span><b>{activeEccentricity.toFixed(mode === 'concept' ? 2 : 4)}</b></div></div>
            {mode === 'planet' && <p className="comparison-distance-note">행성 모드의 긴반지름을 1 AU로 맞춰 계산한 비교용 거리입니다. 실제 행성의 태양 거리와 다릅니다.</p>}
            <div className="orbit-controls">
              {mode === 'concept' ? <div className="slider-control"><label htmlFor="eccentricity">이심률 <strong>{eccentricity.toFixed(2)}</strong></label><input id="eccentricity" aria-label="개념 학습 이심률" type="range" min="0" max="0.8" step="0.01" value={eccentricity} onChange={(event) => { setEccentricity(Number(event.target.value)); setAnswer1(null); }} /><div className="range-labels"><span>원에 가까움</span><span>길쭉한 타원</span></div></div> : <div className="planet-control"><span>행성을 선택해 이심률을 비교하세요</span><div>{PLANET_ECCENTRICITIES.map((planet) => <button key={planet.id} className={selectedPlanet === planet.id ? 'selected' : ''} aria-pressed={selectedPlanet === planet.id} onClick={() => setSelectedPlanet(planet.id)}>{planet.name}</button>)}</div></div>}
            </div>
            {mode === 'planet' && <p className="scale-note">모양을 비교하려고 화면의 긴반지름 길이를 같게 맞췄습니다. 실제 궤도 크기는 행성마다 다릅니다. <a href={PLANET_ECCENTRICITY_SOURCE.url} target="_blank" rel="noreferrer">자료: NASA Goddard Planetary Fact Sheet</a></p>}
          </section>

          <section className="activity-panel" aria-live="polite">
            {!completed && step === 0 && <>
              <div className="activity-heading"><span>탐구 1</span><h2>이심률과 궤도 모양</h2></div>
              <p className="activity-goal"><b>목표</b> 이심률을 바꾸고 궤도의 모양이 어떻게 달라지는지 설명해 봅니다.</p>
              <p className="activity-instruction">슬라이더를 0.00과 0.60 근처로 움직여 궤도를 비교한 다음, 관찰한 모양을 고르세요.</p>
              <fieldset className="answer-options"><legend>이심률이 커질수록 궤도는 어떻게 보이나요?</legend><label><input type="radio" name="shape" checked={answer1 === 'circle'} onChange={() => setAnswer1('circle')} /> 원에 더 가까워진다</label><label><input type="radio" name="shape" checked={answer1 === 'ellipse'} onChange={() => setAnswer1('ellipse')} /> 더 길쭉한 타원이 된다</label></fieldset>
              {answer1 !== null && <Feedback correct={answer1Correct}>{answer1Correct ? '이심률이 커질수록 두 초점이 중심에서 멀어지고 타원은 더 길쭉해집니다.' : '이심률을 키운 뒤 궤도의 세로 폭과 초점 사이 거리를 다시 살펴보세요.'}</Feedback>}
              <label className="reflection-field">관찰 기록 <textarea value={reflection1} onChange={(event) => setReflection1(event.target.value)} placeholder="슬라이더를 움직이며 발견한 변화를 한 문장으로 적어 보세요." rows={2}/></label>
              <button className="next-step" disabled={answer1 === null} onClick={goNext}>다음 탐구 <span>→</span></button>
            </>}
            {!completed && step === 1 && <>
              <div className="activity-heading"><span>탐구 2</span><h2>태양은 타원의 어디에 있을까?</h2></div>
              <p className="activity-goal"><b>목표</b> 타원의 중심과 두 초점을 관찰해 태양의 위치를 찾아봅니다.</p>
              <p className="activity-instruction">이심률 0.50에서 중심(가운데 점)과 양쪽 초점의 간격을 살펴보세요. 그림 속 점이나 아래 선택지를 누르세요. 응답 후 이심률을 낮춰 중심과 초점이 가까워지는 모습도 관찰할 수 있습니다.</p>
              <div className="interaction-hint">태양은 타원의 중심, 한 초점, 궤도 위 중 어디에 있나요?</div>
              {answer2 === null && <div className="position-options"><button onClick={() => chooseFocus('center')}>타원의 중심</button><button onClick={() => chooseFocus('left')}>한 초점</button><button onClick={() => chooseFocus('orbit')}>궤도 위</button></div>}
              {answer2 !== null && <Feedback correct={answer2 === 'left'}>{answer2 === 'left' ? '맞아요. 케플러 제1법칙은 행성의 궤도가 타원이고 태양은 두 초점 중 하나에 있다고 설명합니다. 이심률을 낮추면 두 초점이 중심 쪽으로 가까워집니다.' : '태양은 타원의 중심이나 궤도 위가 아니라 두 초점 중 한 곳에 있습니다. 케플러 제1법칙과 연결해 다시 살펴보세요.'}</Feedback>}
              {focusAttempted && <div className="lower-eccentricity"><label htmlFor="focus-eccentricity">이심률을 낮춰 초점 간격 관찰 <b>{eccentricity.toFixed(2)}</b></label><input id="focus-eccentricity" type="range" min="0" max="0.5" step="0.01" value={eccentricity} onChange={(event) => setEccentricity(Number(event.target.value))}/></div>}
              <label className="reflection-field">관찰 기록 <textarea value={reflection2} onChange={(event) => setReflection2(event.target.value)} placeholder="중심과 초점은 어떻게 다른 위치인가요?" rows={2}/></label>
              <button className="next-step" disabled={answer2 === null} onClick={() => enterStep(2)}>다음 탐구 <span>→</span></button>
            </>}
            {!completed && step === 2 && <>
              <div className="activity-heading"><span>탐구 3</span><h2>실제 행성의 궤도</h2></div>
              <p className="activity-goal"><b>목표</b> 행성 이심률을 비교하고 거의 원처럼 보이는 궤도도 타원임을 이해합니다.</p>
              <p className="activity-instruction">행성을 바꾸어 이심률을 비교해 보세요. 가장 이심률이 큰 행성을 먼저 선택하고, 아래에 짧게 설명해 봅니다.</p>
              <fieldset className="answer-options planet-answer"><legend>이심률이 가장 큰 행성은 무엇인가요?</legend>{PLANET_ECCENTRICITIES.map((planet) => <label key={planet.id}><input type="radio" name="largest" checked={answer3 === planet.id} onChange={() => setAnswer3(planet.id)} /> {planet.name}</label>)}</fieldset>
              {answer3 !== null && <Feedback correct={answer3Correct}>{answer3Correct ? '수성의 궤도가 여덟 행성 중 가장 길쭉합니다.' : '행성 선택 메뉴의 이심률 값을 비교해 가장 큰 값을 찾아보세요.'}</Feedback>}
              <label className="reflection-field">왜 대부분 원에 가까워 보일까요? <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="이심률이 작을 때 두 초점과 궤도 모양이 어떻게 되는지 생각해 보세요." rows={2}/></label>
              <label className="reflection-field">관찰 기록 <textarea value={reflection3} onChange={(event) => setReflection3(event.target.value)} placeholder="지구와 화성 궤도의 공통점이나 차이를 적어 보세요." rows={2}/></label>
              <button className="next-step" disabled={answer3 === null || explanation.trim().length < 8} onClick={goNext}>마무리로 <span>→</span></button>
            </>}
            {!completed && step === 3 && <>
              <div className="activity-heading"><span>탐구 마무리</span><h2>관찰에서 법칙으로</h2></div>
              <p className="activity-goal"><b>정리</b> 앞에서 관찰한 타원과 태양의 위치를 케플러 제1법칙으로 연결합니다.</p>
              <div className="law-summary"><span>케플러 제1법칙</span><p>행성의 궤도는 타원이며, <b>태양은 타원의 두 초점 중 한 곳</b>에 위치합니다.</p><small>이심률이 0이면 두 초점이 중심에서 겹치는 원이 됩니다. 이 경우도 타원의 특수한 경우로 볼 수 있습니다.</small></div>
              <p className="summary-prompt">이 법칙을 자신의 말로 한 문장 설명한 뒤 완료를 누르세요.</p>
              <label className="reflection-field">나의 설명 <textarea value={finalExplanation} onChange={(event) => setFinalExplanation(event.target.value)} placeholder="행성의 궤도와 태양의 위치를 함께 설명해 보세요." rows={3}/></label>
              <button className="next-step" disabled={finalExplanation.trim().length < 8} onClick={() => setCompleted(true)}>탐구 완료 <span>✓</span></button>
            </>}
            {completed && <LessonCompletion title="1차시 탐구를 마쳤어요" introduction="이심률에 따른 궤도 모양을 살펴보고, 태양이 타원의 한 초점에 있음을 확인했습니다." summaryTitle="케플러 제1법칙" summary="행성의 궤도는 타원이며, 태양은 타원의 한 초점에 있습니다." detail="이심률이 0이면 두 초점은 중심에서 겹치며, 원은 타원의 한 경우입니다." nextLesson="다음 시간에는 행성이 태양 주위를 공전할 때 속력이 어떻게 달라지는지, 공전주기에는 어떤 규칙이 있는지 탐구합니다." onRestart={restartFromBeginning}/>}
          </section>
        </div>

        <aside className="teacher-strip"><b>조작 방법</b><p>이심률 손잡이를 끌어 궤도 모양을 바꾸세요. 실제 행성 모드에서는 행성 이름을 눌러 궤도를 비교합니다.</p>{!completed && <button onClick={restartFromBeginning}>처음부터 다시하기</button>}</aside>
      </section>
    </main>}
  </div>;
}

