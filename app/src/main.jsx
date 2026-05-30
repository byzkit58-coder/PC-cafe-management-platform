import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = "http://127.0.0.1:4000";
const statusFlow = [
  "payment_pending",
  "payment_completed",
  "accepted",
  "cooking",
  "completed",
];
const savedToken = localStorage.getItem("token") ?? "";

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [token, setToken] = useState(savedToken);
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(Boolean(savedToken));

  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => {
    if (!savedToken) return;
    api("/api/me", savedToken)
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("token");
        setToken("");
        setUser(null);
      })
      .finally(() => setBootstrapping(false));
  }, []);

  const navigate = (nextPath) => {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setBootstrapping(false);
    navigate("/");
  };

  if (bootstrapping) {
    return (
      <main data-testid="auth-loading" className="page">
        Loading...
      </main>
    );
  }

  if (!token || !user) {
    return (
      <LoginPage
        onLogin={(nextToken, nextUser) => {
          localStorage.setItem("token", nextToken);
          setToken(nextToken);
          setUser(nextUser);
          setBootstrapping(false);
          navigate(nextUser.role === "user" ? "/seats" : "/admin/orders");
        }}
      />
    );
  }

  if (path.startsWith("/admin") && user.role === "user") {
    return (
      <Shell user={user} logout={logout} navigate={navigate}>
        <Forbidden />
      </Shell>
    );
  }

  return (
    <Shell user={user} logout={logout} navigate={navigate}>
      {(path === "/" || path.startsWith("/seats")) && user.role === "user" && (
        <SeatPage token={token} user={user} />
      )}
      {path.startsWith("/orders") && user.role === "user" && (
        <OrderPage token={token} user={user} />
      )}
      {path.startsWith("/my-orders") && user.role === "user" && (
        <MyOrdersPage token={token} />
      )}
      {path.startsWith("/admin/orders") && user.role !== "user" && (
        <AdminOrdersPage token={token} user={user} />
      )}
    </Shell>
  );
}

function Shell({ user, logout, navigate, children }) {
  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">PC Cafe QA</p>
          <h1>{user.role === "user" ? "사용자 화면" : "관리자 화면"}</h1>
          <p data-testid="current-user-name">{user.username}</p>
        </div>
        <nav>
          {user.role === "user" && (
            <>
              <button
                data-testid="nav-seats"
                onClick={() => navigate("/seats")}
              >
                좌석
              </button>
              <button
                data-testid="nav-orders"
                onClick={() => navigate("/orders")}
              >
                주문
              </button>
              <button
                data-testid="nav-my-orders"
                onClick={() => navigate("/my-orders")}
              >
                내 주문
              </button>
            </>
          )}
          {user.role !== "user" && (
            <button
              data-testid="nav-admin-orders"
              onClick={() => navigate("/admin/orders")}
            >
              관리자 주문
            </button>
          )}
          <button data-testid="logout-button" onClick={logout}>
            로그아웃
          </button>
        </nav>
      </header>
      {children}
    </main>
  );
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("user01");
  const [password, setPassword] = useState("pass1234");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await api("/api/login", "", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="login">
      <form className="panel" onSubmit={submit}>
        <h1>로그인</h1>
        <label>
          아이디
          <input
            data-testid="login-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          비밀번호
          <input
            data-testid="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p data-testid="login-error" className="error">
            {error}
          </p>
        )}
        <button data-testid="login-submit" type="submit">
          로그인
        </button>
      </form>
    </main>
  );
}

