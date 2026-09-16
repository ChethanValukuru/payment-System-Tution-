# Apps Script — the buildable part of the system

This folder is the **only code** the design permits (see `../decisions.md` D1):
one Apps Script project that (a) constructs the whole Google Sheet and (b) runs
the two automations. Everything else is Sheet structure and formulas, which the
`setup()` script writes for you.

## What the code does

| File | What it does |
|---|---|
| `Setup.gs` | `setup()` builds the `Roster`, `Payments`, `Report`, `Classes` tabs and a hidden `Calc` tab: columns, dropdowns, validation, protection, the class-fee lookup, and **every Report formula** (counts, totals, cash/UPI split, per-class breakdown, unpaid list, partial/overpaid flags, and the `wa.me` reminder links). |
| `Automation.gs` | `onPaymentEdit` stamps the Timestamp and defaults FeeMonth to the current month when a teacher picks a Student. `emailMonthlyReport` emails last month's report (with an `.xlsx` attachment) to the main teacher on the 1st. |
| `appsscript.json` | Manifest: India timezone, V8, and the OAuth scopes the automations need. |

Nothing here moves money, reads SMS, or calls a payment/WhatsApp API — those are
all ruled out by `../decisions.md` (D2, D6, D7) and are deliberately absent.

## What the code CANNOT do (irreducibly manual — do these yourself)

1. **Create the spreadsheet** and open its Apps Script editor.
2. **Authorize** the script the first time it runs (Google shows a consent screen).
3. **Fill real data**: class fees in `Classes`, then students in `Roster`.
4. **The UPI QR** is a physical/print artifact outside the sheet. It never changes.
5. **Record each payment** — the permanent ~30-second manual step (`../README.md`).
6. **Send each reminder** — one tap per parent from the owner's own WhatsApp.

## Install (once, ~5 minutes)

1. Create a new Google Sheet (any name).
2. **Extensions → Apps Script**.
3. Create three script files matching this folder and paste each file's contents:
   `Setup.gs`, `Automation.gs`. Then in the editor's project settings, show the
   manifest (`appsscript.json`) and paste that too — or just set the timezone to
   *(GMT+05:30) India* and let Apps Script manage scopes automatically.
4. Save. In the function dropdown pick **`setup`** and click **Run**.
5. Approve the authorization prompt (it needs: manage this spreadsheet, send
   email as you, connect to an external service for the `.xlsx` export, and
   create triggers).
6. When it finishes you'll see a toast: *"Setup complete."* You now have all
   five tabs, both triggers installed, and the report wired up.

## After install

- **Set the report recipient** (defaults to whoever ran `setup`): run
  `setMainTeacherEmail('owner@example.com')` once, or leave it if you ran setup
  as the main teacher.
- **Edit the class fees** in `Classes` — the seeded fees are examples.
- **Add students** in `Roster`. The `Payments` student dropdown updates itself.
- **Preview the monthly email** any time: run `sendTestReportEmail`.
- **Change the report month**: type a different `YYYY-MM` in `Report!B1`.

## Verify it works (sample data — 30 seconds)

The code parses cleanly but was never run against a live Sheet during the build.
`SampleData.gs` closes that gap: it loads a small dataset that exercises every
rule in the spec, so you can confirm the whole report at a glance.

1. After `setup()`, run **`loadSampleData`** (function dropdown → Run).
2. Open the `Report` tab (its month is the **current** month).
3. Check it against this table. If every number matches, the system works.

**Expected report — for the current month, with sample data:**

| Field | Expected value |
|---|---|
| Count paid (full) | **2** (Aarav, Aanya) |
| Count expected | **6** (Ishaan joins next month and Riya has left, so both are excluded) |
| Total collected | **₹10,000** |
| Cash total | **₹4,500** |
| UPI total | **₹5,500** |
| Per class — Class 8 | expected 1, paid 1, collected ₹3,500 |
| Per class — Class 6 | expected 2, paid 0, collected ₹4,500 |
| Unpaid list | **2 rows**: one grouped reminder to Ravi (Diya + Kabir, **owes ₹6,500**, clickable link); Vihaan (**owes ₹3,000**, **no link** — no number on file) |
| Partial payments | **Diya** (₹1,000 of ₹3,000) |
| Overpaid / check | **Advait** (₹3,500 received on a ₹3,000 fee) |

The two things most worth confirming, because they use the trickiest Sheets
features and are where a fix would land:

- The **"Send reminder"** cell in the unpaid list is a live, clickable `wa.me`
  link (a `FILTER` over a `HYPERLINK` column).
- **Sibling grouping**: Ravi appears **once** with both kids and the combined
  ₹6,500 (a `TEXTJOIN` over the sibling group).

If either misbehaves it's isolated to `Calc` columns `P`–`T` and the Report
unpaid-list formula — tell me what you see and I'll adjust.

4. When you're satisfied, run **`clearSampleData`** and start adding real
   students. (It preserves the `DisplayLabel` formula; it only clears data.)

## Re-running setup()

`setup()` is written to be re-runnable: it removes its own old protections and
triggers first so they don't stack. But it **clears the four built tabs**, so
re-run it only on an empty sheet or after exporting anything you want to keep.
`Payments` history and `Roster` entries are data — back them up before a rebuild.
