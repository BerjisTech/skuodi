# Kouru — Architectural Design & Collaboration Platform

Kouru is a monorepo (Nx) delivering a collaborative architectural design suite with a real-time 2D CAD editor, live-synced 3D viewer, presence cursors, and voice/video powered by LiveKit. The stack is designed to be self-hosted end-to-end using Docker Compose and includes a marketplace for plans and assets plus contextual comments and lightweight task management.

## Tech Stack

- **Frontend:** Angular 17, Tailwind CSS, RxJS, socket.io-client, three.js
- **Backend:** NestJS (Node 22), TypeORM, PostgreSQL, Redis, JWT auth, LiveKit server SDK
- **Realtime:** Yjs (via y-websocket container) + Socket.IO presence gateway
- **Storage:** S3-compatible (MinIO by default)
- **Infra:** Docker Compose (Postgres 18, Redis 7-alpine, MinIO, LiveKit, Coturn, Nginx proxy)

## Monorepo Layout

```
apps/
  api/           # NestJS backend application
  web/           # Angular frontend (standalone components + Tailwind)
libs/
  collab/        # Angular CursorService & realtime helpers
  geometry/      # clipper-lib + earcut utilities for 2D → 3D pipelines
  livekit/       # Angular LiveKit client service
  three/         # three.js scene builder helpers
ops/
  nginx.conf     # Reverse proxy config
  livekit.yaml   # LiveKit server configuration
```

Database schema and migrations live under `apps/api/src/database`. Sequential TypeORM migrations (see `apps/api/src/database/migrations`) mirror the schema described in the project brief (spaces, projects, docs, assets, comments, tasks, etc.).

## Getting Started

### Prerequisites

- Node.js 22+
- Yarn 1.22+
- Docker & Docker Compose

### Install dependencies

```bash
yarn install
```

### Local development (without Docker)

In separate terminals:

```bash
yarn start:api   # Runs NestJS API on http://localhost:3001
yarn start:web   # Runs Angular dev server on http://localhost:4200 (proxied to API)
```

You’ll need Postgres, Redis, MinIO, and LiveKit running locally or via Docker. For a complete stack, use the provided compose file.

### Full stack via Docker Compose

Copy the example environment and adjust as needed:

```bash
cp .env.example .env
```

Then bootstrap everything (database, redis, minio, livekit, yjs, backend, frontend, nginx) with:

```bash
docker compose up --build
```

- Web UI: http://localhost
- API: http://localhost/api
- LiveKit WS: ws://localhost/livekit
- Yjs websocket: ws://localhost/yjs

### Database Schema & Migrations

Run pending migrations (the helper ensures Docker Desktop/Engine is running and brings up the docker-compose database services automatically):

```bash
yarn db:migrate
```

For local workflows you can also use the convenience wrapper in `scripts/db-migrate.sh`. It boots the required Docker services (Postgres, Redis, MinIO, plus LiveKit/Yjs when defined) and proxies the TypeORM CLI to your host environment:

```bash
./scripts/db-migrate.sh run      # apply new migrations
./scripts/db-migrate.sh status   # list applied migrations
./scripts/db-migrate.sh revert   # roll back the last migration
```

That command keeps track of executed migrations inside the `kouru_schema_migrations` table (similar to Rails). To add a new migration:

```bash
# example: create 2D tools table
yarn typeorm migration:generate apps/api/src/database/migrations/$(date +%Y%m%d%H%M%S)-AddTools -d apps/api/typeorm.config.ts
```

Entities live in `apps/api/src/app/database/entities` and stay in sync with the migrations. Roll back the most recent one with `yarn db:migrate:revert`, or inspect the migration table using `yarn db:migrate:status`.

## Backend Highlights

- JWT auth (`/auth/signup`, `/auth/login`, `/auth/me`)
- Space management with invites, roster, and roles (`/spaces`, `/spaces/:id/members`, `/spaces/:id/invite`)
- Project lifecycle with seeded Yjs docs (`/projects`, `/projects/:id`, `/projects/:id/docs/...`)
- Marketplace & asset uploads with S3 presigned URLs (`/assets`, `/assets/upload-url`)
- Comments & tasks (`/comments`, `/tasks`)
- LiveKit token minting (`/rtc/token`) using the backend LiveKit service
- Socket.IO presence gateway at `/presence`
- Import/export stubs prepared at `/import/*` and `/export/*`

## Frontend Highlights

- Angular routes matching the brief:
  - `/login`, `/signup`
  - `/spaces`, `/spaces/:spaceId`, `/spaces/:spaceId/projects/:projectId/edit`
  - `/marketplace`, `/marketplace/:id`
  - `/account`, `/admin`
- Tailwind-driven UI with reusable button styles and dark theme
- `AuthService` manages JWT lifecycle and exposes auth state across the app
- Workspace dashboard shows members, projects, and LiveKit join controls
- Editor screen renders a split 2D/3D view, hooks into the geometry & three libs, and broadcasts cursors
- Marketplace list & detail pages consuming asset endpoints

## Libraries

- `@kouru/collab` – CursorService wraps socket.io-client for presence overlays
- `@kouru/geometry` – Utilities to convert wall segments to polygons, subtract openings, and triangulate meshes (clipper-lib + earcut)
- `@kouru/three` – Helpers for bootstrapping three.js scenes with orbit controls and extruded geometry
- `@kouru/livekit` – Angular service that fetches tokens and connects to LiveKit rooms on demand

## Running Tests & Linting

```bash
yarn lint
yarn test
```

Each library and app has its own Jest + ESLint configuration managed through Nx.

## Deployment Notes

- `apps/api/Dockerfile` builds the Nest API and runs `node dist/main.js`
- `apps/web/Dockerfile` compiles the Angular app and serves it via nginx
- `docker-compose.yml` wires all infrastructure pieces together for self-hosted deployments
- `ops/nginx.conf` proxies `/api`, `/livekit`, and `/yjs` to their respective services
- Update `.env` with production-ready secrets (JWT, LiveKit keys, S3 credentials)

## Next Steps

- Flesh out the 2D editor with full drawing tools and Yjs bindings
- Complete asset upload + preview integrations with MinIO
- Implement payments behind the `PAYMENTS_ENABLED` flag
- Add guards for route-level auth and organization based authorization
- Expand tests (unit + e2e) and add CI workflows as needed
- Track the evolving Plan Studio roadmap in `docs/plan-studio-roadmap.md`

Happy building! 🎨
