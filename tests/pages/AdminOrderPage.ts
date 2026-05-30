import { expect, type Page } from "@playwright/test";

export class AdminOrderPage {
  constructor(private readonly page: Page) {}

  async expectLoaded() {
    await expect(
      this.page.getByTestId("admin-orders-page"),
      "관리자 주문 화면이 표시되어야 합니다.",
    ).toBeVisible();
  }

  async expectOrderVisible(orderId: string, expectedStatus: RegExp | string) {
    await expect(
      this.page.getByTestId(`admin-order-${orderId}`),
      `관리자 주문 목록에 ${orderId}가 있어야 합니다.`,
    ).toBeVisible();
    await expect(
      this.page.getByTestId(`admin-order-menu-${orderId}`),
      "관리자 주문 목록에 김치볶음밥이 표시되어야 합니다.",
    ).toContainText("김치볶음밥");
    await expect(
      this.page.getByTestId(`admin-order-seat-${orderId}`),
      "관리자 주문 목록에 A-01 좌석이 표시되어야 합니다.",
    ).toHaveText("A-01");
    await expect(
      this.page.getByTestId(`admin-order-status-${orderId}`),
      "관리자 주문 목록에 주문 상태가 표시되어야 합니다.",
    ).toHaveText(expectedStatus);
  }

  async updateStatus(orderId: string, status: string) {
    await this.page
      .getByTestId(`admin-status-select-${orderId}`)
      .selectOption(status);
    await expect(
      this.page.getByTestId(`admin-order-status-${orderId}`),
      `${orderId} 상태가 ${status}로 변경되어야 합니다.`,
    ).toHaveText(status);
  }
}
