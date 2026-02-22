# ENV_TEMPLATES

## Backend: dev/prod templates

- Dev (SQLite): `env/.env.dev.example`
- Prod (Postgres): `env/.env.prod.example`

You can copy either template to `apps/fastapi-server/.env` and then run migrations/seed.

## Frontend: next-web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
