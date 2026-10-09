# Sellify Stores: done, not done, next

Trial hand-in notes for Ryan McDaid. The brief asked for four parts working
properly over eight half working, so I built priorities 1 to 4 completely,
tested them, and wrote up the rest as designs instead of half-building them.

## Links

- **Live demo store:** https://sellify-stores.vercel.app/s/fixit-galway
- **Sellify backend:** https://sellify-stores.vercel.app/login (FixIt Galway
  login sent separately by email). You can also create your own shop at
  https://sellify-stores.vercel.app/signup and publish a store in a few minutes.
- **Brand guidelines:** `docs/brand/sellify.md` (platform) and
  `docs/brand/fixit-galway.md` (demo store, logo in
  `docs/brand/fixit-galway-logo.svg`).
- **AI rules file:** `CLAUDE.md`.
- **Spec and tickets:** GitHub issue #1 (spec) and #2 to #19 (one per ticket,
  each closed with notes on the interfaces it produced).

Payments are Stripe test mode. Pay with card `4242 4242 4242 4242`, any
future expiry date and any CVC.

## Done

| Brief | What works |
| --- | --- |
| **Part 1** Sellify platform guideline | Written guideline from sellify.market (colours with codes, type scale, spacing, radius, shadows, layout, logo, tone). Shared components in `src/ui`: Button, Pill, FilterBar, Input, Select, Table, Card, Modal, StatusBadge, PageHeader, plus Switch, Alert, StatCard and ColorInput, with a gallery at `/dev/components` (dev server). All eight backend pages (Dashboard, Inventory, POS, Repairs, Buybacks, Sales, Online Store, Email outbox) use only these. `CLAUDE.md` tells AI tools how to build a new page, and ESLint fails the build on raw colour values in backend files, so drift is caught automatically. |
| **2.1** Publish a store | Online Store page with a publish button and an online/offline switch. Each shop gets a live address (`/s/<slug>`, or `<slug>.<root domain>` when a store root domain is configured). Every store reads only its own shop's data: the shop is resolved on the server from the address, never from the browser, and all data access goes through one shop-scoped data module (enforced by an ESLint rule and covered by tenant-isolation tests). |
| **2.5** Editing | Logo, four brand colours, font pair, corner radius, banner, about text, contact details, opening hours, repair booking settings and tab visibility. Edits autosave to a draft; Preview shows the draft only to members of that shop; customers see nothing until Publish. |
| **2.3** Repair tab | Brand, model and repair type from the shop's repair prices; price from Sellify; "Same-day repair available" when the part is in stock; a day and time from the shop's opening hours, in the shop's timezone; booking creates a repair ticket and emails both the shop and the customer. Double booking is prevented in the database. |
| **2.4** Sell tab | Model, storage and condition questions; the offer is calculated on the server from the shop's buyback prices and stored on the quote, so the customer cannot change it; drop-in acceptance creates the buyback record and emails both sides. Quotes expire after 7 days. |
| **2.2** Shop tab | Product listing, product page, basket and Stripe Checkout (test mode). Prices always come from the database, never the browser. An online order reduces stock and appears as a sale; a POS sale makes the item sold out online straight away. If stock runs out while a customer is paying, the order is flagged "Needs refund" on the Sales page and both sides are emailed. |
| **2.9** Demo store | FixIt Galway, with its own guideline (teal, sand and coral, Roboto Slab, a friendly local tone), set up entirely through the backend: products with photos, repair and buyback prices, brand, banner, about, hours, then published. All three tabs work with demo data, and the emails are real (sent through Resend). |
| Dashboard | Today's sales, upcoming repairs, buybacks waiting to be received and store status, in the shop's timezone. |

### How it was checked

- 417 unit tests and 244 integration tests against a real Postgres
  database (Neon), including tenant isolation, price tampering, concurrent
  bookings and checkouts, Stripe webhook replays, and stock running out
  mid-payment.
- Each ticket had an independent code review (correctness, repo standards,
  spec), with fix rounds until nothing Critical or Important was left.
- A full browser run-through locally and on the live site: sign up, set up a
  shop, publish, book a repair, accept a buyback, buy with a test card, and a
  POS sale making an item sold out online.
