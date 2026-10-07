# Sellify Stores

Sellify Stores: storefront builder trial. One Next.js app with two surfaces: the
authenticated Sellify backend for shop owners, and public online stores that
read each shop's live Sellify data.

## Stack

Next.js (App Router, TypeScript, Tailwind), pnpm, Drizzle ORM on Neon Postgres
(serverless driver), Better Auth with the organization plugin, Vercel Blob,
Zod, Vitest and Playwright.

## Setup

1. Install dependencies: `pnpm install`
2. Create a Neon project with two branches: the main branch for the app and a
   separate branch for integration tests.
3. Copy `.env.example` to `.env.local` and fill in every variable (see below).
4. Apply migrations and seed the device catalog: `pnpm db:migrate && pnpm db:seed`
5. Start the app: `pnpm dev`, then open http://localhost:3000/signup to create a shop.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string for the app, migrations and seed. |
| `TEST_DATABASE_URL` | Neon test branch for integration tests. Must differ from `DATABASE_URL`; the tests truncate tables. |
| `BETTER_AUTH_SECRET` | Secret for signing sessions (`openssl rand -base64 32`). |
| `BETTER_AUTH_URL` | Public base URL of the app, for example `http://localhost:3000`. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for logo and product image uploads. |
| `APP_HOST` | Host that serves the backend. |
| `STORE_ROOT_DOMAIN` | Root domain whose subdomains serve stores. |
| `NEON_LOCAL_WS_PROXY` | Optional, local only. Routes the Neon driver to a plain local Postgres through `pnpm db:local-proxy`. |

On Vercel, set the same variables (except `TEST_DATABASE_URL` and
`NEON_LOCAL_WS_PROXY`) in the project settings.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server. |
| `pnpm build` | Lint, then build for production. A lint error fails the build. |
| `pnpm lint` | ESLint, including the rule that only `src/data` may import the database client. |
| `pnpm typecheck` | Generate Next.js route types, then run `tsc`. |
| `pnpm test:unit` | Vitest unit project: pure logic, no IO. |
| `pnpm test:integration` | Vitest integration project against `TEST_DATABASE_URL`. Refuses to run if it is unset or equals `DATABASE_URL`. Migrates the test database, seeds the device catalog and clears tenant data before every test. |
| `pnpm test:e2e` | Playwright smoke tests. Set `PLAYWRIGHT_BASE_URL` to test a deployed URL (and `VERCEL_AUTOMATION_BYPASS_SECRET` for protected previews); otherwise a local dev server is started. Run `pnpm exec playwright install chromium` once first. |
| `pnpm db:generate` | Generate a SQL migration in `drizzle/` from the schema in `src/data/schema`. |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL`. |
| `pnpm db:seed` | Upsert the global device catalog into `DATABASE_URL`. |
| `pnpm db:local-proxy` | Optional: WebSocket proxy so the Neon driver can reach a local Postgres. |

## Code layout

| Module | Path | Role |
| --- | --- | --- |
| domain | `src/domain` | Pure logic and types, no IO (`Result`, slugs, image detection). |
| data | `src/data` | Database schema, the client and tenant-scoped repositories. `forShop(shopId)` is the way in; it is the only module allowed to import the database client. |
| services | `src/services` | Use cases (sign-up, image upload). Take the shop id from the server, never from the browser. |
| auth | `src/auth` | Better Auth setup and `getActiveShop()` for backend pages. |
| app | `src/app` | Routes. `(auth)` for sign-up and login, `(backend)` for the shop owner's backend. |
| test | `src/test`, `e2e` | Test helpers (`seedTwoShops`), integration setup and Playwright smoke tests. |

A shop is a Better Auth organization; the shop id is the organization id, and
the backend's active shop is the session's active organization.
