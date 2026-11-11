export type Lesson = {
  id: number;
  title: string;
  question: string;
  concept: string;
  duration: string;
  status: 'ready' | 'planned';
  outcome: string;
};

export const lessons: Lesson[] = [
  { id: 1, title: '행성은 어떤 궤도를 따라 움직일까?', question: '궤도가 더 길쭉해지면 태양의 위치는 어떻게 보일까?', concept: '케플러 제1법칙 · 타원 궤도', duration: '50분', status: 'ready', outcome: '이심률을 바꾸어 궤도 모양과 초점의 위치를 관찰해요.' },
  { id: 2, title: '행성의 속도와 공전주기에는 어떤 규칙이 있을까?', question: '태양에 가까운 행성은 같은 시간 동안 얼마나 움직일까?', concept: '케플러 제2·3법칙 · 면적과 주기', duration: '50분', status: 'planned', outcome: '같은 시간의 면적과 궤도 크기·주기 자료를 비교해요.' },
  { id: 3, title: '케플러 법칙으로 화성 탐사선의 궤도를 설계할 수 있을까?', question: '지구에서 화성까지 가는 가장 단순한 경로는 무엇일까?', concept: '호만 전이 · 이동 시간', duration: '50분', status: 'planned', outcome: '이상적인 전이 궤도와 도착까지 걸리는 시간을 분석해요.' },
  { id: 4, title: '실제 화성 탐사선도 같은 궤도를 따라 이동할까?', question: '실제 탐사선의 비행 시간은 왜 계산과 다를까?', concept: '실제 임무 자료 · 모델의 한계', duration: '50분', status: 'planned', outcome: '퍼서비어런스 자료를 이상화한 모델과 비교해요.' },
];
