# Report Specification

The `Report` tab is fully derived from `Roster` + `Payments`. No manual entry except a
single **month selector** cell that sets which month the report covers.

## Inputs
- `Roster` (active students, their class, their resolved fee, join month).
- `Payments` (all payment rows).
- Selected `FeeMonth` (from the month selector cell).

## Definition of "paid" (decide once, apply everywhere)
For a student in the selected month, let `received` = sum of `Amount` over all
`Payments` rows where `Student` matches and `FeeMonth` = selected month.

- **Paid (full):** `received >= fee(student)`
- **Partial:** `0 < received < fee(student)`
- **Unpaid:** `received = 0`
- **Overpaid:** `received > fee(student)` — flag it, don't hide it (data entry error or
  advance payment).

A student is only expected to pay if `Status = Active` and
`JoinedMonth <= selected month`.

## Outputs (for the selected month)
1. **Count paid** — number of expected students with status Paid (full).
2. **Count expected (total)** — number of active students expected this month.
3. **Total collected** — sum of `Amount` for the month (across all students).
4. **Cash total** and **UPI total** — the same sum split by `Method`.
5. **Per-class breakdown** — for each class: expected count, paid count, amount
   collected. (The most actionable view: which class is lagging.)
6. **Unpaid list** — expected students with status Unpaid or Partial, with: name,
   class, parent name, amount still owed (`fee - received`), and a `wa.me` reminder
   link (see `reminders-spec.md`). Siblings grouped so a parent appears once.
7. **Partial / overpaid flags** — small lists so nothing silently rounds away.

## Formula approach (guidance, not a build)
No app code. Standard spreadsheet functions:
- Sum received per student/month: `SUMIFS(Payments.Amount, Student=…, FeeMonth=…)`.
- Counts: `COUNTIFS` / a helper column marking each student Paid/Partial/Unpaid.
- Per-class rollups and the unpaid table: `QUERY` over a helper range, or
  `SUMIFS`/`COUNTIFS` per class.
- Cash vs UPI: `SUMIFS(..., Method="Cash")` and `SUMIFS(..., Method="UPI")`.

A small hidden helper block (one row per active student, computing `received`, `fee`,
`owed`, `status`) keeps the visible report simple and the formulas readable.

## Delivery
- **On demand:** read the tab; `File → Download → .xlsx` for an Excel copy.
- **Automatic (the only code in the system):** an Apps Script scheduled trigger runs on
  the 1st of each month, snapshots the previous month's report, and emails it to the
  main teacher (as a link and/or an .xlsx attachment). Spec-level only here; the script
  itself is the one thing left to build.

## Edge cases to handle
- **Partial payment:** two rows summing to the fee = Paid; one row below the fee =
  Partial. Report on `owed`, not a paid/unpaid boolean.
- **Mid-month join:** `JoinedMonth` excludes earlier months from "expected".
- **Left student:** `Status = Left` excludes them from counts and unpaid lists but keeps
  their history.
- **Payment logged for the wrong month:** `FeeMonth` is the field that decides the
  bucket, independent of `Timestamp`.
- **Overpayment / duplicate entry:** surfaced in the overpaid flag list for manual
  review, never hidden.
- **Missing parent number:** unpaid list still shows the student; the reminder link is
  simply absent for that row.
