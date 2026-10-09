# Sellify brand guideline (platform backend)

This is how every Sellify backend page looks and reads. The values come from
sellify.market. They are built into the design tokens in
`src/app/globals.css` and the components in `src/ui`, so using those
components gets you this guideline automatically. Online stores do not use
this guideline; each store has its own brand from the store editor.

## Colours

Purple is for the one main action, the active place in the navigation and
selected filters. Everything else is neutral. Status colours only mean
status.

| Token | Code | Use |
| --- | --- | --- |
| `primary` | `#9333EA` | Primary buttons, active nav item, selected pill, focus ring, links |
| `primary-hover` | `#7E22CE` | Hover on primary buttons and links |
| `primary-tint` | `#FAF5FF` | Background of the active nav item, selected pills, highlighted list options |
| `primary-border` | `#D8B4FE` | Border of selected pills and purple pills |
| `primary-foreground` | `#FFFFFF` | Text on primary and destructive buttons |
| `foreground` | `#171717` | Main text and headings |
| `secondary-foreground` | `#4B5563` | Text on `surface-muted`, such as neutral badges |
| `muted-foreground` | `#6B7280` | Descriptions, table headers, hints, placeholders (on white or gray-50 only) |
| `surface` | `#FFFFFF` | Cards, tables, inputs, sidebar, header, modals |
| `background` | `#F9FAFB` | Page background behind the cards; table header row |
| `surface-muted` | `#F3F4F6` | Hover on rows, ghost buttons and neutral badges |
| `border` | `#E5E7EB` | Card, table and divider lines (decorative) |
| `input` | `#868C96` | Borders of inputs, selects and secondary buttons, and the off switch track |
| `success` | `#16A34A` | Completed, done, sent, online, in stock |
| `warning` | `#D97706` | In progress, pending, sold out |
| `error` | `#DC2626` | Field errors, failed, needs refund, destructive buttons |

Success, warning and error each have a pale tint (`success-tint`
`#F0FDF4`, `warning-tint` `#FFFBEB`, `error-tint` `#FEF2F2`) for the
background of their badge or message, and a darker text colour
(`success-text` `#15803D`, `warning-text` `#B45309`, `error-text`
`#B91C1C`) for words on that tint. The base status colour is for dots,
fills and borders only.

Contrast is part of the guideline, not a nice-to-have: text needs at least
4.5:1 against its background, and control borders and the off switch track
at least 3:1 against the surface. A unit test (`src/ui/contrast.test.tsx`)
checks every badge, alert, input and switch against these numbers.

Never type a colour code into a page. Use the token classes (`bg-primary`,
`text-muted-foreground`, `border-border`). The default Tailwind palette is
switched off and a lint rule fails the build on raw colours in backend
pages.

## Fonts and text sizes

- Headings: **Plus Jakarta Sans** (`font-heading`).
- Everything else: **Inter** (the default body font).

| Role | Class | Size / line height | Weight | Font |
| --- | --- | --- | --- | --- |
| Page title (one per page) | `text-page-title` | 24px / 32px | Bold | Plus Jakarta Sans |
| Section heading (card titles, modal titles) | `text-section` | 18px / 28px | Semibold | Plus Jakarta Sans |
| Body (tables, forms, copy) | `text-body` | 14px / 20px | Regular, medium for labels | Inter |
| Small print (hints, badges, pills, table headers) | `text-small` | 12px / 16px | Regular or medium | Inter |

Use sentence case everywhere: "Add product", not "Add Product".

## Spacing

Spacing follows a 4px scale: `1` is 4px, `2` is 8px, `3` is 12px, `4` is
16px, `6` is 24px, `8` is 32px. Stick to these steps.

- Between the blocks of a page (header, filters, table): 24px.
- Inside a card: 24px padding; 16px between its parts.
- Between a label and its field: 6px; between fields: 16px.
- Between buttons in a row: 8px.
- Page side padding: 16px on phones, 24px on tablets, 32px on desktop.

## Radius

- 8px (`rounded-control`): buttons, inputs, selects, dropdowns, nav items.
- 12px (`rounded-card`): cards, tables, modals.
- Fully round (`rounded-full`): pills, status badges, switches.

## Shadows

Two levels only.

- `shadow-card`: a faint 1px shadow on resting surfaces (cards, tables,
  buttons, inputs).
- `shadow-overlay`: a soft, larger shadow for things that float above the
  page (modals, dropdowns, the mobile menu).

## Layout

- The sidebar is 240px wide and lists the eight sections in this order:
  Dashboard, Inventory, POS, Repairs, Buybacks, Sales, Online Store, Email
  outbox. Below 1024px wide (phones and tablets) it becomes a menu behind a
  button in the header.
- The header shows the shop name and Log out.
- Page content is at most 1200px wide.
- Every page follows the same recipe, top to bottom:
  1. **PageHeader**: the page title, a one-line description and the page's
     main action on the right.
  2. **FilterBar**: search and filter pills, when the page lists records.
  3. **Card or Table**: the content. Tables for lists of records, cards for
     forms, settings and dashboard tiles.
- One primary (purple) button per page or modal. Other actions are
  secondary or ghost.
- Create and edit happen in a Modal. Removing something asks for
  confirmation in a small Modal with a destructive button.
- Money and numbers are right-aligned in tables.
- Every page works at 375px wide without sideways scrolling of the page;
  wide tables scroll inside their own frame.

## Logo

- The logo is the purple Sellify mark (`public/brand/sellify-logo.png`,
  taken from sellify.market) followed by the word "Sellify" in Plus Jakarta
  Sans bold, in `foreground`.
- Show it at the top of the sidebar, in the mobile menu and above the
  sign-up and login forms. Do not use it elsewhere on backend pages.
- Keep the mark purple on a white or very light background. Do not recolour,
  stretch, rotate, outline or add effects to it, and do not put it on a
  purple or photo background.
- Keep at least half the mark's height of clear space around it. Do not show
  the mark smaller than 20px high.

## Tone of voice

Short, plain and verb-led. Say what happens.

- Buttons start with a verb and name the thing: "Publish store", "Add
  product", "Book repair", "Complete sale", "Save". Never "Submit", "OK" or
  "Click here".
- Titles of modals match the button that opened them: "Add product".
  Confirmations ask a question: "Remove product?"
- Success messages are one short sentence: "Store published."
- Errors say what to do, not what went wrong inside the system: "Enter a
  price above 0." "That phone is sold out. Remove it from the sale."
- Empty states say what is missing and offer the next step: "No products
  yet." with an "Add product" button.
- Sentence case, no exclamation marks, no jargon, no em dashes.
