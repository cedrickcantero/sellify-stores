# Sellify Stores

Setup, scripts, environment and module layout: `README.md`. Product spec:
GitHub issue #1 (`gh issue view 1`). This is Next.js 16: before using a
Next.js API you are unsure of, read the guide in `node_modules/next/dist/docs/`.

## Building a backend page

Backend pages live in `src/app/(backend)/<section>/page.tsx`. The
`(backend)` layout already renders the `AppShell` (sidebar, header, 1200px
content column) and checks the session; the page renders only its content.
Take the shop id from `getActiveShop()` (`@/auth/session`), never from the
browser.

1. **Follow the recipe.** Every page is, top to bottom: `PageHeader`, then
   `FilterBar` when the page lists records, then `Card` or `Table`. One
   primary Button per page or modal. Create and edit in a `Modal`.
2. **Build only from `@/ui` and the Sellify tokens.** Compose pages from the
   components below. Style the space between them with layout classes
   (`flex`, `grid`, `gap-6`) and token classes only:
   - colour: `primary`, `primary-hover`, `primary-tint`, `primary-border`,
     `primary-foreground`, `foreground`, `secondary-foreground`,
     `muted-foreground`, `background`, `surface`, `surface-muted`, `border`,
     `input`, and `success`, `warning`, `error` with their `*-tint` and
     `*-text`, as `bg-*`, `text-*`, `border-*`. Words on a status tint use
     the `*-text` token; the base status colour is for dots and fills;
     `muted-foreground` text goes only on white or gray-50. Text must reach
     4.5:1 and control borders 3:1 (`src/ui/contrast.test.tsx` checks the
     ui components);
   - type: `text-page-title`, `text-section`, `text-body`, `text-small`,
     `font-heading`;
   - shape: `rounded-control`, `rounded-card`, `shadow-card`, `shadow-overlay`.
3. **Write copy in the Sellify voice**: short, sentence case, verb-led
   buttons ("Add product", "Publish store"), errors that say what to do
   ("Enter a price above 0."). Full guideline: `docs/brand/sellify.md`.
4. **Check it.** Done when `pnpm lint` passes (it fails on raw hex, rgb() or
   Tailwind palette colours in backend, auth and ui files) and the page reads
   right at desktop width and at 375px with no sideways page scroll, matching
   the components in the gallery at `/dev/components` (dev server only).

When a page needs a look or behaviour the components do not offer, add it to
`src/ui` as a variant or new component (with a test for any keyboard or focus
behaviour), export it from `src/ui/index.ts`, show it in the gallery, then
use it. Every page then gets the same thing. Colour values belong only in
`src/app/globals.css`.

## Components (`@/ui`)

| Component | Use it for |
| --- | --- |
| `PageHeader` | The top of every page: `title` (the page's only h1), `description`, `actions` (the page's main Buttons). |
| `Button` | Every action. `variant`: `primary` (the one main action), `secondary` (other actions beside it), `ghost` (row and toolbar actions), `destructive` (remove or delete, after a confirm Modal). `size`: `md` (default), `sm` (inside tables and cards), `icon` (icon-only, give it `aria-label`). `asChild` wraps a `Link`. |
| `FilterBar` | Search and filter pills above a Table. `filters: { param, label, options }[]`, optional `search: { param, placeholder }`, children for right-aligned actions. Choices live in the URL search params; read `searchParams` in the page and filter the query on the server. |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableEmpty` | Lists of records. `caption` names the table. `align="right"` on money and number columns. `TableEmpty` for no rows, with the next step as `action`. |
| `Card` | A group of related content: form sections, settings, dashboard panels. `title`, `description`, `actions`, `footer` (Save buttons). |
| `StatCard`, `CardGrid` | Dashboard number tiles in a responsive grid. |
| `Modal`, `ModalClose` | Create, edit and confirm steps. `trigger` or controlled `open` / `onOpenChange`, `title`, `description`, `footer` (a `ModalClose` secondary Button, then the primary action), `size="sm"` for confirmations. Traps focus and closes on Escape. |
| `Field` | Label, `hint` and `error` around one Input, Textarea or Select. It wires the label and error to the control. |
| `Input`, `Textarea` | Text, number, email, search and file fields; multi-line text such as the store's about text. |
| `Select` | One choice from a short fixed list. `options`, `name` for forms, `value` / `onValueChange` when controlled. |
| `Switch` | An on/off setting that applies at once: store online, banner shown, a tab visible. Has its own `label`. |
| `StatusBadge` | The state of a record: `status` is one of `completed`, `needs_refund`, `booked`, `in_progress`, `done`, `cancelled`, `quoted`, `accepted`, `received`, `sent`, `failed`, `pending`, `verified`, `error`, `online`, `offline`, `in_stock`, `sold_out`. Label and colour follow from it. A new status gets a new entry in `src/ui/status-badge.tsx`. |
| `Alert` | One sentence about the whole form or page: `tone` `error` (announced), `success`, `warning`, `info`. For one field's error use `Field`'s `error`. |
| `Pill` | A category label, not a state: a sale's channel, a product kind. `tone`: `neutral` (default) or `primary`. |
| `AppShell` | Rendered once by the `(backend)` layout. The sidebar sections are `NAV_ITEMS` in `src/ui/app-shell/nav-items.ts`. |

The online store surface (customer-facing stores) does not use these
components or tokens; it is styled from each store's own config.
