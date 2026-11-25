import { useMemo, useState } from 'react';
import { PLANET_ORBIT_DATA, PLANET_ORBIT_DATA_SOURCE } from '../content/planetOrbitData';
import { PLANET_ECCENTRICITIES, PLANET_ECCENTRICITY_SOURCE } from '../content/planetEccentricities';
import { ASTRONOMICAL_UNIT_M, SECONDS_PER_DAY, SOLAR_MU_M3_S2, ellipseGeometry, ellipseFromApsisDistancesAU, evaluateMarsEncounter, orbitalPeriodSeconds, outboundCircleCrossing, stateAtTime, stateAtTrueAnomaly, sweptAreaBetweenTimes } from '../physics';
import { flushLessonStoredState, isStringRecord, readLessonStoredSnapshot, useLessonStoredState } from './lessonProgress';
import './student-reports.css';
import './report-overrides.css';

export type StudentReportKind = 'regular' | 'advanced';
type StudentIdentity = { school: string; grade: string; classNumber: string; studentNumber: string; name: string };
type Snapshots = Record<'1' | '2' | '3' | '4', Record<string, unknown>>;
const EMPTY_IDENTITY: StudentIdentity = { school: '', grade: '', classNumber: '', studentNumber: '', name: '' };
const validIdentity = isStringRecord(['school', 'grade', 'classNumber', 'studentNumber', 'name'] as const);
const readSnapshots = (): Snapshots => ({ '1': readLessonStoredSnapshot('1'), '2': readLessonStoredSnapshot('2'), '3': readLessonStoredSnapshot('3'), '4': readLessonStoredSnapshot('4') });
const value = (data: Record<string, unknown>, key: string): unknown => data[key];
const text = (data: Record<string, unknown>, key: string): string => typeof data[key] === 'string' && String(data[key]).trim() ? String(data[key]) : '미작성';
const number = (data: Record<string, unknown>, key: string): number | null => typeof data[key] === 'number' && Number.isFinite(data[key]) ? data[key] as number : null;
const option = (input: unknown, values: Record<string, string>): string => typeof input === 'string' ? values[input] ?? '미작성' : '미작성';
const hasAnyRecord = (data: Record<string, unknown>): boolean => Object.keys(data).length > 0;
const safeFilename = (input: string): string => input.trim().replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
const dayText = (seconds: number): string => `${(seconds / SECONDS_PER_DAY).toFixed(1)}일`;

function Answer({ question, answer }: { question: string; answer: unknown }) {
  return <div className="sr-answer"><b>{question}</b><p>{typeof answer === 'string' && answer.trim() ? answer : '미작성'}</p></div>;
}

function OrbitFigure({ eccentricity, title }: { eccentricity: number; title: string }) {
  const e = Math.max(0, Math.min(0.95, eccentricity));
  const geometry = ellipseGeometry(1, e);
  const scale = 95, cx = 150, cy = 105, rx = scale, ry = geometry.semiMinorAxis * scale, focus = geometry.focusDistance * scale;
  return <figure className="sr-figure"><svg viewBox="0 0 300 210" role="img" aria-label={`${title}, 이심률 ${e.toFixed(3)} 궤도와 초점`}><line x1="30" y1={cy} x2="270" y2={cy} stroke="#aebdca" strokeDasharray="4 4"/><ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#edf4f5" stroke="#277f77" strokeWidth="2.5"/><circle cx={cx - focus} cy={cy} r="7" fill="#f4b844" stroke="#8a6426"/><circle cx={cx + focus} cy={cy} r="5" fill="#fff" stroke="#536779" strokeWidth="2"/><circle cx={cx} cy={cy} r="3" fill="#25384d"/><text x={cx - focus} y={cy - 12} textAnchor="middle">태양·초점</text><text x={cx + focus} y={cy + 20} textAnchor="middle">다른 초점</text><text x="150" y="196" textAnchor="middle">중심 · e={e.toFixed(3)}</text></svg><figcaption>{title} · a=1.000 AU로 정규화한 학생 설정 도식</figcaption></figure>;
}

