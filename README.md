# SDE Intern Assignment: Shared Bill Splitter

Welcome. In this assignment you build a small bill splitter for a shared home. It has two parts:

1. **Homes and members:** create a home and add members to it.
2. **Bill splitting:** split a bill between the members. Each member pays their own share.

The assignment is small on purpose. We want correct, safe, and clear code. We do not want many features.

## What we look at

- **Your code passes the tests.** The tests decide, not opinion. You get the visible tests. We also run extra tests that you do not see.
- **Your code is safe when things go wrong.** Wrong input, repeated requests, and two requests at the same time must not break your data.
- **Your code is typed.** Use TypeScript. Do not use `any`.
- **You understand your code.** You record a short video and explain it.

Take your time. A careful, correct solution is better than a fast one. We expect 2 to 3 days of real work.

## Stack (required)

- **API:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite). The binding is `DB` in `api/wrangler.jsonc`.
- **Web:** React, Vite, TanStack Router
- **Language:** TypeScript on both sides
- **Tests:** Vitest, running inside the Workers runtime
- **Quality:** Biome. `pnpm check` and `pnpm typecheck` must pass.

You choose the rest (styling, form library, validation library). Pick tools you can explain.

## The task

The assignment has two parts. Do Part 1 first. Part 2 builds on it.

**Database.** Write the schema as SQL migration files in `api/migrations/`. For example `0001_init.sql`. The tests apply every file in this folder. Your schema must have **at least 3 named constraints** that protect the data. For example a foreign key, a `CHECK`, or a `UNIQUE` key. Be ready to explain what each constraint stops.

**Errors.** Every error response is JSON: `{ "error": "message" }`.

## Part 1: Homes and members

Create a home and add members to it. The order in which members are added matters in Part 2.

#### `POST /api/homes`

- Request: `{ "name": string }`
- Success: `201` `{ id, name }`

#### `POST /api/homes/:homeId/members`

- Request: `{ "name": string }`
- Success: `201` `{ id, homeId, name }`
- Errors: `404` home not found

Visible tests: `api/test/homes.test.ts`.

## Part 2: Bill splitting

Add a bill to a home, split it between the members, and let each member pay their share.

All amounts are whole **cents** (integers). `100` cents is 1 dollar. Never use decimals for money.

#### `POST /api/homes/:homeId/bills`

- Request: `{ "title": string, "totalCents": number }`
- Success: `201` `{ id, homeId, title, totalCents, shares: [{ id, memberId, amountCents, paidAt: null }] }`
- Errors: `404` home not found. `422` total is not a positive whole number, or the home has no members.

#### `POST /api/bills/:billId/shares/:shareId/pay`

- Request: header `Idempotency-Key`
- Success: `200` `{ id, memberId, amountCents, paidAt }`
- Errors: `400` key missing. `404` bill or share not found. `409` share already paid with a different key.

#### `GET /api/homes/:homeId/balances`

- Success: `200` `{ balances: [{ memberId, name, outstandingCents }] }`
- Errors: `404` home not found

**Rules**

- **Split.** A bill is split between all members of the home. The shares always add up to `totalCents`. If the amount does not divide evenly, the extra cents go to the members one by one, in the order the members were added to the home. Example: 1000 cents between 3 members gives `334`, `333`, `333`.
- **Pay.** Paying marks one share as paid and sets `paidAt`. If the same `Idempotency-Key` is sent again for the same share, answer `200` with the same result. Do not pay twice. If two requests pay the same share at the same time, only one may succeed.
- **Balances.** `outstandingCents` is the sum of the member's unpaid shares, across all bills of the home. List the members in the order they were added.

Visible tests: `api/test/bills.test.ts` and `api/test/payments.test.ts`.

#### Web page

Build one page that:

- shows the bills of a home and the shares of each bill,
- lets a member pay a share,
- shows clear **loading**, **empty**, and **error** states,
- keeps the share unpaid and shows an error if the payment fails.

The page must not crash when the API answers with an error or is slow.

## Cases you must handle

You must handle these cases and talk about them in your video:

1. A home with no members.
2. An amount that is zero, negative, or not a whole number.
3. An amount that does not divide evenly.
4. The same payment request sent twice.
5. Two members paying the same share at the same time.
6. A bill or share that does not exist.
7. The API answers with a 500 error or is slow. The web page must not crash.

## Run it

This is a pnpm workspace. Install once at the root.

```bash
pnpm install
pnpm dev          # api on :8787 and web on :5173
```

Open http://localhost:5173. The starter page shows a title. `/api/health` returns `{ "status": "ok" }`.

```bash
pnpm test         # run the visible tests in api/test
pnpm check        # Biome: format and lint. Must pass.
pnpm check:fix    # fix what Biome can fix
pnpm typecheck    # tsc on both packages. Must pass.
pnpm build        # production build of the web app
```

`pnpm dev` applies your migrations to a local database before it starts the API.

If pnpm says some build scripts were ignored, run `pnpm approve-builds` and allow `esbuild` and `workerd`.

When you change `api/wrangler.jsonc`, refresh the `Env` types:

```bash
pnpm --filter bill-splitter-api cf-typegen
```