- The brief's consistency test, measured: on all eight backend pages, filter
  pills are 28px with 12px text, the primary button is the same purple, 40px
  high with 8px corners, page titles are 24px bold, and the content column and
  padding match.

### Key decisions

- **One Next.js app for backend and stores**, on Vercel in Frankfurt next to
  the Neon database. Store pages render per request, so "sold out straight
  away" never depends on clearing a cache.
- **Shop isolation by construction:** only `src/data` may touch the database,
  and every query is scoped to a shop id that comes from the session (backend)
  or the store address (stores).
- **Money and prices on the server:** integer cents, prices read from the
  database at the moment of the action, baskets hold only product ids and
  quantities.
- **Payments:** the webhook verifies Stripe's signature; fulfilment is one
  transaction keyed by the Stripe session, so a repeated webhook cannot create
  a second sale; stock rows are locked in a fixed order so online and POS sales
  cannot deadlock. A paid order is always recorded, even if it cannot be
  fulfilled.
- **Emails** are sent only after the database change commits and recorded in
  an Email outbox the owner can see; an email failure never fails a booking or
  an order.
- **Abuse:** booking, quote and checkout are rate limited per IP and carry a
  honeypot field.

## Security

What is protected, and how:

- **One shop never sees another's data.** Only `src/data` may query the
  database (an ESLint rule fails the build otherwise), and every query goes
  through `forShop(shopId)`. The shop id comes from the login session or is
  resolved on the server from the store address, never from the browser.
  Integration tests seed two shops and check that nothing crosses over. Draft
  previews are shown only to members of that shop and are never cached.
- **Customers cannot change prices.** Baskets hold only product ids and
  quantities; prices are read from the database at the moment of each action.
  Buyback offers are stored on the server and accepting sends only the quote
  id. Checkout reprices before creating the Stripe session, and fulfilment
  checks the amount Stripe charged.
- **Payments.** The webhook verifies Stripe's signature on the raw request
  body; one sale per Stripe session, so a replayed event creates nothing;
  card payments only; return URLs come from configured addresses, never the
  request's Host header; a paid order is always recorded.
- **Input and abuse.** Every server action and route validates its input with
  Zod, with length limits. Booking, quote, checkout and slot lookups are rate
  limited per IP and carry a honeypot field; login is rate limited per email,
  per IP and per both. Double bookings and double-accepted quotes are
  prevented in the database and tested under concurrency.
- **Injection.** React escapes rendered text and emails are built with an
  escaping helper. Uploaded SVG logos are sanitised on the server with an
  allow-list. Store colours must be hex values and fonts come from a fixed
  list, so brand settings cannot inject CSS. Image URLs must point at the
  project's own Blob store. Database queries are parameterised.
- **Security headers** on every response: an enforced Content Security Policy
  (no framing, no plugins, scripts and connections only from the app, images
  only from the app and its Blob store, forms only to the app and Stripe
  Checkout), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a
  strict referrer policy, a permissions policy, and HSTS. The policy ran in
  report-only mode on the live site first and was enforced once a click-through
  showed no violations.
- **Secrets** live only in environment variables (sensitive on Vercel, never
  committed or logged). Stripe is in test mode. Integration tests refuse to
  run against a database that is not marked as a test database.

Known gaps, in the order I would close them:

1. The CSP allows inline scripts, because the Next.js App Router streams its
   page data in inline scripts. Moving to per-request nonces would remove
   that allowance.
2. Signups do not verify the email address yet (Better Auth supports it; it
   needs a verification page and email).
3. Confirmation emails go to the address the customer types. Rate limits
   slow abuse, but a per-recipient limit would close it.
4. Rate limits key on the client IP that Vercel provides; other hosting would
   need the same trusted header.
5. Each ticket had an adversarial code review, but there has been no
   independent penetration test.

## Not done, and how I would build it

These are priorities 5 and 6 in the brief. I chose to finish and test 1 to 4
instead of starting these.

### 2.6 Templates (Clean, Bold, Local)