function OrbitSpeedGraph({ eccentricity, title }: { eccentricity: number; title: string }) {
  const e = Math.max(0, Math.min(0.95, eccentricity));
  const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity: e, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
  const points = Array.from({ length: 121 }, (_, index) => stateAtTrueAnomaly(orbit, index / 120 * Math.PI * 2).speedMS / 1000);
  const min = Math.min(...points), max = Math.max(...points), x = (i: number) => 43 + i / (points.length - 1) * 410, y = (v: number) => 148 - (v - min) / Math.max(max - min, 0.001) * 104;
  const path = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return <figure className="sr-figure"><svg viewBox="0 0 500 195" role="img" aria-label={`${title}, 궤도 위치에 따른 태양 중심 속력 그래프`}><line x1="43" y1="148" x2="460" y2="148" stroke="#65758a"/><line x1="43" y1="34" x2="43" y2="148" stroke="#65758a"/><path d={path} fill="none" stroke="#16857d" strokeWidth="3"/><text x="43" y="174">근일점</text><text x="460" y="174" textAnchor="end">원일점 통과 후</text><text x="44" y="23">속력 (km/s)</text><text x="250" y="190" textAnchor="middle">궤도 위치에 따른 태양 중심 속력</text><text x="54" y="48">빠름</text><text x="54" y="141">느림</text></svg><figcaption>{title} · 저장된 이심률 {e.toFixed(3)}의 두 천체 모형 계산</figcaption></figure>;
}

function PlanetGraphs() {
  const points = PLANET_ORBIT_DATA.map((planet) => ({ name: planet.name, a: planet.meanSunDistanceMillionKm / 149.5978707, p: planet.orbitalPeriodDays / 365.25 }));
  const Scatter = ({ squared }: { squared: boolean }) => {
    const pairs = points.map((item) => ({ ...item, x: squared ? item.a ** 3 : item.a, y: squared ? item.p ** 2 : item.p }));
    const maxX = Math.max(...pairs.map((p) => p.x)), maxY = Math.max(...pairs.map((p) => p.y));
    const sx = (v: number) => 42 + v / maxX * 400, sy = (v: number) => 148 - v / maxY * 108;
    return <svg viewBox="0 0 500 190" role="img" aria-label={squared ? '긴반지름 세제곱과 공전주기 제곱 그래프' : '긴반지름과 공전주기 그래프'}><line x1="42" y1="148" x2="460" y2="148" stroke="#66758a"/><line x1="42" y1="32" x2="42" y2="148" stroke="#66758a"/>{pairs.map((p) => <g key={p.name}><circle cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="#167f78"/><text x={sx(p.x) + 6} y={sy(p.y) - 5}>{p.name}</text></g>)}<text x="250" y="181" textAnchor="middle">{squared ? '긴반지름 세제곱 a³ (AU³)' : '긴반지름 a (AU)'}</text><text transform="translate(14 98) rotate(-90)" textAnchor="middle">{squared ? '공전주기 제곱 P² (년²)' : '공전주기 P (년)'}</text></svg>;
  };
  return <div className="sr-graphs"><figure className="sr-figure"><Scatter squared={false}/><figcaption>P-a 관계 · 일반 눈금, 실제 행성 자료</figcaption></figure><figure className="sr-figure"><Scatter squared/><figcaption>P²-a³ 관계 · 일반 눈금</figcaption></figure></div>;
}

