import cors from "cors";
import express from "express";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, "data", "seed.json");
const dbPath = join(__dirname, "data", "db.json");
const PORT = 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pc-cafe-mock-api" });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDb();
  const user = db.users.find(
    (item) => item.username === username && item.password === password,
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  res.json({
    token: createToken(user),
    user: publicUser(user),
  });
});

app.post("/api/test/reset", (_req, res) => {
  copyFileSync(seedPath, dbPath);
  res.json({ ok: true, message: "db.json restored from seed.json" });
});

app.use("/api", authenticate);

app.get("/api/me", (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/seats", (req, res) => {
  const db = readDb();
  const storeId = req.query.storeId;
  const forbidden = assertStoreAccess(req.user, storeId);
  if (forbidden) return forbidden(res);

  const seats = db.seats.filter((seat) => !storeId || seat.storeId === storeId);
  res.json({ seats });
});

app.post("/api/seats/:seatId/start", (req, res) => {
  if (req.user.role !== "user") {
    return res.status(403).json({ message: "Only user role can start a seat" });
  }

  const db = readDb();
  const seat = db.seats.find((item) => item.id === req.params.seatId);

  if (!seat) {
    return res.status(404).json({ message: "Seat not found" });
  }
  if (!canAccessStore(req.user, seat.storeId)) {
    return res.status(403).json({ message: "Forbidden store access" });
  }
  if (seat.status !== "available") {
    return res
      .status(409)
      .json({ message: "Only available seats can be selected" });
  }

  seat.status = "occupied";
  seat.userId = req.user.id;
  writeDb(db);
  res.json({ seat });
});

app.get("/api/menus", (req, res) => {
  const db = readDb();
  const storeId = req.query.storeId;
  const forbidden = assertStoreAccess(req.user, storeId);
  if (forbidden) return forbidden(res);

  const menus = db.menus.filter((menu) => !storeId || menu.storeId === storeId);
  res.json({ menus });
});

app.post("/api/orders", (req, res) => {
  if (req.user.role !== "user") {
    return res
      .status(403)
      .json({ message: "Only user role can create orders" });
  }

  const db = readDb();
  const { seatId, items = [], couponId = null, pointsUsed = 0 } = req.body;
  const seat = db.seats.find((item) => item.id === seatId);

  if (!seat) {
    return res.status(404).json({ message: "Seat not found" });
  }
  if (seat.status !== "occupied" || seat.userId !== req.user.id) {
    return res
      .status(403)
      .json({ message: "Only the user currently using the seat can order" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Order items are required" });
  }

  const orderItems = [];
  for (const requestedItem of items) {
    const menu = db.menus.find(
      (item) =>
        item.id === requestedItem.menuId && item.storeId === seat.storeId,
    );
    const quantity = Number(requestedItem.quantity ?? 1);

    if (!menu) {
      return res
        .status(404)
        .json({ message: `Menu not found: ${requestedItem.menuId}` });
    }
    if (menu.stock <= 0 || menu.stock < quantity) {
      return res
        .status(409)
        .json({ message: "Out of stock menu cannot be ordered" });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be a positive integer" });
    }

    orderItems.push({
      menuId: menu.id,
      name: menu.name,
      quantity,
      price: menu.price,
    });
  }

  const point = getPoint(db, req.user.id);
  if (
    !Number.isInteger(pointsUsed) ||
    pointsUsed < 0 ||
    pointsUsed > point.balance
  ) {
    return res.status(400).json({ message: "Invalid points amount" });
  }

  const coupon = couponId
    ? db.coupons.find((item) => item.id === couponId)
    : null;
  if (
    couponId &&
    (!coupon || coupon.userId !== req.user.id || coupon.status !== "available")
  ) {
    return res.status(409).json({ message: "Coupon is not available" });
  }

  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const couponDiscount = coupon ? Math.min(coupon.discountAmount, subtotal) : 0;
  const finalAmount = Math.max(subtotal - couponDiscount - pointsUsed, 0);
  const order = {
    id: nextId("order", db.orders),
    storeId: seat.storeId,
    userId: req.user.id,
    seatId: seat.id,
    items: orderItems,
    status: "payment_pending",
    subtotal,
    couponId: coupon?.id ?? null,
    couponDiscount,
    pointsUsed,
    finalAmount,
  };

  for (const orderItem of orderItems) {
    const menu = db.menus.find((item) => item.id === orderItem.menuId);
    menu.stock -= orderItem.quantity;
  }
  if (coupon) {
    coupon.status = "used";
    coupon.orderId = order.id;
  }
  point.balance -= pointsUsed;
  db.orders.push(order);
  writeDb(db);

  res.status(201).json({ order });
});

app.get("/api/orders", (req, res) => {
  const db = readDb();
  const storeId = req.query.storeId;

  if (req.user.role === "user") {
    return res.json({
      orders: db.orders.filter((order) => order.userId === req.user.id),
    });
  }

  const forbidden = assertStoreAccess(req.user, storeId);
  if (forbidden) return forbidden(res);

  const orders = db.orders.filter((order) => {
    if (req.user.role !== "hq_admin" && order.storeId !== req.user.storeId)
      return false;
    return !storeId || order.storeId === storeId;
  });
  res.json({ orders });
});

app.get("/api/orders/:orderId", (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === req.params.orderId);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  if (!canReadOrder(req.user, order)) {
    return res.status(403).json({ message: "Forbidden order access" });
  }

  res.json({ order });
});

app.patch("/api/orders/:orderId/status", (req, res) => {
  if (!["staff", "store_manager"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: "Only store staff or manager can update order status" });
  }

  const db = readDb();
  const order = db.orders.find((item) => item.id === req.params.orderId);
  const nextStatus = req.body.status;

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  if (!canAccessStore(req.user, order.storeId)) {
    return res.status(403).json({ message: "Forbidden store access" });
  }
  if (!canTransition(order.status, nextStatus)) {
    return res
      .status(409)
      .json({ message: `Cannot change ${order.status} to ${nextStatus}` });
  }

  order.status = nextStatus;
  writeDb(db);
  res.json({ order });
});

