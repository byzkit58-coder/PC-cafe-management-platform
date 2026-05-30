import { expect, test, type APIRequestContext } from '@playwright/test';
import { resetTestData } from '../utils/reset';

const apiBase = 'http://127.0.0.1:4000';

test.beforeEach(async ({ request }) => {
  await resetTestData(request);
});

test('API-001 reset API restores seed seat state', async ({ request }) => {
  const userToken = await login(request, 'user01');

  await request.post(`${apiBase}/api/seats/seatA01/start`, { headers: auth(userToken) });
  await resetTestData(request);

  const seats = await request.get(`${apiBase}/api/seats?storeId=storeA`, { headers: auth(userToken) });
  const body = await seats.json();

  expect(seats.status(), '좌석 조회 API는 reset 이후 정상 응답이어야 합니다.').toBe(200);
  expect(body.seats.find((seat: { id: string }) => seat.id === 'seatA01').status, 'reset 이후 A-01은 available이어야 합니다.').toBe(
    'available'
  );
});

test('API-002 login failure returns 401', async ({ request }) => {
  const response = await request.post(`${apiBase}/api/login`, {
    data: { username: 'user01', password: 'wrong-password' }
  });

  expect(response.status(), '잘못된 비밀번호 로그인은 401이어야 합니다.').toBe(401);
});

test('API-003 unauthenticated request returns 401', async ({ request }) => {
  const response = await request.get(`${apiBase}/api/me`);

  expect(response.status(), '토큰 없는 보호 API 호출은 401이어야 합니다.').toBe(401);
});

test('API-004 user cannot access admin orders API', async ({ request }) => {
  const userToken = await login(request, 'user01');

  const response = await request.get(`${apiBase}/api/admin/orders`, { headers: auth(userToken) });

  expect(response.status(), '일반 사용자의 관리자 주문 API 접근은 403이어야 합니다.').toBe(403);
});

test('API-005 Store A manager cannot access Store B order or settlement', async ({ request }) => {
  const managerToken = await login(request, 'manager_store_a');

  const orderResponse = await request.get(`${apiBase}/api/orders/orderCompletedB`, { headers: auth(managerToken) });
  const settlementResponse = await request.get(`${apiBase}/api/stores/storeB/settlement`, { headers: auth(managerToken) });

  expect(orderResponse.status(), 'Store A 관리자가 Store B 주문을 조회하면 403이어야 합니다.').toBe(403);
  expect(settlementResponse.status(), 'Store A 관리자가 Store B 정산을 조회하면 403이어야 합니다.').toBe(403);
});

test('API-006 failed payment keeps order status payment_pending', async ({ request }) => {
  const userToken = await login(request, 'user01');

  const paymentResponse = await request.post(`${apiBase}/api/payments`, {
    headers: auth(userToken),
    data: { orderId: 'orderPendingA', result: 'fail' }
  });
  const paymentBody = await paymentResponse.json();

  expect(paymentResponse.status(), '결제 실패 요청도 결제 시도 기록으로 201 응답이어야 합니다.').toBe(201);
  expect(paymentBody.order.status, '결제 실패 후 주문 상태는 payment_pending으로 유지되어야 합니다.').toBe('payment_pending');
});

test('API-007 duplicate payment for same order is blocked', async ({ request }) => {
  const userToken = await login(request, 'user01');

  const first = await request.post(`${apiBase}/api/payments`, {
    headers: auth(userToken),
    data: { orderId: 'orderPendingA', result: 'success' }
  });
  const second = await request.post(`${apiBase}/api/payments`, {
    headers: auth(userToken),
    data: { orderId: 'orderPendingA', result: 'success' }
  });

  expect(first.status(), '첫 결제는 성공해야 합니다.').toBe(201);
  expect(second.status(), '동일 주문 중복 결제는 차단되어야 합니다.').toBe(409);
});

test('API-008 settlement includes completed orders only and cancel restores benefits', async ({ request }) => {
  const userToken = await login(request, 'user01');
  const managerToken = await login(request, 'manager_store_a');

  const beforePoints = await request.get(`${apiBase}/api/users/user01/points`, { headers: auth(userToken) });
  const beforeCoupons = await request.get(`${apiBase}/api/users/user01/coupons`, { headers: auth(userToken) });
  const beforePointBody = await beforePoints.json();
  const beforeCouponBody = await beforeCoupons.json();

  expect(beforeCouponBody.coupons.find((coupon: { id: string }) => coupon.id === 'coupon_restore_3000').status).toBe('used');

  await request.post(`${apiBase}/api/orders/orderCancelCoupon/cancel`, { headers: auth(userToken) });
  await request.post(`${apiBase}/api/orders/orderCancelPoints/cancel`, { headers: auth(userToken) });

  const afterPoints = await request.get(`${apiBase}/api/users/user01/points`, { headers: auth(userToken) });
  const afterCoupons = await request.get(`${apiBase}/api/users/user01/coupons`, { headers: auth(userToken) });
  const settlement = await request.get(`${apiBase}/api/stores/storeA/settlement`, { headers: auth(managerToken) });
  const afterPointBody = await afterPoints.json();
  const afterCouponBody = await afterCoupons.json();
  const settlementBody = await settlement.json();

  expect(afterCouponBody.coupons.find((coupon: { id: string }) => coupon.id === 'coupon_restore_3000').status).toBe('available');
  expect(afterPointBody.points.balance, '주문 취소 후 사용 포인트 500점이 복원되어야 합니다.').toBe(
    beforePointBody.points.balance + 500
  );
  expect(settlementBody.totalSales, '정산은 completed 주문만 반영해야 합니다.').toBe(5000);
  expect(settlementBody.orders.map((order: { status: string }) => order.status)).toEqual(['completed']);
});

async function login(request: APIRequestContext, username: string) {
  const response = await request.post(`${apiBase}/api/login`, {
    data: { username, password: 'pass1234' }
  });
  expect(response.ok(), `${username} 로그인은 성공해야 합니다.`).toBeTruthy();
  return (await response.json()).token as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}