function SectorCompare({ eccentricity, selected }: { eccentricity: number; selected: unknown }) {
  if (!Array.isArray(selected) || selected.length < 2 || !selected.slice(0, 2).every((i) => Number.isInteger(i) && i >= 0 && i < 12)) return <p className="sr-muted">저장된 두 영역 선택이 없습니다.</p>;
  const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
  const period = orbitalPeriodSeconds(orbit), interval = period / 12, indices = selected.slice(0, 2) as number[];
  const area = (index: number) => sweptAreaBetweenTimes(orbit, index * interval, (index + 1) * interval) / ASTRONOMICAL_UNIT_M ** 2;
  const sectorPath = (index: number) => {
    const points = Array.from({ length: 37 }, (_, pointIndex) => {
      const state = stateAtTime(orbit, (index + pointIndex / 36) * interval);
      return `${100 + state.positionXM / ASTRONOMICAL_UNIT_M * 38},${82 - state.positionYM / ASTRONOMICAL_UNIT_M * 38}`;
    });
    return `M 100 82 L ${points.join(' L ')} Z`;
  };
  const orbitPath = Array.from({ length: 121 }, (_, i) => {
    const state = stateAtTrueAnomaly(orbit, i / 120 * Math.PI * 2);
    return `${i ? 'L' : 'M'}${100 + state.positionXM / ASTRONOMICAL_UNIT_M * 38},${82 - state.positionYM / ASTRONOMICAL_UNIT_M * 38}`;
  }).join(' ') + ' Z';
  return <div className="sr-area-compare"><div className="sr-area-shapes">{indices.map((index, slot) => <figure className="sr-figure" key={index}><svg viewBox="0 0 200 120" role="img" aria-label={`${index + 1}번 저장 영역의 부채꼴 모양`}><path d={orbitPath} fill="none" stroke="#9aa8b6" strokeDasharray="3 3"/><path d={sectorPath(index)} fill={slot ? '#e58c55' : '#25887f'} fillOpacity=".72" stroke={slot ? '#b45a30' : '#116960'} strokeWidth="1.5"/><circle cx="100" cy="82" r="2.5" fill="#e1a93c"/></svg><figcaption>{index + 1}번 영역의 실제 부채꼴</figcaption></figure>)}</div><div className="sr-area-bars">{indices.map((index) => <div key={index}><span>{index + 1}번 영역 · {index < 2 ? '근일점 쪽' : index > 5 && index < 8 ? '원일점 쪽' : '궤도 구간'}</span><i style={{ width: '100%' }}/><b>{area(index).toFixed(5)} AU²</b></div>)}</div><p>각 구간은 공전주기의 1/12에 해당하는 같은 시간입니다. 면적은 저장된 이심률에서 계산했습니다.</p></div>;
}

function TransferFigure({ periAU, apoAU, phaseDegs = [0] }: { periAU: number; apoAU: number; phaseDegs?: number[] }) {
  const model = ellipseFromApsisDistancesAU(periAU, apoAU);
  const crossing = outboundCircleCrossing(model, 1.524);
  const elapsed = crossing?.elapsedSeconds ?? model.periodSeconds / 2;
  const scale = 105 / Math.max(1.7, apoAU, 1.524), cx = 190, cy = 126;
  const ellipse = Array.from({ length: 181 }, (_, index) => {
    const point = stateAtTrueAnomaly(model.orbit, index / 180 * 2 * Math.PI);
    return `${index ? 'L' : 'M'}${cx + point.positionXM / ASTRONOMICAL_UNIT_M * scale},${cy - point.positionYM / ASTRONOMICAL_UNIT_M * scale}`;
  }).join(' ') + ' Z';
  return <figure className="sr-figure"><svg viewBox="0 0 380 255" role="img" aria-label="학생 설정 전이 타원과 출발·도착 위치"><circle cx={cx} cy={cy} r={scale} fill="none" stroke="#4384c6" strokeDasharray="5 4"/><circle cx={cx} cy={cy} r={1.524 * scale} fill="none" stroke="#db9870" strokeDasharray="5 4"/><path d={ellipse} fill="none" stroke="#16857d" strokeWidth="2.5"/><circle cx={cx} cy={cy} r="5" fill="#f4b844"/><circle cx={cx + periAU * scale} cy={cy} r="5" fill="#4384c6"/><circle cx={cx - apoAU * scale} cy={cy} r="5" fill="#db7548"/><text x={cx - 4} y={cy - 10} textAnchor="end">태양</text><text x={cx + periAU * scale} y={cy - 10} textAnchor="middle">근일점</text><text x={cx - apoAU * scale} y={cy - 10} textAnchor="middle">원일점</text>{phaseDegs.map((phase, index) => { const result = evaluateMarsEncounter(model, phase * Math.PI / 180); const t = result.crossing?.elapsedSeconds ?? elapsed; const p = stateAtTime(model.orbit, t); const mAngle = phase * Math.PI / 180 + t / (686.98 * SECONDS_PER_DAY) * 2 * Math.PI; return <g key={`${phase}-${index}`}><circle cx={cx + p.positionXM / ASTRONOMICAL_UNIT_M * scale} cy={cy - p.positionYM / ASTRONOMICAL_UNIT_M * scale} r="7" fill="#fff" stroke="#087f78" strokeWidth="3"/><circle cx={cx + 1.524 * Math.cos(mAngle) * scale} cy={cy - 1.524 * Math.sin(mAngle) * scale} r="6" fill="#ef8859" stroke="#fff" strokeWidth="1.5"/><text x="20" y={230 + index * 15}>{phase}° · 거리 {result.separationAU === null ? '궤도 미교차' : `${result.separationAU.toFixed(4)} AU`}</text></g>; })}<text x="18" y="20">청록: 전이 궤도 · 흰 원: 탐사선 · 주황: 화성</text></svg><figcaption>궤도·위치는 저장된 학생 설계와 화성 초기 위상에서 재계산</figcaption></figure>;
}

