import { expect, type Page } from '@playwright/test';

export class OrderPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.getByTestId('nav-orders').click();
    await expect(this.page.getByTestId('order-page'), '주문 화면이 표시되어야 합니다.').toBeVisible();
  }

  async createKimchiFriedRiceOrder() {
    await expect(this.page.getByTestId('active-seat-label'), '주문 전 활성 좌석은 A-01이어야 합니다.').toHaveText('A-01');
    await this.page.getByTestId('order-menu-menuA_ramen').click();
    await expect(this.page.getByTestId('created-order-id'), '주문 생성 후 주문 ID가 표시되어야 합니다.').toBeVisible();
    await expect(this.page.getByTestId('created-order-status'), '신규 주문 기본 상태는 payment_pending이어야 합니다.').toHaveText(
      'payment_pending'
    );
    return await this.page.getByTestId('created-order-id').innerText();
  }

  async paySuccess() {
    await this.page.getByTestId('pay-success-button').click();
    await expect(this.page.getByTestId('created-order-status'), '결제 성공 후 payment_completed 상태여야 합니다.').toHaveText(
      'payment_completed'
    );
  }
}