app.post("/api/payments", (req, res) => {
  if (req.user.role !== "user") {
    return res.status(403).json({ message: "Only user role can pay orders" });
  }

  const db = readDb();
  const { orderId, result = "success" } = req.body;
  const order = db.orders.find((item) => item.id === orderId);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  if (order.userId !== req.user.id) {
    return res
      .status(403)
      .json({ message: "Users can only pay their own orders" });
  }
  if (order.status !== "payment_pending") {
    return res.status(409).json({ message: "Order is not payment_pending" });
  }
  if (db.payments.some((payment) => payment.orderId === order.id)) {
    return res.status(409).json({ message: "Duplicate payment is blocked" });
  }

  const payment = {
    id: nextId("payment", db.payments),
    orderId: order.id,
    status: result === "fail" ? "failed" : "success",
    amount: order.finalAmount,
  };
  db.payments.push(payment);

  if (payment.status === "success") {
    order.status = "payment_completed";
  } else {
    order.status = "payment_pending";
  }

  writeDb(db);
  res.status(201).json({ payment, order });
});

app.post("/api/orders/:orderId/cancel", (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === req.params.orderId);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  if (!canCancelOrder(req.user, order)) {
    return res.status(403).json({ message: "Forbidden order cancel" });
  }
  if (["canceled", "refunded"].includes(order.status)) {
    return res
      .status(409)
      .json({ message: `${order.status} order cannot be changed` });
  }

  order.status = "canceled";
  restoreCoupon(db, order);
  restorePoints(db, order);
  writeDb(db);
  res.json({ order });
});

app.get("/api/users/:userId/coupons", (req, res) => {
  const db = readDb();
  const targetUser = db.users.find((user) => user.id === req.params.userId);
  const forbidden = assertUserResourceAccess(req.user, targetUser);
  if (forbidden) return forbidden(res);

  res.json({
    coupons: db.coupons.filter((coupon) => coupon.userId === req.params.userId),
  });
});

app.get("/api/users/:userId/points", (req, res) => {
  const db = readDb();
  const targetUser = db.users.find((user) => user.id === req.params.userId);
  const forbidden = assertUserResourceAccess(req.user, targetUser);
  if (forbidden) return forbidden(res);

  res.json({ points: getPoint(db, req.params.userId) });
});

app.get("/api/stores/:storeId/settlement", (req, res) => {
  if (!["store_manager", "hq_admin"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: "Only store_manager or hq_admin can read settlement" });
  }

  const db = readDb();
  const { storeId } = req.params;

  if (storeId !== "all" && !canAccessStore(req.user, storeId)) {
    return res.status(403).json({ message: "Forbidden store access" });
  }
  if (storeId === "all" && req.user.role !== "hq_admin") {
    return res
      .status(403)
      .json({ message: "Only hq_admin can read all store settlement" });
  }

  const completedOrders = db.orders.filter((order) => {
    if (order.status !== "completed") return false;
    return storeId === "all" || order.storeId === storeId;
  });

  res.json({
    storeId,
    totalSales: completedOrders.reduce(
      (sum, order) => sum + order.finalAmount,
      0,
    ),
    orderCount: completedOrders.length,
    orders: completedOrders,
  });
});

