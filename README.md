# Production-Ready Node.js Base Backend Template

This repository is a clean, production-ready, and highly scalable **Base Backend Template** built with Node.js, Express, Prisma, Redis, Socket.io, BullMQ, and Prometheus. It serves as a robust starting point for building modular, high-performance APIs.

---

## 🚀 Key Features

*   **🔒 Auth & Session Management**:
    *   JWT-based session authentication with Access/Refresh token rotation.
    *   Refresh token reuse detection & immediate multi-session invalidation.
    *   OAuth integration out-of-the-box (Google, GitHub, LinkedIn) via Passport.
    *   Secure cookie handling (`HttpOnly`, `Secure`, `SameSite`).
*   **📊 Advanced Observability & Telemetry**:
    *   **Trace ID Propagation**: Automatic tracing from HTTP requests through event emissions and database transactions using native `AsyncLocalStorage` (no manual `traceId` argument passing).
    *   **Prometheus Metrics**: Built-in `/metrics` endpoint tracking API durations, error ratios, database transaction profiles, and Redis cache hit ratios.
    *   **Structured Logging**: Winston-based log rotating mechanism writing formatted logs.
*   **📡 Distributed Event Bus & Sockets**:
    *   **Dual-Mode Event Bus**: Gracefully routes local node events or distributes them horizontally across server clusters using Redis Pub/Sub.
    *   **Real-time Sockets**: Socket.io server integrated with the Redis adapter to support multi-instance load balancing.
*   **📦 Async Queuing & Background Tasks**:
    *   Generic BullMQ background worker thread framework connected to the core Redis connection.
    *   Supports concurrency controls, retry limits with exponential backoff, and graceful shutdowns.
*   **📧 Transactional Email Service**:
    *   Nodemailer wrapper supporting SMTP in production.
    *   Automatically falls back to a **Console Log Mock Mode** in local development, preventing email spamming during test sessions.
*   **⚡ Caching Layer**:
    *   Generic Express middleware for API response caching.
    *   Database-level user profile cache warmups in Redis.
*   **🛡️ Database Resiliency**:
    *   Prisma schema organization using the schema folders preview feature (`prisma/schema/*.prisma`).
    *   Database transactional wrapper with automatic query retries on serialization conflicts/deadlocks.

---

## 📂 Project Directory Structure

```text
├── deploy/                  # Deployment assets (Nginx config, etc.)
├── prisma/                  # Database modeling
│   ├── schema/              # Modular Prisma schema folder
│   │   ├── config.prisma    # Global client/db properties
│   │   └── user.prisma      # Core User and Auth schema
│   └── seed.js              # Standard database seeding routine
├── scripts/                 # Administration/maintenance scripts
├── src/                     # Core Application Source Code
│   ├── api/                 # Express Layer
│   │   ├── middleware/      # Auth validation, Rate limits, Timeout guards, Trace ID tracking
│   │   └── routes/          # Health check, Metrics, and OAuth routers
│   ├── core/                # Core Services Configuration
│   │   ├── cache/           # CacheManager, UserCache, Redis client instance
│   │   ├── config/          # Environment validation (Zod schema), DB wrapper, Socket.io core
│   │   ├── email/           # Nodemailer transport & EmailService
│   │   ├── events/          # DualModeEventBus, event types registry, listener bindings
│   │   ├── logger/          # Structured logger & AsyncLocalStorage context manager
│   │   ├── metrics/         # Prometheus registry & system metrics collectors
│   │   └── queue/           # BullMQ QueueService & worker process
│   ├── integrations/        # External integrations
│   │   ├── s3/              # AWS S3 / Cloudflare R2 file uploader
│   │   └── socket/          # Socket.io connection bindings and middleware
│   ├── modules/             # Business Logic Modules
│   │   └── auth/            # Authentication routers, controllers, and schemas
│   ├── app.js               # Application setup (middlewares and base routers)
│   ├── index.js             # API entrypoint
│   └── server.js            # Database and Cache boots, Server setup
├── Dockerfile               # Production multi-stage Docker build config
├── ecosystem.config.cjs     # PM2 production multi-process daemon config
└── package.json             # Pruned base template dependencies
```

---

## 🛠️ Getting Started

### 1. Prerequisites
Ensure you have the following installed locally:
*   [Node.js](https://nodejs.org/) (v18+ recommended)
*   [PostgreSQL](https://www.postgresql.org/)
*   [Redis](https://redis.io/) (or Valkey)

### 2. Installation
Clone the workspace and run the following in the project root:
```bash
npm install
```

### 3. Environment Configuration
Copy `.env` to configure your environment variables:
```bash
cp .env .env.development
```
Edit the `.env.development` file to include your database connection details, Redis settings, OAuth keys, and SMTP server credentials.

### 4. Database Setup & Client Generation
Build the database tables and compile the local Prisma Client:
```bash
# Generate the Prisma client
npx prisma generate

# Apply migrations and build schema locally
npx prisma migrate dev

# Seed baseline data (Admin user)
npx prisma db seed
```

### 5. Running the Application
To run the main API server in development mode (with nodemon):
```bash
npm run dev
```

To run the background queue worker process:
```bash
node src/core/queue/worker.js
```

---

## 🚀 Production Deployment

### PM2 Process Manager
Deploy both the API server load balancer and the background worker process using the PM2 configurations:
```bash
pm2 start ecosystem.config.cjs
```
This spawns:
*   `base-backend-api` (API node)
*   `base-backend-worker` (Async task worker queue runner)

### Docker Build
A multi-stage container build is defined in the [Dockerfile](file:///d:/Projects/base-backend/backend/Dockerfile):
```bash
# Build the production image
docker build -t base-backend:latest .

# Run the container
docker run -d -p 4000:4000 --env-file .env.production base-backend:latest
```

### Nginx Proxy Config
Use the provided [nginx.conf](file:///d:/Projects/base-backend/backend/deploy/nginx.conf) setup to proxy traffic from port 80/443 to the backend API instance, supporting active WebSocket handshakes and rate-limiting rules.
