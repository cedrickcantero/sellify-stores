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
5. Mark the test branch as a test database, once: `pnpm db:mark-test-database`
6. Start the app: `pnpm dev`, then open http://localhost:3000/signup to create a shop.

## Integration test safety

Integration tests truncate tables before every test, so two independent
checks stop them from ever touching a real database:

1. `TEST_DATABASE_URL` must be set and must name a different database from
   `DATABASE_URL`. The two are compared by host (with Neon's `-pooler`
   suffix removed), port and database name, so a pooled and a direct URL to
   the same branch count as the same database.
2. The test database must contain the marker table
   `sellify_test_database_marker`. `pnpm db:mark-test-database` creates it in
   the database at `TEST_DATABASE_URL`. The table is not part of the Drizzle
   schema, so migrations never create it anywhere else. The global setup
   refuses to migrate an unmarked database, and every truncate checks for the
   marker in the same SQL statement.

Only the integration project loads `.env.local`; unit tests run with the
database and Blob settings removed.

Integration run time is dominated by network round trips to Neon (each
query waits one round trip, and a full sign-up makes about 15 in sequence).
Each test file therefore opens two pooled connections once and reuses them,
`seedTwoShops()` writes each shop in a single statement, and the files run
one at a time against the shared test branch.

The data module raises Node's per-address connect attempt timeout (happy
eyeballs) from 250ms to 2s, because a TCP connect to a distant Neon region
can take longer than 250ms and was failing intermittently with ETIMEDOUT.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string for the app, migrations and seed. |
| `TEST_DATABASE_URL` | Neon test branch for integration tests. Must differ from `DATABASE_URL`; the tests truncate tables. |
| `BETTER_AUTH_SECRET` | Secret for signing sessions (`openssl rand -base64 32`). |
| `BETTER_AUTH_URL` | Public base URL of the app, for example `http://localhost:3000`. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for logo and product image uploads. |
| `RESEND_API_KEY` | Resend API key for sending email. Unset: `sendEmail` records the email as `failed` with a clear error and never throws. |
| `EMAIL_FROM` | Sender address for all email, on a domain verified in Resend. |
| `STRIPE_SECRET_KEY` | Stripe test-mode secret key (`sk_test_...`) for creating Checkout sessions. Read only when a customer checks out: unset, checkout shows "not available" and every other page works. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `POST /api/stripe/webhook` (`whsec_...`). Locally it is the one `stripe listen --print-secret` prints; on Vercel it is the endpoint's secret from the Stripe dashboard. Unset: the webhook answers 500 with a clear message. |
| `APP_HOST` | Host that serves the backend. `localhost` and `*.vercel.app` always count as the app host too. |
| `STORE_ROOT_DOMAIN` | Optional. Root domain whose subdomains serve stores (`<slug>.<root>`). Without it, stores are served at `/s/<slug>`. |
| `RATE_LIMIT_DISABLED` | Optional, tests only. `1` turns `rateLimit` off so suites that sign up and log in repeatedly are not refused. Ignored when `NODE_ENV=production` and on Vercel. The local Playwright server sets it. |
| `NEON_LOCAL_WS_PROXY` | Optional, local only. Routes the Neon driver to a plain local Postgres through `pnpm db:local-proxy`. |