app.get("/api/admin/orders", (req, res) => {
  if (req.user.role === "user") {
    return res
      .status(403)
      .json({ message: "User role cannot access admin API" });
  }

  const db = readDb();
  const storeId = req.query.storeId;
  const forbidden = assertStoreAccess(req.user, storeId);
  if (forbidden) return forbidden(res);

  const orders = db.orders.filter((order) => {
    if (req.user.role !== "hq_admin" && order.storeId !== req.user.storeId)
      return false;
    return !storeId || order.storeId === storeId;
  });
  res.json({ orders });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ message: err.message });
});

app.listen(PORT, () => {
  console.log(`PC cafe mock API listening on http://127.0.0.1:${PORT}`);
});

function readDb() {
  return JSON.parse(readFileSync(dbPath, "utf-8"));
}

function writeDb(db) {
  writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function createToken(user) {
  const payload = {
    userId: user.id,
    role: user.role,
    storeId: user.storeId,
  };
  return `mock.${Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url")}`;
}

function parseToken(token) {
  if (!token?.startsWith("mock.")) return null;
  try {
    return JSON.parse(
      Buffer.from(token.slice("mock.".length), "base64url").toString("utf-8"),
    );
  } catch {
    return null;
  }
}

function authenticate(req, res, next) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";
  const payload = parseToken(token);

  if (!payload) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  const db = readDb();
  const user = db.users.find((item) => item.id === payload.userId);
  if (!user || user.role !== payload.role || user.storeId !== payload.storeId) {
    return res.status(401).json({ message: "Token user no longer exists" });
  }

  req.user = user;
  next();
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function canAccessStore(user, storeId) {
  if (!storeId) return true;
  return user.role === "hq_admin" || user.storeId === storeId;
}

function assertStoreAccess(user, storeId) {
  if (storeId && !canAccessStore(user, storeId)) {
    return (res) => res.status(403).json({ message: "Forbidden store access" });
  }
  return null;
}

function canReadOrder(user, order) {
  if (user.role === "user") return order.userId === user.id;
  if (user.role === "hq_admin") return true;
  return order.storeId === user.storeId;
}

function canCancelOrder(user, order) {
  if (user.role === "user") return order.userId === user.id;
  if (["staff", "store_manager"].includes(user.role))
    return order.storeId === user.storeId;
  return false;
}

function canTransition(currentStatus, nextStatus) {
  const allowed = {
    payment_pending: ["payment_completed"],
    payment_completed: ["accepted"],
    accepted: ["cooking"],
    cooking: ["completed"],
    completed: [],
    canceled: [],
    refunded: [],
  };
  return allowed[currentStatus]?.includes(nextStatus) ?? false;
}

function assertUserResourceAccess(requestUser, targetUser) {
  if (!targetUser) {
    return (res) => res.status(404).json({ message: "User not found" });
  }
  if (requestUser.role === "user" && requestUser.id !== targetUser.id) {
    return (res) =>
      res
        .status(403)
        .json({ message: "Users can only access their own resources" });
  }
  if (
    ["staff", "store_manager"].includes(requestUser.role) &&
    requestUser.storeId !== targetUser.storeId
  ) {
    return (res) => res.status(403).json({ message: "Forbidden store access" });
  }
  return null;
}

function getPoint(db, userId) {
  let point = db.points.find((item) => item.userId === userId);
  if (!point) {
    point = { userId, balance: 0 };
    db.points.push(point);
  }
  return point;
}

function restoreCoupon(db, order) {
  if (!order.couponId) return;
  const coupon = db.coupons.find((item) => item.id === order.couponId);
  if (coupon) {
    coupon.status = "available";
    coupon.orderId = null;
  }
}

function restorePoints(db, order) {
  if (!order.pointsUsed) return;
  const point = getPoint(db, order.userId);
  point.balance += order.pointsUsed;
  order.pointsUsed = 0;
}

function nextId(prefix, collection) {
  return `${prefix}_${collection.length + 1}_${Date.now()}`;
}
