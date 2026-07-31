# auth-service

Handles user registration, login, logout, and JWT-based authentication
for the e-commerce platform. Owns its own PostgreSQL database
(`auth_service_db`) — no other service is allowed to query it directly.

## Responsibilities

- Register new users (hashes password with bcrypt before storing)
- Login (issues an access token + refresh token)
- Refresh access tokens (with refresh token rotation + reuse detection)
- Logout (revokes the refresh token)
- Expose a `requireAuth` / `requireAdmin` pattern other routes in this
  service use to protect endpoints

## Tech stack

- Node.js + Express + TypeScript
- PostgreSQL via `pg` (raw parameterized SQL, no ORM)
- Hand-rolled SQL migrations (`migrations/*.sql` + `runMigrations.ts`)
- Auth: JWT access token (15 min) + opaque refresh token (7 days),
  both delivered as `httpOnly` cookies

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in real values
cp .env.example .env

# 3. Make sure Postgres is running and the database from
#    PGDATABASE in .env has been created, e.g.:
#    createdb auth_service_db

# 4. Run migrations (creates users + refresh_tokens tables)
npm run migrate:dev

# 5. Start the service in dev mode (hot reload)
npm run dev
```

Service runs on `http://localhost:4001` by default (see `PORT` in `.env`).

## Production build

```bash
npm run build     # compiles src/ -> dist/
npm run migrate    # runs compiled migration script
npm start          # runs compiled server
```

## API endpoints

| Method | Path                  | Auth required | Description                              |
|--------|------------------------|:--:|-------------------------------------------|
| POST   | `/api/auth/register`   | No | Create a new user, returns user + sets auth cookies |
| POST   | `/api/auth/login`      | No | Log in, returns user + sets auth cookies  |
| POST   | `/api/auth/refresh`    | No (reads refresh cookie) | Rotates tokens, sets new auth cookies |
| POST   | `/api/auth/logout`     | No (reads refresh cookie) | Revokes refresh token, clears cookies |
| GET    | `/api/auth/me`         | Yes (access token cookie) | Returns the current logged-in user |
| GET    | `/health`              | No | Basic liveness check |

## Environment variables

See `.env.example` for the full list with comments — includes DB
connection details, connection pool tuning, and JWT/token settings.

## Notes for future me / interview talking points

- Database-per-service: this service's tables (`users`, `refresh_tokens`)
  are never queried directly by other services — they'd call this
  service's API instead.
- Refresh tokens are stored **hashed** (SHA-256), never in plain text —
  same reasoning as password hashing, but a faster algorithm since the
  token is already high-entropy random data, not a guessable password.
- Refresh token **rotation**: every refresh issues a new refresh token
  and revokes the old one. Reusing an already-rotated token triggers
  full session revocation for that user (theft response).