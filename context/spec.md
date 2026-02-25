# DevSprint 2026 — IUT Cafeteria Microservices System

## Complete Technical Specification

---

## 1. Project Overview

Build a distributed, fault-tolerant microservice system to replace the "Spaghetti Monolith" cafeteria ordering system. The system must handle hundreds of simultaneous orders during Ramadan Iftar rush (peak load at ~5:30 PM) without data loss, over-selling, or cascading failures.

The entire system must be launchable with a single command:

```bash
docker compose up
```

---

## 2. Repository Structure

```
devsprint-2026/
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml
├── services/
│   ├── identity-provider/
│   ├── order-gateway/
│   ├── stock-service/
│   ├── kitchen-queue/
│   └── notification-hub/
├── frontend/
│   ├── student-ui/
│   └── admin-dashboard/
└── infra/
    └── redis/
```

Each service must have its own `Dockerfile`, `package.json` (or equivalent), and test files.

---

## 3. Services Specification

### 3.1 Identity Provider

**Port:** `3001`  
**Technology:** Node.js/Express (or FastAPI/Go — your choice)  
**Database:** PostgreSQL or SQLite (for storing student accounts)

**Responsibilities:**

- Single source of truth for student authentication
- Issue signed JWT tokens on successful login
- Rate limiting per Student ID

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/login` | Authenticate student, return JWT |
| POST | `/auth/register` | Register a new student account |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus-style metrics |
| POST | `/admin/kill` | Chaos: simulate crash (returns 503 on all routes after this) |
| POST | `/admin/revive` | Chaos: restore service to normal operation |

**POST `/auth/login` Request:**

```json
{
  "studentId": "210042101",
  "password": "securepassword"
}
```

**POST `/auth/login` Response (200 OK):**

```json
{
  "token": "<signed_jwt>",
  "expiresIn": 3600,
  "studentId": "210042101"
}
```

**POST `/auth/login` Response (401 Unauthorized):**

```json
{ "error": "Invalid credentials" }
```

**POST `/auth/login` Response (429 Too Many Requests — Rate Limit):**

```json
{ "error": "Too many login attempts. Try again in 60 seconds." }
```

**JWT Payload:**

```json
{
  "sub": "210042101",
  "name": "Ahmed Rahman",
  "iat": 1700000000,
  "exp": 1700003600
}
```

**Rate Limiting Rule:**

- Max 3 login attempts per Student ID per 60-second window
- Use Redis or in-memory sliding window
- Return HTTP 429 on violation

**Security:**

- Passwords must be hashed with bcrypt (salt rounds ≥ 10)
- JWT signed with HS256 or RS256
- JWT secret stored in environment variable `JWT_SECRET`

---

### 3.2 Order Gateway

**Port:** `3002`  
**Technology:** Node.js/Express or FastAPI  
**Dependencies:** Redis (cache), Identity Provider (JWT validation), Stock Service

**Responsibilities:**

- Primary entry point for all student order requests
- Validate Bearer JWT token on every incoming request
- Check Redis cache for stock availability before forwarding to Stock Service
- Route validated orders to Kitchen Queue
- Protect downstream services from unnecessary load

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/order` | Place an order (requires Bearer token) |
| GET | `/order/:orderId` | Get order status |
| GET | `/health` | Health check |
| GET | `/metrics` | Metrics |
| POST | `/admin/kill` | Chaos: simulate crash (returns 503 on all routes after this) |
| POST | `/admin/revive` | Chaos: restore service to normal operation |

**POST `/order` Request Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**POST `/order` Request Body:**

```json
{
  "items": [
    { "itemId": "iftar-box-1", "quantity": 1 }
  ]
}
```

**POST `/order` Response (202 Accepted):**

```json
{
  "orderId": "ord_abc123",
  "status": "PENDING",
  "message": "Order received. Processing..."
}
```

**POST `/order` Response (401 Unauthorized — missing/invalid token):**

```json
{ "error": "Unauthorized. Valid Bearer token required." }
```

**POST `/order` Response (409 Conflict — cache says zero stock):**

```json
{ "error": "Item out of stock." }
```

**Cache-First Stock Check Logic:**

