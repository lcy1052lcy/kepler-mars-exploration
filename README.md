# 케플러 법칙으로 떠나는 화성 탐사

고등학생이 관찰과 탐구를 중심으로 케플러 법칙을 배우는 4차시 React + TypeScript 웹 애플리케이션입니다. 현재는 공통 학습 화면과 1차시 제1법칙 관찰 UI의 뼈대만 있습니다. 나머지 차시의 시뮬레이션은 아직 구현하지 않았습니다.

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

다음 단계는 `docs/PROJECT_BLUEPRINT.md`의 순서에 따라 제1법칙 시뮬레이션 구현과 물리 함수 자동 테스트를 추가하는 것입니다.
