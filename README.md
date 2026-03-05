# Live Negotiation AI MVP

Shared platform with two vertical products:
- `ScopeShield`: protects freelancers from scope creep and unpaid work.
- `DealPilot`: helps car buyers detect junk fees and negotiate OTD pricing.

Now includes:
- OpenAI-backed extraction/action generation with heuristic fallback.
- Postgres persistence through Prisma.
- Email/password auth with secure httpOnly cookie sessions.
- Role-based authorization (`user`, `admin`) using `ADMIN_EMAILS`.
- API and auth endpoint rate limiting (Redis-backed when `REDIS_URL` is configured).

## Quick Start

1. Copy `.env.example` to `.env` and set values.
2. Install dependencies.
3. Generate Prisma client.
4. Run migrations.
5. Start the app.

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

## One-command local stack (Docker + migrate + app)

```bash
npm run dev:local
```

This command:
- starts PostgreSQL + Redis via Docker Compose,
- waits for database readiness and applies migrations,
- starts the app in watch mode.

## Seed Admin User

Set these environment variables (for example in `.env`):
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_ADMIN_NAME` (optional)

Then run:

```bash
npm run seed:admin
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: required in production; used for session token signing.
- `OPENAI_API_KEY`: enables LLM extraction/action generation.
- `OPENAI_MODEL`: optional, defaults to `gpt-4o-mini`.
- `ADMIN_EMAILS`: comma-separated emails granted `admin` role.
- `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX`: global API limiter.
- `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`: auth route limiter.
- `REDIS_URL`: enables distributed rate limit state shared across instances.
- `API_RATE_LIMIT_PREFIX`, `AUTH_RATE_LIMIT_PREFIX`: Redis key prefixes for limiters.
- `SESSION_COOKIE_NAME`, `SESSION_TTL_SECONDS`, `PORT`.

If `OPENAI_API_KEY` is missing, the app automatically uses deterministic heuristic extraction.
If `DATABASE_URL` is missing, the app falls back to in-memory persistence.

## API

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Copilot (auth required)
- `POST /api/ingest`
- `GET /api/cases?vertical=scope-shield|deal-pilot`
- `GET /api/cases/:caseId`
- `POST /api/cases/:caseId/actions/:actionId/execute`

### Admin (auth + admin role required)
- `GET /api/admin/health`

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check
```
