import { expect, type Page } from '@playwright/test';

export class SeatPage {
  constructor(private readonly page: Page) {}

  async expectLoaded() {
    await expect(this.page.getByTestId('seat-page'), '로그인 후 좌석 화면이 표시되어야 합니다.').toBeVisible();
  }

  async startSeatA01() {
    await this.page.getByTestId('seat-start-seatA01').click();
  }

  async expectSeatA01InUse() {
    await expect(
      this.page.getByTestId('seat-start-message'),
      '좌석 시작 후 A-01 사용 중 메시지가 표시되어야 합니다.'
    ).toContainText('A-01 사용 중');
    await expect(this.page.getByTestId('seat-status-seatA01'), 'A-01 상태가 in_use로 표시되어야 합니다.').toHaveText(
      'in_use'
    );
  }
}
