# PC Cafe QA Portfolio

## 1. Project Overview

This project is a QA automation portfolio for a mock PC cafe store operation platform. It models customer login, seat usage, food ordering, payment, coupon, points, settlement, and role-based access control with a React mock app and a JSON-backed mock API.

The goal is not commercial product completeness. The goal is to show QA lead-level thinking: risk-based test selection, repeatable test data, clear automation boundaries, and CI reporting.

## 2. QA Portfolio Purpose

This portfolio demonstrates how to turn store-operation requirements into executable tests.

- User-to-admin workflows are verified with Playwright E2E tests.
- Deterministic business rules such as payment, settlement, coupon and points restoration, and permissions are verified with Playwright API tests.
- `/api/test/reset` restores `mock-api/data/db.json` from `seed.json` before each test, so tests can run independently.
- GitHub Actions runs the tests automatically and uploads the Playwright HTML report.

## 3. Tech Stack

- Frontend mock: React, Vite
- Mock API: Node.js, Express
- Test automation: Playwright Test
- Test data: JSON seed data and file-based `db.json`
- CI: GitHub Actions, Ubuntu, Node.js 20

## 4. Folder Structure

```text
pc-cafe-qa-portfolio/
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
`-- .github/workflows/playwright.yml
```

## 5. Service Scenario

- A user logs in and starts using an available seat.
- Only the user currently using a seat can create an order.
- A new order starts as `payment_pending`.
- Successful payment changes the order to `payment_completed`.
- A store manager processes the order through `accepted -> cooking -> completed`.
- The admin order list reflects orders created from the user screen.
- A normal user cannot access admin pages or admin APIs.
- Store A managers cannot access Store B orders or settlements.
- Settlement includes only `completed` orders.
- Canceling an order restores used coupons and points.

## 6. Test Strategy Summary

- E2E tests cover the critical connected flow between user screens and admin screens.
- API tests cover deterministic high-risk business rules without depending on UI timing.
- Every test resets data before execution through `/api/test/reset`.
- UI locators use `data-testid` where possible for stable automation.
- Page Object Model separates repeated UI actions from test intent.

## 7. Automation Scope

- Login success and failure
- Unauthenticated protected API access
- Seat selection
- Order creation from an active seat
- User order visibility in the admin order list
- Order status transitions
- User access blocking for admin pages and APIs
- Store-level permission isolation
- Failed payment status handling
- Duplicate payment blocking
- Coupon and points restoration on cancel
- Settlement based only on completed orders

## 8. E2E Test List

Current E2E test count: 5.

- `TC-AUTH-001 user login succeeds`
- `TC-SEAT-001 available seat can be started`
- `TC-ORDER-003 user order appears in admin order list`
- `TC-STATUS-003 manager completes order and user sees completed status`
- `TC-PERM-001 normal user is blocked from admin page`

## 9. API Test List

Current API test count: 8.

- `API-001 reset API restores seed seat state`
- `API-002 login failure returns 401`
- `API-003 unauthenticated request returns 401`
- `API-004 user cannot access admin orders API`
- `API-005 Store A manager cannot access Store B order or settlement`
- `API-006 failed payment keeps order status payment_pending`
- `API-007 duplicate payment for same order is blocked`
- `API-008 settlement includes completed orders only and cancel restores benefits`

## 10. How To Run

Install all dependencies:

```bash
npm run install:all
```

Run the mock API:

```bash
npm run dev:api
```

Run the mock app:

```bash
npm run dev:app
```

Run E2E tests:

```bash
npm run test:e2e
```

Run API tests:

```bash
npm run test:api
```

Run all tests:

```bash
npm test
```

Open the Playwright HTML report:

```bash
npm run report
```

## 11. CI Configuration

The GitHub Actions workflow is defined in [.github/workflows/playwright.yml](.github/workflows/playwright.yml).

It runs on `push` and `pull_request` for `main` and `master`.

CI steps:

1. Checkout repository
2. Setup Node.js 20
3. Run root `npm ci`
4. Run app `npm ci`
5. Run mock-api `npm ci`
6. Run `npx playwright install --with-deps`
7. Run `npx playwright test`
8. Upload `playwright-report` as an artifact

The report upload uses `if: always()`, so the HTML report is preserved even when tests fail.

## 12. Report Review

Local report:

```bash
npm run report
```

CI report:

- Open the GitHub Actions run.
- Download the `playwright-report` artifact.
- Open the HTML report locally.

## 13. Portfolio Strengths

- Shows risk-based QA automation, not only happy-path UI checks.
- Separates E2E tests and API tests by responsibility.
- Uses a deterministic reset endpoint for repeatable test execution.
- Applies Page Object Model for maintainable UI automation.
- Automates high-risk areas: payment failure, duplicate payment, settlement filtering, coupon and points restoration, and role/store permissions.
- Provides CI execution and HTML reporting suitable for review by hiring managers or QA leads.

## 14. Future Improvements

- Add more API tests for every invalid order status transition.
- Add stock decrement and sold-out menu edge cases to API coverage.
- Add an hq_admin-specific settlement aggregation test.
- Add Docker Compose for standardized local execution.
- Add PR comments summarizing test results and linking the report artifact.
