# 🌙 IUT Barakah Bites

**A Distributed Microservices Ecosystem for IUT's Cafeteria**

IUT Barakah Bites is a high-performance system designed to manage cafeteria orders through a robust, asynchronous architecture. It features 5 Dockerized microservices, a real-time React dashboard, and a focus on resilience and speed.

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Docker & Docker Desktop
- Node.js 20+

### Instruction

1. **Clone the repository**:

   ```bash
   git clone https://github.com/HyperZx2O/iut-barakahbites.git
   cd iut-barakahbites
   ```

2. **Launch with Docker Compose**:

   ```bash
   docker compose up --build
   ```

3. **Access the Application**:
   - **Student UI**: `http://localhost:5173`
   - **Admin Dashboard**: `http://localhost:5174`
   - **Order API**: `http://localhost:3002`

---

## 🏗 System Architecture

The project follows a pure microservices paradigm with event-driven updates:

- **Identity Provider**: JWT-based auth & student management.
- **Order Gateway**: Request validation, stock cache-check, and distribution.
- **Stock Service**: ACID-compliant stock management (PostgreSQL).
- **Kitchen Queue**: Async job queue (BullMQ) for order prep simulation.
- **Notification Hub**: SSE (Server-Sent Events) for real-time status tracking.

---

## ☁️ Cloud Deployment (Hybrid Model)

This project is optimized for a hybrid cloud deployment:

- **Frontend**: Hosted on **Vercel** for Global Edge performance.
- **Backend & Database**: Hosted on **Railway** for persistent long-running containers.

### Deployment Prerequisites

- Configure `VITE_API_URL`, `VITE_AUTH_URL`, and `VITE_HUB_URL` in Vercel.
- Link `DATABASE_URL` and `REDIS_URL` in the Railway dashboard.
- **Seed the Database**: Visit `/auth/seed` on your deployed identity service.

---

## 🧪 Testing & Reliability

Barakah Bites includes a built-in "Chaos Testing" mechanism through the Admin Dashboard.

- **Resilience**: Services use background initialization to survive database startup delays.
- **Persistence**: Optimized PostgreSQL schema with transactional integrity.
- **Monitoring**: Real-time health checks and throughput metrics.

---

## 📂 Project Documentation

Detailed reports are available in the `/documentation` directory:

- `Requirement Analysis.txt`: Full functional breakdown.
- `Stack Report & Justification.txt`: Technical choices and logic.
- `Dependencies & Documentation.txt`: NPM package roles and workflows.

---

## 🤖 AI Collaboration

This project was built with cutting-edge AI orchestration:

- **Antigravity AI**: Lead architect using Claude 4.6 Sonnet/Opus.
- **Claude Code**: Logic generation and debugging (gpt-oss:120B).
- **Gemini 3 Flash**: Optimization and logical flow verification.

---

*Built by Team PoweredByPatience for DevSprint Hackathon '26*
