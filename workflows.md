# Workflows

## Actors
- **Main teacher (owner)** — owns the sheet; maintains the roster; reads reports;
  sends reminders. Can do everything.
- **Teacher (sister)** — records payments. Edit access to `Payments` only.
- **Parent** — pays by cash or by scanning the fixed UPI QR. Never touches the system.

---

## Flow A — Teacher records a CASH payment
1. Parent hands over cash.
2. Open the fees sheet (saved as a phone shortcut).
3. Go to the `Payments` tab.
4. Go to the first empty row.
5. Tap the `Student` cell → pick the student from the dropdown (`Name — Class`).
6. Set `FeeMonth` (defaults to the current month).
7. Type `Amount`.
8. Set `Method` = `Cash`.
9. Done. ~30 seconds.

## Flow B — Teacher records a UPI payment
1. Parent scans the fixed QR and pays.
2. Ask the parent to show the "Payment Successful" screen (this is the only proof; the
   sheet cannot see the payment itself).
3. Same steps 2–7 as Flow A, but set `Method` = `UPI`.
4. Done.

> The system cannot detect UPI payments on its own — one static QR gives an amount with
> no student attached. Manual entry for UPI is expected and permanent. See `README.md`.

## The one rule for teachers
**Record every payment the moment you take it — cash or UPI.** If you forget, that
parent shows up as unpaid and may get a reminder they don't deserve.

---

## Flow C — Main teacher sends reminders (monthly, or any time)
1. Open the `Report` tab.
2. Make sure the month selector is set to the target month.
3. Read the **Unpaid list** (auto-computed: active roster students minus those with a
   sufficient payment for that month, respecting `JoinedMonth`).
4. Each unpaid row has a WhatsApp link (`wa.me`) with the message pre-filled.
5. Tap a link → WhatsApp opens with the text ready → press send.
6. Repeat down the list. Siblings are grouped so one parent isn't messaged twice.
7. Optionally sort/work by class.

Details of the link and message: `reminders-spec.md`.

---

## Flow D — Monthly report
**Automatic part (no human):**
- On the 1st of each month, an Apps Script emails the previous month's report tab (as
  the sheet or an attached Excel export) to the main teacher.

**Manual part (whenever the owner wants a fresh look):**
1. Open `Report`, set the month selector.
2. Read: how many paid, how many total, total collected, cash/UPI split, per-class
   breakdown, unpaid list.
3. `File → Download → Microsoft Excel (.xlsx)` for an Excel copy.

Report contents: `report-spec.md`.

---

## Flow E — Roster maintenance (main teacher only)
- **Add a student:** add a row to `Roster` with Name, Class, parent contact, status
  `Active`, and `JoinedMonth`. The dropdown in `Payments` updates automatically (if
  using in-sheet dropdowns; a Google Form dropdown needs a manual/script refresh — see
  `decisions.md` D1).
- **Fee differs from class default:** fill `MonthlyFeeOverride`.
- **Student leaves:** set `Status` = `Left`. They drop out of unpaid lists and counts.
  Do not delete them — keeps their payment history intact.
- **Name collision (same name, same class):** append parent name/nickname to that
  student's label.

---

## Sequence summary (the money-to-record path)
```
Parent pays (cash OR scans fixed QR)
        │
        ▼
Teacher opens Payments tab
        │
        ▼
Pick student (dropdown)  →  set month  →  type amount  →  Cash/UPI
        │
        ▼
Row saved  ──►  Report recomputes automatically
                       │
                       ├─► counts, totals, cash/UPI split, per-class
                       └─► unpaid list  ──►  wa.me reminder links
```