function RegularReport({ snapshots, identity }: { snapshots: Snapshots; identity: StudentIdentity }) {
  const l1 = snapshots['1'], l2 = snapshots['2'], l3 = snapshots['3'];
  const e1 = number(l1, 'eccentricity');
  const e2 = number(l2, 'demoEccentricity');
  const peri = number(l3, 'periapsisAU'), apo = number(l3, 'confirmedApoapsisAU') ?? number(l3, 'apoapsisAU');
  const validTransfer = peri !== null && apo !== null && apo > peri;
  const model = validTransfer ? ellipseFromApsisDistancesAU(peri, apo) : null;
  return <article className="sr-paper"><header className="sr-title"><p>케플러 법칙으로 떠나는 화성 탐사</p><h1>정규 학습 탐구 보고서</h1><IdentityPrintBlock identity={identity}/><p>작성일 · {new Date().toLocaleDateString('ko-KR')}</p></header>
    <section className="sr-lesson">
      <h2>1차시 · 케플러 제1법칙</h2>
      <p>설정 이심률: 개념 관찰 {e1 === null ? '미제출' : e1.toFixed(2)} · 초점 관찰 {number(l1, 'focusEccentricity')?.toFixed(2) ?? '미제출'}</p>
      {e1 !== null && <OrbitFigure eccentricity={e1} title="학생 설정 타원과 초점"/>}
      {number(l1, 'focusEccentricity') !== null && number(l1, 'focusEccentricity') !== e1 && <OrbitFigure eccentricity={number(l1, 'focusEccentricity')!} title="초점 관찰 단계 설정 타원"/>}
      <h3>실제 행성 이심률 비교 자료</h3>
      <table><thead><tr><th>행성</th><th>이심률</th></tr></thead><tbody>{PLANET_ECCENTRICITIES.map((planet) => <tr key={planet.id}><td>{planet.name}</td><td>{planet.eccentricity.toFixed(4)}</td></tr>)}</tbody></table>
      <small>자료: <a href={PLANET_ECCENTRICITY_SOURCE.url}>{PLANET_ECCENTRICITY_SOURCE.label}</a>. 대표값이며, 지구 이심률 기준의 환산 자료입니다.</small>
      <Answer question="이심률이 커질수록 궤도는 어떻게 보이나요?" answer={option(value(l1, 'answer1'), { circle: '원에 더 가까워진다', ellipse: '더 길쭉한 타원이 된다' })}/>
      <Answer question="태양은 타원의 어디에 있나요?" answer={option(value(l1, 'answer2'), { center: '타원의 중심', left: '한 초점', right: '한 초점', orbit: '궤도 위' })}/>
      <Answer question="이심률이 가장 큰 행성은?" answer={option(value(l1, 'answer3'), Object.fromEntries(PLANET_ECCENTRICITIES.map((planet) => [planet.id, planet.name])))}/>
      <Answer question="대부분의 행성 궤도가 원에 가까워 보이는 이유" answer={value(l1, 'explanation')}/>
      <Answer question="탐구 1 관찰 기록" answer={value(l1, 'reflection1')}/>
      <Answer question="탐구 2 관찰 기록" answer={value(l1, 'reflection2')}/>
      <Answer question="탐구 3 관찰 기록" answer={value(l1, 'reflection3')}/>
      <Answer question="나의 최종 설명" answer={value(l1, 'finalExplanation')}/>
    </section>
    <section className="sr-lesson">
      <h2>2차시 · 케플러 제2·3법칙</h2>
      <p>교육용 궤도 이심률: {e2 === null ? '미제출' : e2.toFixed(2)}{e2 !== null && <span> · 선택 구간 {Array.isArray(value(l2, 'selectedSegments')) ? (value(l2, 'selectedSegments') as number[]).map((i) => i + 1).join('번, ') + '번' : '미선택'}</span>}</p>
      {e2 !== null && <><SectorCompare eccentricity={e2} selected={value(l2, 'selectedSegments')}/><OrbitSpeedGraph eccentricity={e2} title="제2법칙 속력 관찰"/></>}
      <h3>행성 긴반지름·공전주기 자료</h3>
      <table><thead><tr><th>행성</th><th>a (AU)</th><th>P (년)</th></tr></thead><tbody>{PLANET_ORBIT_DATA.map((planet) => <tr key={planet.id}><td>{planet.name}</td><td>{(planet.meanSunDistanceMillionKm / 149.5978707).toFixed(3)}</td><td>{(planet.orbitalPeriodDays / 365.25).toFixed(3)}</td></tr>)}</tbody></table>
      <small>자료: <a href={PLANET_ORBIT_DATA_SOURCE.url}>{PLANET_ORBIT_DATA_SOURCE.label}</a> · {PLANET_ORBIT_DATA_SOURCE.note}</small>
      <PlanetGraphs/>
      <Answer question="도입 예상: 행성의 속도는 늘 같을까요?" answer={option(value(l2, 'prediction'), { constant: '거의 일정할 것 같다', changes: '거리에 따라 달라질 것 같다', unsure: '잘 모르겠다' })}/>
      <Answer question="예상한 까닭" answer={(value(l2, 'notes') as Record<string, unknown> | undefined)?.prediction}/>
      <Answer question="선택한 두 영역의 면적 관계" answer={option(value(l2, 'areaAnswer'), { same: '같다', different: '다르다' })}/>
      <Answer question="면적 비교 관찰 기록" answer={(value(l2, 'notes') as Record<string, unknown> | undefined)?.area}/>
      <Answer question="근일점과 원일점 중 더 빠른 곳" answer={option(value(l2, 'speedAnswer'), { 'near-faster': '근일점 부근', 'far-faster': '원일점 부근', same: '속력이 같다' })}/>
      <Answer question="속도 비교 관찰 기록" answer={(value(l2, 'notes') as Record<string, unknown> | undefined)?.speed}/>
      <Answer question="P와 a 그래프에서 관찰한 관계" answer={option(value(l2, 'periodAnswer'), { proportional: '정비례에 가깝다', nonlinear: '비선형 관계다' })}/>
      <Answer question="P²과 a³에서 발견한 규칙" answer={value(l2, 'thirdAnswer')}/>
      <Answer question="행성 자료 관찰 기록" answer={(value(l2, 'notes') as Record<string, unknown> | undefined)?.third}/>
      <Answer question="오늘의 한 줄 정리" answer={(value(l2, 'notes') as Record<string, unknown> | undefined)?.summary}/>
    </section>
    <section className="sr-lesson"><h2>3차시 · 화성 탐사선 궤도 설계</h2><p>학생 설정 근일점 {peri?.toFixed(3) ?? '미제출'} AU · 원일점 {apo?.toFixed(3) ?? '미제출'} AU</p>{validTransfer && model && <><TransferFigure periAU={peri} apoAU={apo}/><div className="sr-values"><span>긴반지름(학생 제출)<b>{text(l3, 'calcA')} AU</b></span><span>전체 주기(학생 제출)<b>{text(l3, 'calcPeriod')} 년</b></span><span>절반 이동(학생 제출)<b>{text(l3, 'calcDays')} 일</b></span><span>모형 계산 참고값<b>{model.semiMajorAxisAU.toFixed(3)} AU · {(model.periodSeconds / (365.25 * SECONDS_PER_DAY)).toFixed(3)}년 · {dayText(model.periodSeconds / 2)}</b></span></div><OrbitSpeedGraph eccentricity={model.eccentricity} title="전이 궤도 태양 중심 속력"/></>}<Answer question="처음 예상한 탐사선 경로" answer={option(value(l3, 'prediction'), { line: '직선 경로', circle: '원형 경로', ellipse: '태양을 한 초점으로 하는 타원형 경로', other: '다른 경로 또는 잘 모르겠음' })}/><Answer question="처음 예상한 이유" answer={(value(l3, 'notes') as Record<string, unknown> | undefined)?.prediction}/><Answer question="전이 타원 구성 관찰" answer={(value(l3, 'notes') as Record<string, unknown> | undefined)?.construction}/><Answer question="탐사선 속도 관찰" answer={(value(l3, 'notes') as Record<string, unknown> | undefined)?.motion}/><Answer question="긴반지름·주기·이동 시간 계산 설명" answer={(value(l3, 'notes') as Record<string, unknown> | undefined)?.calculation}/><Answer question="예상과 계산 결과 비교" answer={(value(l3, 'notes') as Record<string, unknown> | undefined)?.comparison}/><Answer question="법칙 연결 응답" answer={['first', 'second', 'third'].map((key) => option((value(l3, 'summary') as Record<string, unknown> | undefined)?.[key], { '1': '제1법칙', '2': '제2법칙', '3': '제3법칙' })).join(' · ')}/><Answer question="탐사선이 화성 궤도에 도착하면 반드시 만날까요?" answer={(value(l3, 'notes') as Record<string, unknown> | undefined)?.arrival}/><Answer question="오늘의 한 줄 정리" answer={(value(l3, 'notes') as Record<string, unknown> | undefined)?.summary}/></section>
    <footer className="sr-footer">학생의 브라우저 저장 기록과 표시된 천문 데이터 자료를 바탕으로 생성했습니다. 비어 있는 답변은 미작성으로 표시했습니다.</footer>
  </article>;
}

