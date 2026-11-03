# Engineering notes

The rules that keep the money right, and why they are built this way. File layout and the test map
are in [`STRUCTURE.md`](STRUCTURE.md).

## Data model

```
homes 1──* members            members.seq = the order people joined
homes 1──* bills 1──* shares  shares.home_id ties a share's bill and member to one home
```

Every table has an internal `seq INTEGER PRIMARY KEY AUTOINCREMENT` for ordering and a public UUID
`id`. Order comes from `seq`, never from timestamps, which can tie inside one millisecond.

### Named constraints that matter

| Constraint                           | Stops                                                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chk_bills_total_positive`           | A total of 0, below 0, fractional, or text. `typeof(total_cents) = 'integer'` matters because SQLite columns accept any type.                                             |
| `chk_shares_amount_non_negative`     | A negative or fractional share. Zero is allowed: 2¢ over 3 people is 1, 1, 0.                                                                                             |
| `uq_shares_bill_member`              | Charging one person twice on one bill.                                                                                                                                    |
| `fk_shares_bill`, `fk_shares_member` | A share whose bill and member are in different homes. Both are composite keys on `(home_id, …)`; `uq_bills_home_id` and `uq_members_home_id` exist only as their targets. |
| `chk_shares_paid_consistent`         | `paid_at` set without the key that paid it (or the reverse), which would break replays.                                                                                   |
| `fk_members_home`, `fk_bills_home`   | Rows pointing at a home that does not exist.                                                                                                                              |

The rest (`uq_*_id`, `chk_*_not_blank`) keep IDs unique and names non-blank. There are 16 in all;
the assignment asks for 3.

## Splitting a bill

`splitCents(total, members)` in `api/src/split.ts`:

```
base = floor(total / n), remainder = total % n
member i gets base + (i < remainder ? 1 : 0)    // i in join order
```

The sum is `n·base + remainder = total`, and no two shares differ by more than 1¢. The property
tests check both on thousands of random inputs.

The bill and all its shares are written in **one `DB.batch()`**, which D1 runs as a single
transaction. Shares go in as multi-row `INSERT`s of 20 rows (5 values per row, D1 allows 100 per
statement), so a 45-person home is 4 statements, not 46.

## Paying a share

```sql
UPDATE shares SET paid_at = ?, paid_key = ?
WHERE id = ? AND bill_id = ? AND paid_at IS NULL
RETURNING …
```

| Result of the UPDATE | Then                                 | Answer                                               |
| -------------------- | ------------------------------------ | ---------------------------------------------------- |
| A row came back      | —                                    | **200**: this request paid it                        |
| No row               | The share is not in this bill        | **404** (`Bill not found` / `Share not found`)       |
| No row               | `paid_key` equals this request's key | **200** with the stored row: a replay, same `paidAt` |
| No row               | A different key paid it              | **409**                                              |

**Why this is race-safe.** The check (`paid_at IS NULL`) and the write are one statement, and
SQLite runs writes one at a time. Of any number of parallel requests, exactly one matches. A
read-then-write version would let two requests both see "unpaid" and both pay.

**Key scope.** A key belongs to one share. The same key on another share is a new payment.

## Status codes

| Code | When                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------- |
| 400  | Body is not JSON; `Idempotency-Key` missing, blank or over 255 characters                                               |
| 404  | Home, bill or share not found; unknown route                                                                            |
| 409  | Share already paid with a different key                                                                                 |
| 422  | Readable but invalid: wrong type, blank or over 100 characters, amount not a positive whole number, home has no members |
| 500  | Anything unexpected; the body is generic and details only go to the log                                                 |

Checks run in this order: unreadable request (400), invalid fields (422), missing resource (404),
business rule (422 or 409).

Every error body is `{ "error": string }`, written in one place (`app.onError` / `app.notFound`).

## The web client

- **One door to the API.** `web/src/api.ts` returns `{ ok: true, data } | { ok: false, status, error }`
  and never throws. It has a 10 s timeout, parses the body defensively, and checks its shape with a
  runtime guard (`web/src/guards.ts`), so there are no `as` casts on API data.
- **No optimistic payments.** A share shows as paid only after a 200.
- **One key per payment attempt**, kept in `sessionStorage` until it is confirmed. A retry after a
  timeout or a reload reuses the key and gets a replay instead of a 409.
- **Honest failures.** With no answer (status 0) the page says it _couldn't confirm_ the payment,
  never that it failed, because it may have gone through.
- **No list of every home.** The API has no `GET /api/homes`: without accounts it would expose
  every household. The page remembers homes created or opened in this browser (`localStorage`);
  other people join through the home's link.

## Known limits

- No accounts: anyone with a home's link can see it and pay its shares.
- Creating homes, members and bills is not idempotent; a retried create makes a duplicate.
- Nothing can be edited or deleted (members are never removed, which the split relies on).
- Server-side row types (`.first<ShareRow>()`) trust our own schema; the web client checks every
  answer at runtime.