```
1. Extract itemId from request
2. Check Redis key: stock:<itemId>
3. If Redis value == "0" → return 409 immediately (do NOT hit Stock Service)
4. If Redis value > "0" or key absent → forward to Stock Service for real check + decrement
5. After successful decrement, update Redis cache
```

**Idempotency:**

- Accept optional header `Idempotency-Key: <uuid>`
- Store processed idempotency keys in Redis with TTL of 24 hours
- If same key seen again, return cached response instead of reprocessing

**Token Validation:**

- Verify JWT signature using shared `JWT_SECRET`
- Reject expired tokens
- Reject requests with missing/malformed Authorization header

---

### 3.3 Stock Service

**Port:** `3003`  
**Technology:** Node.js/Express or FastAPI  
**Database:** PostgreSQL (required for transactional integrity)

**Responsibilities:**

- Single source of truth for inventory
- Transactional, concurrent-safe stock decrement
- Prevent over-selling under simultaneous requests

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/stock/:itemId` | Get current stock level |
| POST | `/stock/:itemId/decrement` | Decrement stock by quantity |
| POST | `/stock/:itemId/replenish` | Add stock (admin) |
| GET | `/health` | Health check |
| GET | `/metrics` | Metrics |
| POST | `/admin/kill` | Chaos: simulate crash (returns 503 on all routes after this) |
| POST | `/admin/revive` | Chaos: restore service to normal operation |

**POST `/stock/:itemId/decrement` Request:**

```json
{ "quantity": 1, "orderId": "ord_abc123" }
```

**POST `/stock/:itemId/decrement` Response (200 OK):**

```json
{ "itemId": "iftar-box-1", "remaining": 49, "decremented": 1 }
```

**POST `/stock/:itemId/decrement` Response (409 Conflict — out of stock):**

```json
{ "error": "Insufficient stock." }
```

**Concurrency Control — Optimistic Locking:**

Use a `version` column in the `stock` table:

```sql
CREATE TABLE stock (
  item_id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0
);
```

Decrement logic:

```sql
UPDATE stock
SET quantity = quantity - $1, version = version + 1
WHERE item_id = $2
  AND version = $3
  AND quantity >= $1;
-- If 0 rows affected → version conflict or insufficient stock → retry or reject
```

Retry up to 3 times on version conflict before returning a 409.

**Idempotency:** Track `orderId` in a `processed_orders` table to ensure a crash-and-retry does not double-decrement:

```sql
CREATE TABLE processed_orders (
  order_id VARCHAR PRIMARY KEY,
  item_id VARCHAR,
  processed_at TIMESTAMP DEFAULT NOW()
);
```

Before decrementing, check if `orderId` already exists in `processed_orders`. If yes, return the cached success response.

> **Critical PDF requirement — Partial Failure Scenario:** The system must be designed for the case where the Stock Service successfully decrements stock AND inserts into `processed_orders`, but then crashes (network drop, OOM kill, etc.) *before* it can respond to the Order Gateway. When the Order Gateway retries with the same `orderId`, the Stock Service must detect the duplicate via `processed_orders` and return a success response **without** decrementing again. This is the primary idempotency guarantee the judges will test.

---

### 3.4 Kitchen Queue

**Port:** `3004`  
**Technology:** Node.js/Express or FastAPI  
**Message Broker:** Redis Pub/Sub or BullMQ (queue)

**Responsibilities:**

- Receive confirmed orders from Order Gateway
- Immediately acknowledge receipt (< 2 seconds)
- Asynchronously simulate kitchen preparation (3–7 seconds)
- Publish status updates via Notification Hub

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/queue/order` | Enqueue a confirmed order |
| GET | `/queue/status/:orderId` | Get kitchen status of an order |
| GET | `/health` | Health check |
| GET | `/metrics` | Metrics |
| POST | `/admin/kill` | Chaos: simulate crash (returns 503 on all routes after this) |
| POST | `/admin/revive` | Chaos: restore service to normal operation |

**POST `/queue/order` Request:**

```json
{
  "orderId": "ord_abc123",
  "studentId": "210042101",
  "items": [{ "itemId": "iftar-box-1", "quantity": 1 }]
}
```

**POST `/queue/order` Response (202 Accepted — immediate):**

