# Implementation Plan for IUT Food WebApp

## Checklist of Phases

- [X] Phase 1: Project Setup & Infrastructure
- [X] Phase 2: Identity Provider Service
- [X] Phase 3: Order Gateway Service
- [X] Phase 4: Stock Service
- [X] Phase 5: Kitchen Queue Service
- [X] Phase 6: Notification Hub Service
- [X] Phase 7: Frontend UIs (Student UI & Admin Dashboard)
- [X] Phase 8: CI/CD Pipeline & Testing
- [/] Phase 9: Bonus Features & Cloud Deployment
- [ ] Phase 10: Documentation, Final Review & Handoff

---

## Phase 1 – Project Setup & Infrastructure

### Goals

- Initialise repository structure matching the specification.
- Add Docker‑Compose skeleton with all services, networks, and volumes.
- Verify `docker compose up` launches without errors.

### Tasks

1. Create top‑level directories: `services/identity-provider`, `services/order-gateway`, `services/stock-service`, `services/kitchen-queue`, `services/notification-hub`, `frontend/student-ui`, `frontend/admin-dashboard`, `infra`, `context`.
2. Add placeholder `Dockerfile` in each service directory following the shared pattern.
3. Write `docker-compose.yml` (see spec) with proper network (`cafeteria-net`) and service definitions.
4. Commit the skeleton and run `docker compose up` locally to ensure containers start.

### Acceptance Criteria

- All services start, health endpoints return `200 OK`.
- No port conflicts; internal communication works via service names.

---

## Phase 2 – Identity Provider Service

### Goals

- Provide JWT‑based authentication, registration, rate‑limiting, and health/metrics.

### Tasks

1. Scaffold a Node.js Express app (or FastAPI) with `src/index.js`.
2. Implement database schema (students, login_attempts) via migrations.
3. Add password hashing (bcrypt ≥10 rounds) and JWT signing (HS256 with `JWT_SECRET`).
4. Implement endpoints `/auth/login`, `/auth/register`, `/health`, `/metrics`, `/admin/kill`, `/admin/revive`.
5. Add Redis‑backed sliding‑window rate limiter (max 3 attempts/60 s).
6. Write unit tests covering registration, login success/failure, rate‑limit.

### Acceptance Criteria

- Successful login returns signed JWT.
- Exceeding rate limit returns `429`.
- All unit tests pass.

---

## Phase 3 – Order Gateway Service

### Goals

- Validate JWT, perform cache‑first stock check, forward order, support idempotency.

### Tasks

1. Scaffold service with environment variables (`JWT_SECRET`, `REDIS_URL`, `STOCK_SERVICE_URL`, `KITCHEN_QUEUE_URL`).
2. Middleware to verify Bearer token.
3. Implement Redis cache layer for `stock:<itemId>` with 60 s TTL.
4. Endpoint `POST /order`:
   - Validate token.
   - Check cache; if zero → `409`.
   - Forward to Stock Service `/stock/:id/decrement`.
   - On success, publish to Kitchen Queue and return `202`.
   - Store idempotency key in Redis (`idempotency:<key>`).
5. Write comprehensive tests for token validation, cache miss/hit, idempotency, and error handling.

### Acceptance Criteria

- Requests without token → `401`.
- Zero‑stock cache → `409` without DB hit.
- Duplicate idempotency key returns cached response.

---

## Phase 4 – Stock Service

### Goals

- Provide robust, transactional stock decrement with optimistic locking and idempotency.

### Tasks

1. Scaffold service with PostgreSQL connection.
2. Implement `stock` and `processed_orders` tables (as spec).
3. Write SQL for optimistic‑locking decrement (update with version check) and retry logic (≤3 attempts).
4. Implement idempotency check using `processed_orders` before decrement.
5. Add endpoints `/stock/:itemId`, `/stock/:itemId/decrement`, `/stock/:itemId/replenish`, health/metrics, admin chaos routes.
6. Unit tests for normal decrement, zero stock, concurrent decrement (simulate with parallel requests), and idempotency guarantee.

### Acceptance Criteria

- No over‑selling under concurrent load.
- Re‑trying same `orderId` after crash does not double‑decrement.

---

## Phase 5 – Kitchen Queue Service

### Goals

- Acknowledge orders instantly, process asynchronously, and publish status updates.

### Tasks

1. Scaffold service using BullMQ (or simple Redis list) for queue.
2. Endpoint `POST /queue/order` stores job, returns `202`.
3. Worker pulls job, simulates preparation (3‑7 s), then POSTs to Notification Hub `/notify`.
4. Health/metrics and admin chaos endpoints.
5. Tests ensuring immediate 202 response and eventual status publish.

### Acceptance Criteria

- Order acknowledgment < 2 s.
- Status events are emitted after simulated delay.

---

## Phase 6 – Notification Hub Service

### Goals

- Server‑Sent Events (SSE) push real‑time order status to clients; survive Kitchen Queue failures.

### Tasks

1. Scaffold SSE endpoint `GET /events/:studentId` maintaining open connections.
2. Internal endpoint `POST /notify` accepts status payload, pushes to appropriate SSE clients via Redis Pub/Sub.
3. Ensure `/admin/kill` does not affect existing SSE connections; they stay alive.
4. Health/metrics and admin routes.
5. Tests verifying SSE delivery and resilience.

### Acceptance Criteria

- Clients receive status updates without polling.
- Killing Kitchen Queue does not break SSE streams.

---

## Phase 7 – Frontend UIs

### Student UI (React + Vite)

- Implement login screen, order placement UI, and status tracker using EventSource.
- Store JWT in memory, use it for API calls.
- Auto‑reconnect SSE on disconnect.

### Admin Dashboard

- Health grid polling `/health` every 5 s.
- Live metrics panel fetching `/metrics` every 3 s, charting latency and throughput.
- Chaos toggle buttons per service calling `/admin/kill`/`revive`.

### Tasks

1. Scaffold both frontends with Tailwind.
2. Wire up environment variables (`VITE_*`).
3. Implement required React components and fetch logic.
4. Add visual latency alert per spec.
5. End‑to‑end manual test flow.

### Acceptance Criteria

- Full user flow works end‑to‑end.
- Admin UI reflects service health and metrics in real time.
- Chaos toggles behave as expected.

---

## Phase 8 – CI/CD Pipeline & Testing

### Goals

- Automated testing matrix and Docker image build on every push.

### Tasks

1. Create `.github/workflows/ci.yml` per spec.
2. Ensure matrix runs unit tests for each service in parallel.
3. Add build step for Docker images after successful tests.
4. Verify pipeline fails on any test failure.

### Acceptance Criteria

- GitHub Actions run on push to `main`.
- Pipeline blocks on failing tests.
- Docker images are built only after all tests pass.

---

## Phase 9 – Bonus Features & Cloud Deployment (Optional)

- Deploy the full stack to a public cloud (e.g., Railway, Render, or GCP Cloud Run).
- Update Vite env vars to point to cloud URLs.
- Implement visual latency alert (already in admin UI) if not done.
- Add rate‑limiting enhancements if not covered.

---

## Phase 10 – Documentation, Final Review & Handoff

### Tasks

- Generate README with setup, development, and deployment instructions.
- Produce architecture diagram.
- Run full end‑to‑end test script.
- Perform code‑review using `superpowers:requesting-code-review` skill.
- Create final release tag.

### Acceptance Criteria

- Documentation is complete and accurate.
- All acceptance criteria from previous phases are met.
- Code review approved, no open blockers.

---

*This plan is intentionally granular to enable automated verification at each phase, ensuring the system meets the strict judging checklist.*