function SeatPage({ token, user }) {
  const [seats, setSeats] = useState([]);
  const [message, setMessage] = useState("");

  const load = () =>
    api(`/api/seats?storeId=${user.storeId}`, token).then((data) =>
      setSeats(data.seats),
    );
  useEffect(() => {
    load();
  }, []);

  const start = async (seatId) => {
    setMessage("");
    const data = await api(`/api/seats/${seatId}/start`, token, {
      method: "POST",
      body: "{}",
    });
    setMessage(`${data.seat.label} 사용 중`);
    await load();
  };

  return (
    <section data-testid="seat-page" className="section">
      <h2>좌석 선택</h2>
      {message && <p data-testid="seat-start-message">{message}</p>}
      <div className="grid">
        {seats.map((seat) => (
          <article
            data-testid={`seat-card-${seat.id}`}
            className="card"
            key={seat.id}
          >
            <strong>{seat.label}</strong>
            <span data-testid={`seat-label-${seat.id}`}>{seat.label}</span>
            <span data-testid={`seat-status-${seat.id}`}>
              {seat.status === "occupied" ? "in_use" : "available"}
            </span>
            <button
              data-testid={`seat-start-${seat.id}`}
              disabled={seat.status !== "available"}
              onClick={() => start(seat.id)}
            >
              사용 시작
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function OrderPage({ token, user }) {
  const [seats, setSeats] = useState([]);
  const [menus, setMenus] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  const activeSeat = useMemo(
    () => seats.find((seat) => seat.userId === user.id),
    [seats, user.id],
  );

  useEffect(() => {
    Promise.all([
      api(`/api/seats?storeId=${user.storeId}`, token),
      api(`/api/menus?storeId=${user.storeId}`, token),
    ]).then(([seatData, menuData]) => {
      setSeats(seatData.seats);
      setMenus(menuData.menus);
    });
  }, []);

  const orderMenu = async (menuId) => {
    const data = await api("/api/orders", token, {
      method: "POST",
      body: JSON.stringify({
        seatId: activeSeat?.id,
        items: [{ menuId, quantity: 1 }],
      }),
    });
    setLastOrder(data.order);
  };

  const paySuccess = async () => {
    const data = await api("/api/payments", token, {
      method: "POST",
      body: JSON.stringify({ orderId: lastOrder.id, result: "success" }),
    });
    setLastOrder(data.order);
  };

  return (
    <section data-testid="order-page" className="section">
      <h2>메뉴 주문</h2>
      <p data-testid="active-seat-label">{activeSeat?.label ?? "좌석 없음"}</p>
      <div className="grid">
        {menus.map((menu) => (
          <article
            data-testid={`menu-card-${menu.id}`}
            className="card"
            key={menu.id}
          >
            <strong>{menu.name}</strong>
            <span>stock={menu.stock}</span>
            <button
              data-testid={`order-menu-${menu.id}`}
              disabled={menu.stock === 0 || !activeSeat}
              onClick={() => orderMenu(menu.id)}
            >
              주문
            </button>
          </article>
        ))}
      </div>
      {lastOrder && (
        <div className="panel">
          <p data-testid="created-order-id">{lastOrder.id}</p>
          <p data-testid="created-order-status">{lastOrder.status}</p>
          <button
            data-testid="pay-success-button"
            disabled={lastOrder.status !== "payment_pending"}
            onClick={paySuccess}
          >
            결제 성공
          </button>
        </div>
      )}
    </section>
  );
}

function MyOrdersPage({ token }) {
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    api("/api/orders", token).then((data) => setOrders(data.orders));
  }, []);

  return (
    <section data-testid="my-orders-page" className="section">
      <h2>내 주문</h2>
      {orders.map((order) => (
        <article
          data-testid={`my-order-${order.id}`}
          className="row"
          key={order.id}
        >
          <span>{order.items.map((item) => item.name).join(", ")}</span>
          <span>{order.seatId}</span>
          <strong data-testid={`my-order-status-${order.id}`}>
            {order.status}
          </strong>
        </article>
      ))}
    </section>
  );
}

function AdminOrdersPage({ token, user }) {
  const [orders, setOrders] = useState([]);
  const load = () =>
    api(`/api/admin/orders?storeId=${user.storeId}`, token).then((data) =>
      setOrders(data.orders),
    );
  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (orderId, status) => {
    await api(`/api/orders/${orderId}/status`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  };

  return (
    <section data-testid="admin-orders-page" className="section">
      <h2>관리자 주문</h2>
      {orders.map((order) => (
        <article
          data-testid={`admin-order-${order.id}`}
          className="row"
          key={order.id}
        >
          <span data-testid={`admin-order-menu-${order.id}`}>
            {order.items.map((item) => item.name).join(", ")}
          </span>
          <span data-testid={`admin-order-seat-${order.id}`}>
            {seatLabel(order.seatId)}
          </span>
          <strong data-testid={`admin-order-status-${order.id}`}>
            {order.status}
          </strong>
          <select
            data-testid={`admin-status-select-${order.id}`}
            value={order.status}
            onChange={(event) => updateStatus(order.id, event.target.value)}
          >
            {statusFlow.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </article>
      ))}
    </section>
  );
}

function Forbidden() {
  return (
    <section data-testid="forbidden-message" className="panel error">
      관리자 페이지 접근 권한이 없습니다.
    </section>
  );
}

function seatLabel(seatId) {
  if (seatId === "seatA01") return "A-01";
  if (seatId === "seatA02") return "A-02";
  if (seatId === "seatB01") return "B-01";
  return seatId;
}

async function api(path, token, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? `HTTP ${response.status}`);
  return body;
}

createRoot(document.getElementById("root")).render(<App />);