```json
{
  "orderId": "ord_abc123",
  "status": "IN_KITCHEN",
  "estimatedTime": "3-7 seconds"
}
```

**Async Processing Flow:**

```
1. Receive order → push to Redis queue → respond 202 immediately
2. Background worker picks up order from queue
3. Worker simulates preparation: await sleep(3000–7000ms)
4. Worker publishes status event to Notification Hub
   Event: { orderId, status: "READY", studentId }
```

**Order Status States:**

```
PENDING → STOCK_VERIFIED → IN_KITCHEN → READY
```

Each state transition must publish an event to the Notification Hub.

---

### 3.5 Notification Hub

**Port:** `3005`  
**Technology:** Node.js/Express with Server-Sent Events (SSE) or WebSocket (socket.io)  
**Backing Store:** Redis (for pub/sub between services)

**Responsibilities:**

- Maintain persistent connections with student UIs
- Push real-time status updates **without client polling** — the PDF requirement is to eliminate polling entirely; the Student UI must never use `setInterval` + fetch to check order status
- Survive Kitchen Queue restarts independently

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/events/:studentId` | SSE stream for a student |
| POST | `/notify` | Internal — receive status update from other services |
| GET | `/health` | Health check |
| GET | `/metrics` | Metrics |
| POST | `/admin/kill` | Chaos: simulate crash (returns 503 on all routes after this) |
| POST | `/admin/revive` | Chaos: restore service to normal operation |

**GET `/events/:studentId` — Server-Sent Events:**

Client connects:

```javascript
const source = new EventSource('http://localhost:3005/events/210042101');
source.onmessage = (e) => console.log(JSON.parse(e.data));
```

Server pushes:

```
data: {"orderId":"ord_abc123","status":"IN_KITCHEN","timestamp":"2026-03-15T17:32:10Z"}

data: {"orderId":"ord_abc123","status":"READY","timestamp":"2026-03-15T17:32:15Z"}
```

**POST `/notify` — Internal Endpoint (called by Kitchen Queue / Order Gateway):**

```json
{
  "studentId": "210042101",
  "orderId": "ord_abc123",
  "status": "READY"
}
```

**Isolation Requirement:**  
If Kitchen Queue crashes, Notification Hub must continue running and maintaining existing SSE connections. Do not make Notification Hub dependent on Kitchen Queue being alive.

**Chaos Endpoint Behavior (applies to ALL services):**

`POST /admin/kill` — sets an internal `isKilled = true` flag. All subsequent requests to operational routes return:

```json
HTTP 503 Service Unavailable
{ "error": "Service is down (chaos mode)" }
```

The `/admin/kill` and `/admin/revive` routes themselves must always remain responsive even in killed state.

`POST /admin/revive` — resets `isKilled = false`, restores normal operation.

Implement as middleware:

```javascript
app.use((req, res, next) => {
  const safeRoutes = ['/admin/kill', '/admin/revive', '/health'];
  if (isKilled && !safeRoutes.includes(req.path)) {
    return res.status(503).json({ error: 'Service is down (chaos mode)' });
  }
  next();
});
```

---

## 4. Health & Metrics Endpoints

**Every service** must implement these two routes:

### GET `/health`

Returns `200 OK` if the service and all its direct dependencies are reachable:

```json
{
  "status": "ok",
  "service": "stock-service",
  "dependencies": {
    "postgres": "ok",
    "redis": "ok"
  },
  "uptime": 12345
}
```

Returns `503 Service Unavailable` if any dependency is down:

```json
{
  "status": "degraded",
  "service": "stock-service",
  "dependencies": {
    "postgres": "down",
    "redis": "ok"
  }
}
```

### GET `/metrics`

Returns machine-readable JSON:

```json
{
  "service": "order-gateway",
  "totalOrders": 342,
  "ordersPerMinute": 18.4,
  "failedRequests": 12,
  "averageLatencyMs": 145,
  "p99LatencyMs": 890,
  "uptime": 12345,
  "timestamp": "2026-03-15T17:30:00Z"
}
```

Metrics to track per service:

- `totalOrders` — total requests processed (cumulative)
- `ordersPerMinute` — rolling order throughput over the last 60 seconds (rate, not count)
- `failedRequests` — count of 5xx responses and request timeouts
- `averageLatencyMs` — rolling average of response times
- `p99LatencyMs` — 99th percentile latency
- `uptime` — seconds since service start

> **PDF requirement:** The metrics endpoint must expose both **failure counts (500-errors/timeouts)** and **average response latency** and **order throughput**. All three are mandatory.

---

## 5. Frontend — Student UI

**Port:** `5173` (Vite) or `3000`  
**Technology:** React + Vite (TypeScript preferred)  
**Styling:** Tailwind CSS

Single-page application with three views:

### View 1: Login Screen

- Student ID input field
- Password input field
- "Login" button
- Error display for invalid credentials
- Error display for rate limit (429)
- On success: store JWT in memory (not localStorage), navigate to Order screen

### View 2: Order Placement Screen

- Display logged-in Student ID
- Show available Iftar items with current stock count (fetched from Order Gateway → Stock Service)
- "Add to Order" button per item
- "Place Order" button — sends POST `/order` with Bearer token
- Disabled state / spinner while order is being submitted
- On 202 response: navigate to Status Tracker view

### View 3: Live Order Status Tracker

- Order ID display
- Real-time status pipeline visualization:

  ```
  [PENDING] → [STOCK VERIFIED] → [IN KITCHEN] → [READY ✓]
  ```

  Each stage lights up as SSE events arrive from Notification Hub
- Each stage shows a timestamp when it was reached
- "Order Ready!" celebration state when final status is READY
- Reconnects automatically if SSE connection drops

---

## 6. Frontend — Admin Monitoring Dashboard

**Port:** `5174` or served at `/admin` route  
**Technology:** React (same repo or separate)

### Health Grid

- One card per service (Identity Provider, Order Gateway, Stock Service, Kitchen Queue, Notification Hub)
- Card color: Green (`#22c55e`) if `/health` returns 200, Red (`#ef4444`) if 503 or unreachable
- Polls every 5 seconds
- Shows service name, status text ("Healthy" / "Down"), and last checked time

