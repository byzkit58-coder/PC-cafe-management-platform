![Playwright QA Portfolio](https://github.com/byzkit58-coder/PC-cafe-management-platform/actions/workflows/playwright.yml/badge.svg)
# PC방 매장 운영 플랫폼 QA 포트폴리오

## 1. 프로젝트 개요

이 프로젝트는 PC방 매장 운영 플랫폼을 가정한 QA 자동화 포트폴리오입니다. React mock 화면과 JSON 기반 mock API를 구성하고, 사용자-관리자 흐름과 주요 비즈니스 정책을 Playwright로 검증합니다. 실제 결제, 실제 DB, 실제 인증 서버는 사용하지 않고 테스트 가능한 mock 서비스로 요구사항을 재현했습니다. 자동화 대상은 좌석, 주문, 결제 실패, 쿠폰/포인트, 정산, 권한처럼 운영 리스크가 큰 흐름입니다.

핵심 문서:

- [서비스 개요](01_requirements/service_overview.md)
- [테스트 전략](02_test_design/test_strategy.md)
- [AI 생성 테스트케이스 검토](03_ai_testcase_generation/reviewed_test_cases.md)

## 2. 주요 검증 범위

- 로그인
- 좌석 선택
- 음식 주문
- 관리자 주문 처리
- 결제 실패 처리
- 쿠폰/포인트 복원
- 정산 반영
- 권한별 접근 제어
- 매장 간 데이터 접근 제한

## 3. 기술 스택

- React
- TypeScript
- Node.js
- Express
- JSON mock data
- Playwright
- GitHub Actions

## 4. 프로젝트 구조

```text
pc-cafe-qa-portfolio/
|-- 01_requirements/
|-- 02_test_design/
|-- 03_ai_testcase_generation/
|-- app/
|   |-- src/
|   |-- index.html
|   `-- package.json
|-- mock-api/
|   |-- data/
|   |   |-- seed.json
|   |   `-- db.json
|   |-- server.js
|   `-- package.json
|-- tests/
|   |-- e2e/
|   |-- api/
|   |-- pages/
|   |-- fixtures/
|   `-- utils/
|-- playwright.config.ts
|-- package.json
`-- .github/workflows/
```

## 5. 테스트 전략 요약

- 사용자와 관리자 화면이 연결되는 흐름은 E2E 테스트로 검증합니다.
- 결제, 정산, 쿠폰/포인트, 권한처럼 결과가 명확한 영역은 API 테스트로 검증합니다.
- 모든 테스트는 실행 전 `/api/test/reset`을 호출해 JSON seed 데이터 기준으로 초기화합니다.
- 전체 테스트는 GitHub Actions에서 실행할 수 있습니다.

## 6. 자동화 테스트 범위

### E2E 테스트

- 일반 사용자 로그인
- 좌석 선택
- 사용자 주문 후 관리자 주문 목록 반영
- 관리자 주문 완료 후 사용자 화면 반영
- 일반 사용자 관리자 페이지 접근 차단

### API 테스트

- 결제 실패 시 주문 상태 유지
- 결제 실패 주문 정산 미반영
- 중복 결제 방지
- 주문 취소 시 쿠폰 복원
- 주문 취소 시 포인트 복원
- 완료 주문만 정산 반영
- 일반 사용자 관리자 API 접근 차단
- 매장 A 관리자의 매장 B 주문 접근 차단

## 7. 실행 방법

```bash
npm run install:all
```

```bash
npm run dev:api
```

```bash
npm run dev:app
```

```bash
npm run test:e2e
```

```bash
npm run test:api
```

```bash
npm test
```

```bash
npm run report
```

## 8. CI

- GitHub Actions에서 Playwright 테스트를 실행합니다.
- push 또는 pull_request 시 실행됩니다.
- Playwright HTML Report를 artifact로 업로드합니다.
- workflow 파일: [.github/workflows/playwright.yml](.github/workflows/playwright.yml)

## 9. 포트폴리오 핵심 포인트

- 요구사항 기반 테스트 설계
- 리스크 기반 자동화 대상 선정
- AI 테스트케이스 생성 후 QA 리뷰
- Playwright E2E/API 테스트 분리
- GitHub Actions 기반 자동 실행
