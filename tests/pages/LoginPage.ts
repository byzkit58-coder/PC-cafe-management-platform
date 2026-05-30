import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/');
    await expect(this.page.getByTestId('login-submit'), '로그인 버튼이 보여야 합니다.').toBeVisible();
  }

  async login(username: string, password: string) {
    await this.page.getByTestId('login-username').fill(username);
    await this.page.getByTestId('login-password').fill(password);
    await this.page.getByTestId('login-submit').click();
  }

  async expectCurrentUser(displayName: string) {
    await expect(this.page.getByTestId('current-user-name'), `현재 로그인 사용자가 ${displayName}이어야 합니다.`).toHaveText(
      displayName
    );
  }

  async logout() {
    await this.page.getByTestId('logout-button').click();
    await expect(this.page.getByTestId('login-submit'), '로그아웃 후 로그인 화면으로 돌아와야 합니다.').toBeVisible();
  }
}
