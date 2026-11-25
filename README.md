# 케플러 법칙으로 떠나는 화성 탐사

고등학생이 관찰과 탐구를 중심으로 케플러 법칙을 배우는 React + TypeScript 웹 애플리케이션입니다. 정규 학습은 1~3차시로 구성되며, 실제 화성 탐사 자료를 다루는 선택형 심화 탐구를 별도로 제공합니다. 정규 학습과 심화 탐구 보고서를 각각 PDF로 저장할 수 있습니다.

## 시작하기

```bash
npm install
npm run dev
```

개발 서버가 출력하는 로컬 주소를 브라우저에서 엽니다. 프로덕션 빌드는 `npm run build`, 빌드 미리보기는 `npm run preview`입니다.

## 배포

저장소의 GitHub Pages 설정에서 배포 소스로 **GitHub Actions**를 선택합니다. `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 저장소 경로를 반영해 빌드·배포합니다. 수동 배포는 `npm run deploy`이며, 먼저 `npm install`이 필요합니다.

## 구조와 다음 단계

- `src/ui`: 공통 앱 셸과 디자인 시스템
- `src/content`: 차시 구성 데이터
- `src/physics`: UI 독립적인 SI 단위 궤도 계산 함수
- `docs/PROJECT_BLUEPRINT.md`: 구조, 물리 가정, 교육 콘텐츠 범위, 후속 개발 순서
- `PLAN.md`: 상세 차시별 교육 기획안

핵심 기능은 1~3차시의 법칙 탐구와 화성 전이 궤도 설계, 선택형 심화 탐구, 브라우저 저장 기록 기반 PDF 보고서입니다. `docs/PROGRESS.md`에서 현재 구현 상태와 검증 기록을 확인할 수 있습니다.
