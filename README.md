# Tuition Fees Tracker — Project Overview

## What this is
A shared fees **ledger** for a small tuition centre, built on a single Google Sheet.
It records who paid, how much, and how (cash or UPI); produces a monthly report; and
generates WhatsApp reminders for parents who haven't paid.

Multiple teachers (all sisters, one family) enter payments. One "main teacher" (the
owner) reads reports and sends reminders.

## What this is NOT
- **Not a payment system.** No money moves through it. Parents pay by cash or by
  scanning one fixed UPI QR code. The sheet only *records* that a payment happened.
- **Not a custom app.** No web app, no mobile app, no backend server, no database
  engine. The Google Sheet is the database and the UI.
- **Not a payment gateway integration.** No Razorpay/Stripe/PhonePe SDK. There is
  exactly one static QR code and it does not change.

## Hard constraints (do not design around these — they are fixed)
1. **Cash stays.** A meaningful share of fees is collected in cash.
2. **The UPI QR is static and single.** One QR for the whole centre. It cannot be
   made per-student or dynamic.
3. **No student ID system.** Students are identified by **Name + Class**. See
   `data-model.md`.
4. **No app.** Google Sheets only, plus one small Apps Script for the monthly email.

## The automation boundary (read this before promising "full automation")
Because of constraints 1 and 2, one step can never be automated:

> **Recording that a payment happened is a permanent manual step (~30 seconds per
> payment).** A cash payment produces no digital signal at all. A UPI payment through
> a single static QR arrives as an amount with no way to tell which student it belongs
> to. So a human must pick the student and type the amount, for both cash and UPI.

**Everything downstream of that manual entry is fully automated:** unpaid list,
paid/total counts, total collected, cash-vs-UPI split, per-class breakdown, the Excel
report, the monthly email, and the reminder links.

Do not "solve" the manual-entry step with SMS parsing, OCR, or a payment gateway. The
static QR strips the attribution that would make any of those work. See
`decisions.md` (D3, D7).

## Stack
- **Google Sheets** — data + reports (formulas only).
- **One Google Apps Script** — the *only* code in the whole system: emails the report
  to the main teacher on the 1st of each month.
- **WhatsApp click-to-chat (`wa.me` links)** — reminders, sent manually by tapping.
  No WhatsApp API in v1. See `reminders-spec.md`.

## Scope
**In scope (v1)**
- Roster of students (name, class, parent contact, fee)
- Payment log with cash/UPI and who entered it
- Monthly report: count paid, count total, total collected, cash/UPI split, per class
- Unpaid list with one-tap WhatsApp reminder links
- Automatic monthly email of the report

**Out of scope (v1)**
- Automatic detection of UPI payments
- Payment collection / gateways
- Parent login or parent-facing app
- Attendance, homework, marks, messaging beyond fee reminders
- WhatsApp Business API (documented as a future option only)

## Glossary
- **Main teacher / owner** — owns the sheet, reads reports, sends reminders.
- **Teacher** — a sister who records payments. Edit access to the Payments tab only.
- **Roster** — the master student list; the source of truth for identity and fee.
- **Payment** — one row: a student paid an amount in a month, by cash or UPI.
- **Unpaid** — a roster student with no (or insufficient) payment recorded for a month.
- **Click-to-chat** — a `wa.me` link that opens WhatsApp with a pre-filled message.

## File index
- `README.md` — this file.
- `data-model.md` — the Sheet structure: tabs, columns, keys, validation, protection.
- `workflows.md` — step-by-step flows for each person.
- `report-spec.md` — what the monthly report computes and how.
- `reminders-spec.md` — how reminders work; the message; the future API option.
- `decisions.md` — key design decisions, what was rejected, and when to revisit.