function AdvancedReport({ snapshots, identity }: { snapshots: Snapshots; identity: StudentIdentity }) {
  const l3 = snapshots['3'], l4 = snapshots['4'];
  const peri = number(l3, 'periapsisAU'), apo = number(l3, 'confirmedApoapsisAU') ?? number(l3, 'apoapsisAU');
  const validTransfer = peri !== null && apo !== null && apo > peri;
  const model = validTransfer ? ellipseFromApsisDistancesAU(peri, apo) : null;
  const phases = [number(l4, 'initialPhase'), number(l4, 'marsStartPhaseDeg')].filter((v): v is number => v !== null);
  const firstResult = validTransfer && phases.length > 0 && model ? evaluateMarsEncounter(model, phases[0] * Math.PI / 180) : null;
  const currentResult = validTransfer && phases.length > 1 && model ? evaluateMarsEncounter(model, phases[1] * Math.PI / 180) : null;
  const status = (s: string) => s === 'same-position' ? '슬라이더 해상도 내 근접 정렬' : s === 'different-position' ? '궤도는 교차하나 위치 불일치' : s === 'no-orbit-crossing' ? '화성 궤도 미교차' : '미실행';
  return <article className="sr-paper"><header className="sr-title"><p>케플러 법칙으로 떠나는 화성 탐사</p><h1>선택형 심화 탐구 보고서</h1><IdentityPrintBlock identity={identity}/><p>작성일 · {new Date().toLocaleDateString('ko-KR')}</p></header>
    <section className="sr-lesson"><h2>탐사선과 화성의 위치 관계 탐구</h2><p>학생 설정 궤도: 근일점 {peri?.toFixed(3) ?? '미제출'} AU · 원일점 {apo?.toFixed(3) ?? '미제출'} AU</p>{validTransfer && model && <TransferFigure periAU={peri} apoAU={apo} phaseDegs={phases}/>}<table><thead><tr><th>관찰 조건</th><th>화성 시작 위치</th><th>저장 결과</th><th>도착 위치 간 거리</th></tr></thead><tbody><tr><td>최초 실행</td><td>{phases[0] === undefined ? '미실행' : `${phases[0]}°`}</td><td>{status(String(value(l4, 'initialResult') ?? ''))}</td><td>{firstResult?.separationAU === null || !firstResult ? '궤도 미교차/미실행' : `${firstResult.separationAU.toFixed(4)} AU`}</td></tr><tr><td>조건 변경 후</td><td>{phases[1] === undefined ? '미실행' : `${phases[1]}°`}</td><td>{status(String(value(l4, 'currentResult') ?? ''))}</td><td>{currentResult?.separationAU === null || !currentResult ? '궤도 미교차/미실행' : `${currentResult.separationAU.toFixed(4)} AU`}</td></tr></tbody></table><Answer question="도입 예상" answer={option(value(l4, 'introEncounterPrediction'), { meet: '만날 수 있을 것이다', miss: '만나지 못할 것이다', unsure: '잘 모르겠다' })}/><Answer question="예상 이유" answer={value(l4, 'introEncounterReason')}/><Answer question="첫 결과와 예상 비교" answer={option(value(l4, 'observedPrediction'), { yes: '예상과 관찰 결과가 같았다', no: '예상과 관찰 결과가 달랐다' })}/><Answer question="위치 변경 후 관찰 기록" answer={value(l4, 'encounterNotes')}/><Answer question="화성의 공전주기와 위치 변화 설명" answer={value(l4, 'periodNotes')}/></section>
    <section className="sr-lesson"><h2>실제 화성 탐사 사례 비교</h2><div className="sr-values"><span>3차시 제출 이동 시간<b>{text(l3, 'calcDays')}일</b></span><span>모형 계산 참고값<b>{model ? dayText(model.periodSeconds / 2) : '미계산'}</b></span><span>퍼서비어런스 실제 비행 기간<b>약 203일</b></span></div><p>발사일 · 2020년 7월 30일 · 화성 착륙일 · 2021년 2월 18일</p><p className="sr-source">출처: <a href="https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/">NASA/JPL Mars 2020 Mission Press Kit</a></p><Answer question="이론적 이동 시간과 실제 비행 기간 차이(학생 입력)" answer={value(l4, 'dayDifferenceAnswer') === undefined ? undefined : `${String(value(l4, 'dayDifferenceAnswer'))}일`}/><Answer question="실제 기록과 이상 모형의 조건은 같은가요?" answer={option(value(l4, 'actualSameConditions'), { same: '같다', different: '다르다' })}/><Answer question="두 시간이 다를 수 있는 이유" answer={value(l4, 'actualReason')}/><Answer question="종합 탐구 정리" answer={value(l4, 'summary')}/><p className="sr-note">모형은 원형·동일 평면 행성 궤도와 태양 중심 전이를 가정합니다. 실제 임무에는 발사 시점, 실제 행성 위치, 경로와 도착 조건이 반영됩니다.</p></section><footer className="sr-footer">학생이 저장한 설정과 답변을 사용했습니다. 결과가 저장되지 않은 항목은 미작성 또는 미실행으로 표시합니다.</footer>
  </article>;
}