### Live Metrics Panel

- Fetches `/metrics` from each service every 3 seconds
- Displays per service:
  - Total Orders Processed
  - Orders Per Minute (throughput rate — required by PDF)
  - Failed Requests (5xx + timeouts)
  - Avg Latency (ms)
- Line chart showing latency over the last 60 seconds (use Recharts or Chart.js)
- Second line chart showing order throughput (orders/min) over the last 60 seconds
- **Visual Alert:** If Order Gateway average response time exceeds 1000ms over a rolling 30-second window, display a flashing red banner: "⚠️ Gateway Latency Alert: Response time exceeds 1s threshold"

### Chaos Toggle

- One "Kill" button per service
- Clicking "Kill" sends a `POST /admin/kill` request to that service
- The service responds by closing its DB/Redis connections and returning 503 on all subsequent requests (simulating crash)
- Each service also has a `POST /admin/revive` endpoint to restore it
- Dashboard shows the service card immediately turn red
- Tests fault isolation: killing Notification Hub should not affect order placement

---

## 7. Docker Compose Configuration

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: devsprint
      POSTGRES_PASSWORD: devsprint
      POSTGRES_DB: cafeteria
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U devsprint"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

  identity-provider:
    build: ./services/identity-provider
    ports:
      - "3001:3001"
    environment:
      JWT_SECRET: supersecretjwtkey
      DATABASE_URL: postgres://devsprint:devsprint@postgres:5432/cafeteria
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  order-gateway:
    build: ./services/order-gateway
    ports:
      - "3002:3002"
    environment:
      JWT_SECRET: supersecretjwtkey
      REDIS_URL: redis://redis:6379
      STOCK_SERVICE_URL: http://stock-service:3003
      KITCHEN_QUEUE_URL: http://kitchen-queue:3004
    depends_on:
      - redis
      - identity-provider

  stock-service:
    build: ./services/stock-service
    ports:
      - "3003:3003"
    environment:
      DATABASE_URL: postgres://devsprint:devsprint@postgres:5432/cafeteria
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  kitchen-queue:
    build: ./services/kitchen-queue
    ports:
      - "3004:3004"
    environment:
      REDIS_URL: redis://redis:6379
      NOTIFICATION_HUB_URL: http://notification-hub:3005
    depends_on:
      - redis

  notification-hub:
    build: ./services/notification-hub
    ports:
      - "3005:3005"
    environment:
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis

  student-ui:
    build: ./frontend/student-ui
    ports:
      - "5173:5173"
    environment:
      VITE_GATEWAY_URL: http://localhost:3002
      VITE_NOTIFICATION_URL: http://localhost:3005
      VITE_AUTH_URL: http://localhost:3001

  admin-dashboard:
    build: ./frontend/admin-dashboard
    ports:
      - "5174:5174"
    environment:
      VITE_IDENTITY_URL: http://localhost:3001
      VITE_GATEWAY_URL: http://localhost:3002
      VITE_STOCK_URL: http://localhost:3003
      VITE_KITCHEN_URL: http://localhost:3004
      VITE_NOTIFICATION_URL: http://localhost:3005

