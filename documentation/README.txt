IUT Barakah Bites - Food WebApp Documentation: README
=====================================================

Project Overview:
----------------
IUT Barakah Bites is a distributed microservices-based cafeteria order management system designed for high performance, reliability, and real-time tracking.

Tech Stack:
----------
- Frontend: React (Vite), Tailwind CSS
- Backend: Node.js (Express), BullMQ
- Database: PostgreSQL
- Cache/Messaging: Redis
- Deployment: Railway (Backend/Infra), Vercel (Frontend)
- CI/CD: GitHub Actions

System Architecture:
------------------
The system consists of 5 microservices:
1. Identity Provider: JWT-based auth and student management.
2. Order Gateway: Validates orders, checks stock cache, and coordinates.
3. Stock Service: Transactional stock management with optimistic locking.
4. Kitchen Queue: Asynchronous order processing and simulation.
5. Notification Hub: SSE-based real-time order status broadcasting.

Local Setup Instructions:
------------------------
1. Prerequisites:
   - Docker & Docker Desktop
   - Node.js 20+
   - Git

2. Environment Configuration:
   Each service contains a .env example or standard config.js. For local docker-compose, defaults are pre-configured.

3. Running with Docker Compose:
   - Command: `docker compose up --build`
   - Services available at:
     - Student UI: http://localhost:5173
     - Admin Dashboard: http://localhost:5174
     - Identity Provider: http://localhost:3001
     - Order Gateway: http://localhost:3002
     - Stock Service: http://localhost:3003
     - Kitchen Queue: http://localhost:3004
     - Notification Hub: http://localhost:3005

Development Instructions:
------------------------
- Individual service development:
  `cd services/<service-name> && npm install && npm start`
- Testing:
  `npm test` in any service directory or root to run global test matrix.

Cloud Deployment (Railway + Vercel):
----------------------------------
Backend (Railway):
1. Connect GitHub repo to Railway.
2. Create PostgreSQL and Redis plugins.
3. Add 5 Services, setting appropriate 'Root Directory' for each.
4. Bind DATABASE_URL and REDIS_URL using Railway references ${{Postgres.DATABASE_URL}}.
5. Set JWT_SECRET in identity-provider and order-gateway.

Frontend (Vercel):
1. Connect GitHub repo to Vercel.
2. Set Root Directory to /frontend/student-ui.
3. Add Environment Variables:
   - VITE_API_URL: Public URL of order-gateway.
   - VITE_AUTH_URL: Public URL of identity-provider.
   - VITE_HUB_URL: Public URL of notification-hub.
4. Deploy.

Handoff Checklist:
-----------------
- All tests pass in CI/CD pipeline.
- Database seeded via identity-provider/auth/seed.
- SSE connections working for real-time tracking.
- Admin dashboard reflecting all service metrics.
