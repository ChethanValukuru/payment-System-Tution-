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

## Two things to eyeball on the first run

I built this against the spec but could not execute Apps Script from where it was
written, so after your first `setup()` confirm these two — they use the trickier
Sheets features and are where a fix, if any, would land:

- The **unpaid list** in `Report` shows one row per parent, and the **"Send
  reminder"** cell is a live clickable `wa.me` link (it's a `FILTER` over a
  `HYPERLINK` column).
- **Sibling grouping**: a parent with two unpaid kids appears once, with both
  names and the combined amount in the message (a `TEXTJOIN` over the sibling
  group).

If either misbehaves, it's isolated to the `Calc` tab columns `P`–`T` and the
`Report` unpaid-list formula — tell me what you see and I'll adjust.

## Re-running setup()

`setup()` is written to be re-runnable: it removes its own old protections and
triggers first so they don't stack. But it **clears the four built tabs**, so
re-run it only on an empty sheet or after exporting anything you want to keep.
`Payments` history and `Roster` entries are data — back them up before a rebuild.