volumes:
  postgres_data:
```

**Network Isolation Requirement:**  
All services must communicate exclusively over the Docker internal network. No service should be reachable from outside Docker except through its mapped host port. Add a named network to enforce this:

```yaml
networks:
  cafeteria-net:
    driver: bridge
```

Add `networks: [cafeteria-net]` to every service, and add `networks: [cafeteria-net]` at the bottom of the compose file. Services must reference each other by service name (e.g., `http://stock-service:3003`), never by `localhost`.

**Every service Dockerfile** must follow this pattern:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE <PORT>
CMD ["node", "src/index.js"]
```

---

## 8. CI/CD Pipeline

File: `.github/workflows/ci.yml`

```yaml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: devsprint
          POSTGRES_PASSWORD: devsprint
          POSTGRES_DB: cafeteria_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-retries 5
      
      redis:
        image: redis:7
        ports:
          - 6379:6379

    strategy:
      matrix:
        service: [identity-provider, order-gateway, stock-service, kitchen-queue, notification-hub]

    steps:
      - uses: actions/checkout@v4
      
      - name: Use Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: services/${{ matrix.service }}/package-lock.json
      
      - name: Install dependencies
        working-directory: services/${{ matrix.service }}
        run: npm ci
      
      - name: Run unit tests
        working-directory: services/${{ matrix.service }}
        run: npm test
        env:
          NODE_ENV: test
          DATABASE_URL: postgres://devsprint:devsprint@localhost:5432/cafeteria_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker images
        run: docker compose build
```

**The pipeline must:**

- Run on every push to `main`
- Run tests for all services in parallel (matrix strategy)
- Fail the entire pipeline if any test fails
- Build Docker images only after all tests pass

---

## 9. Unit Tests Required

### Order Gateway — Order Validation Tests (`order-gateway/tests/orderValidation.test.js`)

```javascript
// Must cover:
describe('Order Validation', () => {
  test('rejects request with missing Authorization header → 401')
  test('rejects request with expired JWT → 401')
  test('rejects request with malformed JWT → 401')
  test('rejects request when cache shows zero stock → 409')
  test('accepts valid token and available stock → forwards order')
  test('returns cached response for duplicate idempotency key')
})
```

### Stock Service — Stock Deduction Tests (`stock-service/tests/stockDeduction.test.js`)

```javascript
// Must cover:
describe('Stock Deduction', () => {
  test('decrements stock correctly for valid order')
  test('rejects decrement when stock is zero → 409')
  test('rejects decrement when quantity exceeds available stock → 409')
  test('handles concurrent decrements via optimistic locking — no over-sell')
  test('is idempotent — same orderId does not double-decrement')
  test('increments version on each successful decrement')
})
```

Use Jest (Node.js) or pytest (Python). Tests must be runnable via `npm test` or `pytest`.

---

## 10. Inter-Service Communication Summary

```
Student Browser
    │
    ├─── POST /auth/login ──────────────→ Identity Provider (3001)
    │         ← JWT token
    │
    ├─── POST /order (Bearer JWT) ──────→ Order Gateway (3002)
    │         │  1. Validate JWT
    │         │  2. Check Redis cache for stock
    │         │  3. POST /stock/:id/decrement ──→ Stock Service (3003)
    │         │  4. POST /queue/order ──────────→ Kitchen Queue (3004)
    │         ← 202 Accepted
    │
    └─── GET /events/:studentId (SSE) ──→ Notification Hub (3005)
              ↑
              Kitchen Queue publishes status events via Redis Pub/Sub
