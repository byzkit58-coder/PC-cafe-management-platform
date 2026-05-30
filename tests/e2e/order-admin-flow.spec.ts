import { test } from '@playwright/test';
import { users } from '../fixtures/users';
import { AdminOrderPage } from '../pages/AdminOrderPage';
import { LoginPage } from '../pages/LoginPage';
import { MyOrdersPage } from '../pages/MyOrdersPage';
import { OrderPage } from '../pages/OrderPage';
import { SeatPage } from '../pages/SeatPage';
import { resetTestData } from '../utils/reset';

test.beforeEach(async ({ request }) => {
  await resetTestData(request);
});

test('TC-ORDER-003 사용자 주문 후 관리자 주문 목록 반영', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const seatPage = new SeatPage(page);
  const orderPage = new OrderPage(page);
  const adminOrderPage = new AdminOrderPage(page);

  await loginPage.goto();
  await loginPage.login(users.user01.username, users.user01.password);
  await seatPage.expectLoaded();
  await seatPage.startSeatA01();
  const orderId = await createUserOrder(orderPage);
  await loginPage.logout();

  await loginPage.login(users.managerStoreA.username, users.managerStoreA.password);
  await adminOrderPage.expectLoaded();

  await adminOrderPage.expectOrderVisible(orderId, /payment_pending|payment_completed/);
});

test('TC-STATUS-003 관리자 주문 완료 후 사용자 화면 반영', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const seatPage = new SeatPage(page);
  const orderPage = new OrderPage(page);
  const adminOrderPage = new AdminOrderPage(page);
  const myOrdersPage = new MyOrdersPage(page);

  await loginPage.goto();
  await loginPage.login(users.user01.username, users.user01.password);
  await seatPage.expectLoaded();
  await seatPage.startSeatA01();
  const orderId = await createUserOrder(orderPage);
  await orderPage.paySuccess();
  await loginPage.logout();

  await loginPage.login(users.managerStoreA.username, users.managerStoreA.password);
  await adminOrderPage.expectLoaded();
  await adminOrderPage.updateStatus(orderId, 'accepted');
  await adminOrderPage.updateStatus(orderId, 'cooking');
  await adminOrderPage.updateStatus(orderId, 'completed');
  await loginPage.logout();

  await loginPage.login(users.user01.username, users.user01.password);
  await myOrdersPage.goto();

  await myOrdersPage.expectOrderStatus(orderId, 'completed');
});

async function createUserOrder(orderPage: OrderPage) {
  await orderPage.goto();
  return await orderPage.createKimchiFriedRiceOrder();
}
