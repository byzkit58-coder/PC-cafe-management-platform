import { test } from "@playwright/test";
import { users } from "../fixtures/users";
import { LoginPage } from "../pages/LoginPage";
import { SeatPage } from "../pages/SeatPage";
import { resetTestData } from "../utils/reset";

test.beforeEach(async ({ request }) => {
  await resetTestData(request);
});

test("TC-AUTH-001 일반 사용자 로그인 성공", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const seatPage = new SeatPage(page);

  await loginPage.goto();
  await loginPage.login(users.user01.username, users.user01.password);

  await seatPage.expectLoaded();
  await loginPage.expectCurrentUser(users.user01.displayName);
});
