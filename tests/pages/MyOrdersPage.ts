import { expect, type Page } from "@playwright/test";

export class MyOrdersPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.getByTestId("nav-my-orders").click();
    await expect(
      this.page.getByTestId("my-orders-page"),
      "내 주문 화면이 표시되어야 합니다.",
    ).toBeVisible();
  }

  async expectOrderStatus(orderId: string, status: string) {
    await expect(
      this.page.getByTestId(`my-order-status-${orderId}`),
      `사용자 주문 내역에서 ${orderId} 상태가 ${status}로 보여야 합니다.`,
    ).toHaveText(status);
  }
}