- Add `template: "clean" | "bold" | "local"` to the store config. Content
  (products, prices, text, hours) already lives apart from presentation, so
  switching cannot lose anything.
- Each template is a set of store-ui layouts (home, product grid, product
  page) reading the same data and the same `--store-*` variables. Bold: dark
  background and large photos. Local: opening hours, a map embed and reviews
  first.
- A template picker on the Online Store page with thumbnails, saved to the
  draft like every other edit, so Preview and Publish work unchanged.
- Estimate: about a day, mostly layout work.

### 2.8 Custom domain

Part of this is built: a `custom_domain` table, and routing that serves a store
on any verified custom domain (requests for that host are mapped to the shop's
store, and checkout return URLs use the shop's own domain). What is missing:

- A "Connect domain" card on Online Store: the owner types `fixitgalway.ie`;
  Sellify calls the Vercel Domains API (`POST /v10/projects/{id}/domains`) and
  stores the hostname as pending.
- Show the DNS records Vercel returns (an A record for an apex domain, a CNAME
  for `www`) with copy buttons.
- "Check connection" calls Vercel's domain verify and config endpoints, then
  shows Pending, Connected or Error with the reason. HTTPS is automatic: Vercel
  issues the certificate once DNS points at it.
- Estimate: about a day, plus waiting on real DNS to test it.

### 2.7 AI store customizer

- **Flow:** the owner types "Make it look premium, black and gold". The server
  sends the prompt plus the current brand settings to an LLM and asks for a
  structured result that must match the brand part of the store config schema
  (colours, font pair, radius, template, banner style). The result is validated
  with the same Zod schema the editor uses and written to the draft, so the
  owner sees it in Preview. "Make the buttons bigger" sends the follow-up with
  the previous result. Undo restores the previous draft, kept as a snapshot
  before each AI change. Nothing is live until the owner publishes.
- **Safety:** the AI only ever returns design settings. It has no access to
  prices, stock or other shops, because the schema it fills does not contain
  them and the server writes only that part of this shop's draft. Text the AI
  suggests still passes the same validation as manual edits, and colour
  contrast is checked before saving.
- **Service and cost:** a small, fast model with structured output, for
  example Anthropic's Claude Haiku. One request is about 1,500 input tokens
  (instructions, schema, current settings, prompt) and 300 output tokens. At
  Claude Haiku 4.5 prices ($1 per million input tokens, $5 per million output
  tokens) that is about $0.003 per request, so well under one cent even with a
  few follow-ups. Prices should be checked at build time. A per-shop daily
  limit keeps costs predictable.
- Estimate: about a day.

## Known limitations

- Store addresses use `/s/<slug>` on the Vercel domain. Subdomains
  (`fixitgalway.<root domain>`) work in code but need a wildcard domain, which
  I did not have.
- Emails come from my own verified test domain, not a Sellify domain.
- "Needs refund" orders are flagged for the owner; the refund itself is done in
  Stripe by hand.
- Store pages are in English only, and there are no customer accounts or order
  history.
- The integration tests run against Neon from the Philippines, which makes the
  full suite slow (about 10 minutes); in Europe it would be much faster.

## Next, with more time

1. Templates (2.6), then custom domains (2.8), then the AI customizer (2.7), as
   designed above.
2. A Playwright smoke test against each preview deployment for the three
   customer flows, run in CI on every pull request.
3. Automatic Stripe refunds for "Needs refund" orders, with the owner's
   confirmation.
4. Product photo cropping and resizing on upload, and image CDN sizes.
5. Store analytics on the dashboard: visits, conversion, popular repairs.

## Photo credits

The demo store's product photos:

- Refurbished iPhone 13: photo by Shreyas Chaudhari on Unsplash
  (https://unsplash.com/photos/bS54zKd-4zQ), Unsplash License.
- Clear case: photo by Lars Kaizer on Unsplash
  (https://unsplash.com/photos/JZrebB7aHyQ), Unsplash License.
- Refurbished Samsung Galaxy S21: "Samsung Galaxy S21 back" by X-SHLIED,
  Wikimedia Commons
  (https://commons.wikimedia.org/wiki/File:Samsung_Galaxy_S21_back.jpg),
  licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