function IdentityPrintBlock({ identity }: { identity: StudentIdentity }) {
  const rows = [['학교', identity.school], ['학년', identity.grade], ['반', identity.classNumber], ['번호', identity.studentNumber], ['이름', identity.name]] as const;
  return <dl className="sr-identity-print">{rows.map(([key, val]) => <div key={key}><dt>{key}</dt><dd>{val.trim() || '미입력'}</dd></div>)}</dl>;
}

export function StudentReportManager({ initialKind, onClose }: { initialKind: StudentReportKind | null; onClose: () => void }) {
  const [kind, setKind] = useState<StudentReportKind | null>(initialKind);
  const [identity, setIdentity] = useLessonStoredState<StudentIdentity>('app', 'studentReportIdentity', EMPTY_IDENTITY, validIdentity);
  const [snapshots, setSnapshots] = useState<Snapshots>(() => readSnapshots());
  const regularReady = ['1', '2', '3'].some((lessonId) => hasAnyRecord(snapshots[lessonId as '1' | '2' | '3']));
  const advancedReady = hasAnyRecord(snapshots['4']);
  const filename = useMemo(() => {
    const student = [identity.grade && `${identity.grade}학년`, identity.classNumber && `${identity.classNumber}반`, identity.studentNumber, identity.name].filter(Boolean).join('_');
    return `케플러법칙_${kind === 'advanced' ? '심화탐구보고서' : '정규학습보고서'}${student ? `_${safeFilename(student)}` : ''}.pdf`;
  }, [identity, kind]);
  function printReport() {
    flushLessonStoredState(['app', '1', '2', '3', '4']);
    setSnapshots(readSnapshots());
    const priorTitle = document.title;
    document.title = filename.replace(/\.pdf$/, '');
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => { document.title = priorTitle; }, 1000);
    }, 60);
  }
  if (!kind) return <div className="sr-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="sr-dialog sr-chooser" role="dialog" aria-modal="true" aria-labelledby="sr-dialog-title"><button className="sr-close" onClick={onClose} aria-label="닫기">×</button><h2 id="sr-dialog-title">탐구 보고서 저장</h2><p>보고서에 사용할 학생 정보를 입력할 수 있습니다. 정보와 학습 기록은 이 브라우저에만 저장됩니다.</p><div className="sr-kind-list"><button disabled={!regularReady} onClick={() => setKind('regular')}><b>정규 학습 탐구 보고서</b><span>1~3차시 기록 통합 · {regularReady ? '저장 가능' : '학습 기록 없음'}</span></button><button disabled={!advancedReady} onClick={() => setKind('advanced')}><b>선택형 심화 탐구 보고서</b><span>심화 탐구 기록 별도 저장 · {advancedReady ? '저장 가능' : '학습 기록 없음'}</span></button></div><p className="sr-private-note">학생 정보는 외부 서버로 전송되지 않습니다. 두 보고서는 각각 독립적으로 생성됩니다.</p></section></div>;
  const record = kind === 'regular' ? regularReady : advancedReady;
  return <div className="sr-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="sr-dialog" role="dialog" aria-modal="true" aria-labelledby="sr-dialog-title"><div className="sr-dialog-head"><div><h2 id="sr-dialog-title">{kind === 'regular' ? '정규 학습 탐구 보고서' : '선택형 심화 탐구 보고서'}</h2><p>학생 정보를 확인하고 미리보기에서 PDF로 저장하세요.</p></div><button className="sr-close" onClick={onClose} aria-label="닫기">×</button></div><div className="sr-editor"><h3>학생 정보 <small>선택 입력 · 자동 저장</small></h3><div className="sr-fields">{([['school', '학교'], ['grade', '학년'], ['classNumber', '반'], ['studentNumber', '번호'], ['name', '이름']] as const).map(([key, label]) => <label key={key}>{label}<input value={identity[key]} onChange={(event) => setIdentity({ ...identity, [key]: event.target.value })}/></label>)}</div><p>저장 파일명 예시: <b>{filename}</b></p><div className="sr-actions"><button onClick={() => setKind(null)}>보고서 종류 선택</button><button className="sr-save" disabled={!record} onClick={printReport}>인쇄 미리보기 · PDF 저장</button></div></div><div className="sr-preview-label">보고서 미리보기</div><div className="sr-preview">{kind === 'regular' ? <RegularReport snapshots={snapshots} identity={identity}/> : <AdvancedReport snapshots={snapshots} identity={identity}/>}</div></section><div className="sr-print-root">{kind === 'regular' ? <RegularReport snapshots={snapshots} identity={identity}/> : <AdvancedReport snapshots={snapshots} identity={identity}/>}</div></div>;
}