## Rules for the tests

- The visible tests are in `api/test`. They start with a failing result. Your job is to make them pass.
- Do **not** change the visible tests or `api/test/helpers.ts`. We compare them with the original.
- We run extra tests after you submit. They test the cases in "Cases you must handle" more closely.

## AI policy

You can use AI tools. Tell us which ones and where in your answers on the form.
You must understand every line you submit. We check this with your video and in a live call. "The AI wrote it" is not an answer.

## Project tour

Kitty is the finished bill splitter: a Hono API on Cloudflare Workers with D1, and a single React
page.

| Start here                                   |                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------- |
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md)     | Every file, the layering rules, and where each requirement is proven |
| [`docs/ENGINEERING.md`](docs/ENGINEERING.md) | The money rules: constraints, split, pay, status codes               |
| [`docs/DESIGN.md`](docs/DESIGN.md)           | The interface, with screenshots of the key states                    |

How it is checked:

- **54 tests** run in the Workers runtime against real D1. They include the 24 visible tests,
  edge cases, and **property-based tests** (fast-check). These check the split rules on thousands
  of random bills, and that random bursts of parallel payments always pay a share exactly once.
- **`pnpm demo:race`** (with `pnpm dev` running) fires parallel payments at the live API and
  prints `PASS` when exactly one wins and retries replay:

  ```text
  1) 12 parallel payments of Asha's share, each with its own key
     answers: 1 × 200, 11 × 409
     PASS: exactly one payment won
  2) 12 parallel retries of Ben's payment, all with the same key
     answers: 12 × 200, distinct paidAt values: 1
     PASS: every retry got the same answer
  ```

- **CI** (`.github/workflows/ci.yml`) runs `pnpm install && pnpm check && pnpm typecheck &&
  pnpm test && pnpm build` on every push.

## Decisions

1. **Paying a share is one conditional `UPDATE`.** The query is
   `UPDATE shares ... WHERE id = ? AND bill_id = ? AND paid_at IS NULL RETURNING ...`, so the
   check and the write happen in one statement. SQLite runs writes one at a time, so when two
   requests race, exactly one matches the unpaid row. The other request reads the share and gets
   `200` if it sent the same `Idempotency-Key` (it replays the stored `paidAt`) or `409` if it
   sent a different key. Reading first and then writing would let both requests see "unpaid" and
   both pay. Trade-off: the key lives on the share row (`paid_key`), not in a general
   idempotency table. That is simpler, and the spec only needs one key per share, but the pattern
   does not carry over to other endpoints.
2. **The database enforces the invariants, not only the code.** The schema has 16 named
   constraints. Composite foreign keys (`fk_shares_bill`, `fk_shares_member`) stop a share from
   linking a bill and a member of different homes. `chk_bills_total_positive` and
   `chk_shares_amount_non_negative` reject bad amounts. A share of 0 is allowed, because 2 cents
   over 3 members gives 1, 1, 0. `uq_shares_bill_member` allows one share per member per bill.
   `chk_shares_paid_consistent` keeps `paid_at` and `paid_key` both set or both null. Member
   order comes from an `AUTOINCREMENT` `seq` column, not a timestamp, so two members added in the
   same millisecond still have a fixed order.
3. **The split runs in TypeScript, then one atomic batch writes the bill.** `splitCents` is a
   pure integer function: it computes `floor(total / n)` and gives the remainder to the first
   members. The bill row and all share rows go into one `DB.batch()`, which D1 runs as a single
   transaction, so a bill never exists with missing shares. The page keeps one
   `Idempotency-Key` per share in `sessionStorage` until the payment is confirmed. If a request
   times out but did reach the server, the retry (even after a reload) replays it instead of
   getting a `409`. There is no optimistic update: a share shows as paid only after a `200`.

Smaller choices, and why:

- **400 vs 422.** `400` only when the request cannot be read: the body is not JSON, or the
  `Idempotency-Key` is missing or blank (the spec's own 400). `422` for JSON that parses but has
  wrong fields, including a blank `name` or `title`. The spec uses 422 for bad amounts, so every
  field error follows it. Fields are validated before any lookup, so a bad body to a missing home
  is 422.
- **No "list every home" endpoint.** Without accounts it would show every household to anyone. The
  page remembers homes created or opened in this browser; others join through the home's link.
  The page uses two extra reads: `GET /api/homes/:homeId` (name and members) and
  `GET /api/homes/:homeId/bills`.
- **Trust boundaries.** The web client checks every API answer at runtime (`web/src/guards.ts`)
  instead of casting. On the server, D1 row types trust our own schema, which the constraints
  enforce.

## How to submit

1. Click **Use this template**, then **Create a new repository**. Make the repository **public**.
2. Build your solution in your new repository. Small, clear commits are welcome.
3. Update this README with a short section called **Decisions**. Write 3 decisions you made and why.
4. Record a video of **3 minutes or less** (Loom or unlisted YouTube). Show the architecture, the data flow, and one trade-off you made. Make sure anyone with the link can view it.
5. Paste the repository link and the video link in the application form.

We will run `pnpm install && pnpm check && pnpm typecheck && pnpm test` on your repository.