On Vercel, set the same variables (except `TEST_DATABASE_URL` and
`NEON_LOCAL_WS_PROXY`) in the project settings.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server. |
| `pnpm build` | Lint, then build for production. A lint error fails the build. |
| `pnpm lint` | ESLint, including the rule that only `src/data` may import the database client and the rule that rejects raw colour values in backend, auth and `src/ui` files. |
| `pnpm typecheck` | Generate Next.js route types, then run `tsc`. |
| `pnpm test:unit` | Vitest unit project: pure logic and ui component behaviour, no IO. Component tests (`*.test.tsx`) start with `// @vitest-environment jsdom`. |
| `pnpm test:integration` | Vitest integration project against `TEST_DATABASE_URL`. Refuses to run unless it names a different database from `DATABASE_URL` and is marked as a test database (see above). Migrates the test database, seeds the device catalog and clears tenant data before every test. |
| `pnpm test:e2e` | Playwright smoke tests. Set `PLAYWRIGHT_BASE_URL` to test a deployed URL (and `VERCEL_AUTOMATION_BYPASS_SECRET` for protected previews); otherwise a local dev server is started. Run `pnpm exec playwright install chromium` once first. |
| `pnpm db:generate` | Generate a SQL migration in `drizzle/` from the schema in `src/data/schema`. |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL`. |
| `pnpm db:seed` | Upsert the global device catalog into `DATABASE_URL`. |
| `pnpm db:mark-test-database` | One-off: mark the database at `TEST_DATABASE_URL` as safe for integration tests to truncate. |
| `pnpm db:local-proxy` | Optional: WebSocket proxy on 127.0.0.1 so the Neon driver can reach a local Postgres. Ignored on Vercel and in production builds. |

## Code layout

| Module | Path | Role |
| --- | --- | --- |
| domain | `src/domain` | Pure logic and types, no IO (`Result`, slugs, image detection, SVG sanitising, the `StoreConfig` schema, store host rules and theme variables). |
| data | `src/data` | Database schema, the client and tenant-scoped repositories. `forShop(shopId)` is the way in; it is the only module allowed to import the database client. Other modules import only `@/data`; scripts and `src/test` may also import `@/data/maintenance`. |
| services | `src/services` | Use cases (sign-up, `uploadImage(shopId, file)` which stores under `images/<shopId>/` and sanitises SVGs, the online store: `saveDraft`, `publishStore`, `setStoreOnline`, `resolveStore`, `getStorefront`, and `rateLimit`). Take the shop id from the server, never from the browser. |
| auth | `src/auth` | Better Auth setup and `getActiveShop()` for backend pages, which also checks the user is still a member of the shop. |
| ui | `src/ui` | The Sellify platform design system: shadcn-style components on Radix primitives, restyled to the Sellify tokens in `src/app/globals.css`, plus the backend `AppShell`. Backend pages import only from `@/ui`. Rules: `CLAUDE.md`; guideline: `docs/brand/sellify.md`; gallery: `/dev/components` (dev server only). |
| store-ui | `src/store-ui` | The store surface: `StoreShell`, the offline page, `HoneypotField`. Styled only from `var(--store-*)` variables derived from the store's config; never imports `@/ui`. |
| app | `src/app` | Routes. `(auth)` for sign-up and login, `(backend)` for the shop owner's backend (its layout renders the `AppShell`), `(store)/s/[slug]` for customer-facing stores. `src/proxy.ts` rewrites store hosts (see below). |
| test | `src/test`, `e2e` | Test helpers (`seedTwoShops`), integration setup and Playwright smoke tests. |

A shop is a Better Auth organization; the shop id is the organization id, and
the backend's active shop is the session's active organization.

## Store addresses and routing

Store pages live in `src/app/(store)/s/[slug]`. Which surface a request is
for is decided from its host and path by `classifyRequest` in
`src/domain/store-host.ts`:

1. A path `/s/<slug>` resolves the store by slug on any host. This is the
   address used on Vercel previews and locally, since no store root domain
   is owned during the trial.
2. The app host is the backend: `APP_HOST`, plus `localhost`, `127.0.0.1`,
   `[::1]` and any `*.vercel.app` preview host.
3. `<slug>.<STORE_ROOT_DOMAIN>` resolves the store by slug (only when
   `STORE_ROOT_DOMAIN` is set; locally `STORE_ROOT_DOMAIN=localhost` makes
   `http://<slug>.localhost:3000` work).
4. Any other host is looked up as a verified custom domain.

`src/proxy.ts` (Next.js 16 Proxy, formerly Middleware) does host to path
rewriting only and never touches the database: a request on a store host is
rewritten to `/s/_host/<path>`. The store layout then calls
`resolveStore(host, pathname)` with the real host, so the shop id is always
resolved server-side and never taken from the browser. `_host` is not a
valid slug, so `/s/_host` on the app host is a 404. The proxy also turns a
`?preview` query into a request header (layouts cannot read search params)
and marks preview responses `no-store`; `getStorefront` still shows the
draft only to a member of the shop.

A store shows its published config only when the shop exists, the store is
online and it has been published. Otherwise it shows a branded offline page;
an address that matches no shop is a 404.

The store surface (`src/store-ui`, `src/app/(store)`) is styled only from
CSS variables derived from the store's brand settings
(`storeThemeVars` in `src/domain/store-theme.ts`). Lint forbids importing
`@/ui` there; the Sellify raw colour rule does not apply to it.

Public store forms use `rateLimit(key, { capacity, refillPerMinute })`
(a Postgres token bucket in `rate_limit_bucket`) and the `HoneypotField`
with `isHoneypotTripped(form)`. Buckets idle for a day are deleted on about
one call in 100. Login is limited per email and IP (strict), per email
(loose, so strangers cannot lock an owner out) and per IP; sign-up per IP
and per email. The client IP is `x-real-ip` (set by Vercel), falling back
to the first `x-forwarded-for` entry.

Store logos are uploaded by the signed-in owner to `POST /api/uploads/logo`
(at most 2 MB; SVGs sanitised), and only the returned URL is saved to the
draft. `saveDraft` accepts a logo URL only on this project's Blob host under
`images/<shopId>/`. Slugs `www`, `app`, `api`, `admin`, `mail`, `s` and
`_host` are reserved and never given to a shop.