```

---

## 11. Environment Variables Reference

| Variable | Used By | Description |
|----------|---------|-------------|
| `JWT_SECRET` | Identity Provider, Order Gateway | Shared JWT signing secret |
| `DATABASE_URL` | Identity Provider, Stock Service | PostgreSQL connection string |
| `REDIS_URL` | All services | Redis connection string |
| `STOCK_SERVICE_URL` | Order Gateway | Internal URL to Stock Service |
| `KITCHEN_QUEUE_URL` | Order Gateway | Internal URL to Kitchen Queue |
| `NOTIFICATION_HUB_URL` | Kitchen Queue | Internal URL to Notification Hub |
| `PORT` | All services | Listening port |
| `NODE_ENV` | All services | `development` / `test` / `production` |

---

## 12. Database Schema

### Identity Provider DB

```sql
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  attempted_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_login_attempts_student_time ON login_attempts(student_id, attempted_at);
```

### Stock Service DB

```sql
CREATE TABLE stock (
  item_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  quantity INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE processed_orders (
  order_id VARCHAR(50) PRIMARY KEY,
  item_id VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW()
);

-- Seed data
INSERT INTO stock (item_id, name, description, quantity) VALUES
  ('iftar-box-1', 'Iftar Deluxe Box', 'Date, soup, main, dessert', 100),
  ('iftar-box-2', 'Iftar Light Box', 'Date, soup, salad', 150),
  ('drinks-pack', 'Drinks Pack', 'Water + Juice', 200);
```

---

## 13. Redis Key Schema

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `stock:<itemId>` | String | 60s | Cached stock count |
| `idempotency:<key>` | String | 86400s | Cached order response |
| `ratelimit:<studentId>` | List | 60s | Login attempt timestamps |
| `orders:<orderId>` | Hash | 3600s | Order state tracking |
| `channel:notify:<studentId>` | Pub/Sub | — | SSE notification channel |

---

## 14. Bonus Implementations (Optional but Scored)

### B1. Cloud Deployment

- Deploy all services to Railway, Render, AWS ECS, or GCP Cloud Run
- Provide a public URL for judges
- Update `VITE_*` env vars in frontend to point to cloud URLs

### B2. Visual Latency Alerts

- In Admin Dashboard, maintain a 30-second rolling window of Order Gateway response times
- If average > 1000ms: show flashing red banner `⚠️ Gateway Latency Alert`
- Implement using a circular buffer of the last 30 metric samples (polled every 1s)

### B3. Rate Limiting on Identity Provider

- Already described in section 3.1
- Implementation: sliding window in Redis using a sorted set or list
- Key: `ratelimit:<studentId>`, store timestamps, remove entries older than 60s, count remaining

---

## 15. Judging Checklist

The following will be verified by judges:

**Core System**

- [ ] `docker compose up` starts the entire system without errors
- [ ] All services communicate over Docker internal network using service names, not localhost
- [ ] Student can log in and receive a JWT
- [ ] Request without token returns 401
- [ ] Placing an order with a valid token succeeds and returns 202 in under 2 seconds

**Resilience & Fault Tolerance**

- [ ] Order status transitions (Pending → Stock Verified → In Kitchen → Ready) are visible in real-time on Student UI via SSE — no polling
- [ ] Killing Notification Hub does not break order placement (fault isolation)
- [ ] Killing Kitchen Queue does not prevent the frontend from showing a partial status
- [ ] Killing any single service does not cascade and crash the others
- [ ] Partial failure idempotency: if Stock Service crashes after decrement but before response, retrying the same orderId does NOT double-decrement

**Stock & Concurrency**

- [ ] Stock cannot go below zero under simultaneous high load (optimistic locking works)
- [ ] Cache-first check: when Redis cache shows zero stock, request is rejected without hitting the database

**Observability**

- [ ] `/health` endpoints return 200 when healthy and 503 when a dependency is down
- [ ] `/metrics` endpoints return totalOrders, ordersPerMinute (throughput), failedRequests, and averageLatencyMs
- [ ] Admin Health Grid correctly shows Green/Red per service, updates within 5 seconds of a kill
- [ ] Admin Live Metrics shows real-time latency and order throughput charts
- [ ] Chaos Toggle kills and revives each service individually

**CI/CD**

- [ ] CI pipeline triggers on push to main
- [ ] Pipeline fails if any unit test fails
- [ ] Unit tests cover order validation (401 for missing/invalid token)
- [ ] Unit tests cover stock deduction (no over-sell, idempotency)

**Bonus**

- [ ] Rate limiter blocks the 4th login attempt within 60 seconds (returns 429)
- [ ] Visual latency alert triggers when Gateway avg latency > 1s over 30s window
- [ ] System is accessible via a public cloud URL

---

## 16. PDF Requirements Traceability Matrix

This table maps every explicit requirement from the DevSprint 2026 problem statement to the section in this spec that implements it. Use this as a final checklist before submission.

| PDF Section | Requirement | Spec Section |
|-------------|-------------|--------------|
| §2 Table | Identity Provider issues secure JWT tokens | §3.1 |
| §2 Table | Order Gateway: mandatory Token Validation | §3.2 — Token Validation |
| §2 Table | Order Gateway: High-Speed Cache Stock Check | §3.2 — Cache-First Stock Check Logic |
| §2 Table | Stock Service: Optimistic Locking for concurrency | §3.3 — Concurrency Control |
| §2 Table | Stock Service: prevent over-selling | §3.3 — Optimistic Locking + §9 Unit Tests |
| §2 Table | Kitchen Queue: acknowledges orders < 2s | §3.4 — 202 immediate response |
| §2 Table | Kitchen Queue: decouples acknowledgment from execution (3-7s) | §3.4 — Async Processing Flow |
| §2 Table | Notification Hub: push status updates, eliminate client polling | §3.5 — SSE, no-polling requirement |
| §2 N.B. | Single `docker compose up` command | §7 — Docker Compose |
| §3A | Client authenticates with Identity Provider, receives token | §3.1 — /auth/login |
| §3A | Order Gateway rejects missing token with 401 Unauthorized | §3.2 — Token Validation |
| §3B | Idempotency: partial failure where service crashes before responding | §3.3 — Critical PDF requirement callout |
| §3B | Async processing: Kitchen Service decouples acknowledgment | §3.4 — Async Processing Flow |
| §3C | Cache layer in front of Stock Service | §3.2 — Cache-First Logic |
| §3C | Cache zero stock = instant reject, no DB hit | §3.2 — step 3 of cache logic |
| §3D | Unit tests for Order Validation logic | §9 — Order Gateway tests |
| §3D | Unit tests for Stock Deduction logic | §9 — Stock Service tests |
| §3D | Automated pipeline on every push to main | §8 — CI/CD Pipeline |
| §3D | Build fails if any test fails | §8 — CI/CD Pipeline |
| §4 | Every service: health endpoint (200 OK / 503) | §4 — Health Endpoints |
| §4 | Every service: metrics (total orders, failure counts, avg latency) | §4 — Metrics Endpoints |
| §5 UI | Authentication: secure login to obtain token | §5 — View 1 Login |
| §5 UI | Order Placement: authenticated trigger for Iftar flow | §5 — View 2 Order |
| §5 UI | Live Status: Pending → Stock Verified → In Kitchen → Ready | §5 — View 3 Status Tracker |
| §5 Admin | Health Grid: Green/Red per microservice | §6 — Health Grid |
| §5 Admin | Live Metrics: real-time latency and order throughput | §6 — Live Metrics Panel |
| §5 Admin | Chaos Toggle: manually kill a service | §6 — Chaos Toggle + every service /admin/kill |
| §6 Bonus | Cloud deployment | §14 — B1 |
| §6 Bonus | Visual alert if Gateway latency > 1s over 30s window | §14 — B2 + §6 Live Metrics |
| §6 Bonus | Rate limiting: 3 login attempts per minute per Student ID | §3.1 — Rate Limiting + §14 — B3 |
