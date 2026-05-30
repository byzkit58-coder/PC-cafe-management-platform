import { expect, test } from '@playwright/test';
import { users } from '../fixtures/users';
import { LoginPage } from '../pages/LoginPage';
import { resetTestData } from '../utils/reset';

test.beforeEach(async ({ request }) => {
  await resetTestData(request);
});

test('TC-PERM-001 일반 사용자 관리자 페이지 접근 차단', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login(users.user01.username, users.user01.password);
  await loginPage.expectCurrentUser(users.user01.displayName);
  await page.goto('/admin/orders');

  await expect(page.getByTestId('forbidden-message'), '일반 사용자가 관리자 URL에 직접 접근하면 forbidden-message가 보여야 합니다.').toBeVisible();
});
