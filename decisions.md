# Design Decisions

These are settled. They exist so that anyone (including an AI) picking this up does not
re-litigate them or "helpfully" add complexity that the constraints have already ruled
out. Each has a trigger for when it *should* be revisited.

---

### D1 — Google Sheets, not a custom app
**Decision:** The system is one Google Sheet (+ one Apps Script), not a web/mobile app.
**Why:** The owner already uses Sheets. Scale is tens of students. A custom app adds
hosting cost, a permanent maintenance burden on a student builder, and an adoption
fight with teachers who otherwise use a notebook — in exchange for ~nothing over a
well-structured Sheet.
**Rejected:** React/mobile app, custom backend, real database.
**Revisit if:** hundreds of students, multiple branches, or parents need to log in and
see their own history.

*Note on entry method:* in-sheet dropdowns update automatically from the roster; a
Google Form is more foolproof (teachers can't touch the sheet) but its dropdown does
**not** auto-sync from the roster without a script. Start with in-sheet entry; move to a
Form only if a teacher actually breaks the sheet.

---

### D2 — It's a ledger, not a payment collector
**Decision:** No money moves through the system. It records payments that happened
elsewhere (cash in hand, or the fixed UPI QR).
**Why:** There is deliberately no gateway. A gateway means KYC, per-transaction fees,
settlement delays, and compliance the centre doesn't want.
**Rejected:** Razorpay/PhonePe/Stripe integration; in-app "Pay now".
**Revisit if:** the centre decides it *wants* to collect digitally and accept the fees.

---

### D3 — Manual entry of each payment is permanent
**Decision:** A human records every payment (~30s: pick student, type amount, cash/UPI).
**Why:** Cash produces no digital signal. A single static UPI QR yields an amount with
no student attached. There is no data to auto-capture the attribution from.
**Consequence:** "Automate the entire process" is not achievable; "automate everything
*except* recording the payment" is, and that covers reports, counts, splits, unpaid
lists, reminders, and the monthly email.
**Revisit if:** D5-constraints change — i.e. cash is dropped **and** the static QR is
replaced with per-student UPI intent links. Both are fixed by the owner today.

---

### D4 — Student identity = Name + Class (no ID system)
**Decision:** No ID column. Students are keyed by Name + Class; dropdowns show
`Name — Class`.
**Why:** Class alone isn't unique; name alone can collide; the pair is effectively
unique, and it matches how the centre already thinks (students grouped by class).
**Collision handling:** only same-name-same-class collides — rare; append parent
name/nickname to that one label when it happens.
**Rejected:** auto-generated StudentIDs, roll numbers.
**Revisit if:** name+class collisions become common (large cohorts with repeated names).

---

### D5 — Fee = class default + per-student override
**Decision:** Each class has a default monthly fee; individual students can override it.
**Why:** Fees usually vary by class; siblings/scholarships are the exceptions. This is
less to maintain than a fee typed per student and still handles every case.
**Rejected:** one flat fee for everyone; a fee typed on every student row.
**Revisit if:** fees stop correlating with class at all.

---

### D6 — Reminders via click-to-chat, not the WhatsApp API (v1)
**Decision:** `wa.me` links sent manually. No API in v1.
**Why:** Free, no template approval, no ban risk. Automating a personal number gets it
banned regardless of intent. API setup (BSP, template approval, DPDP consent records)
is heavy overhead unjustified at this scale.
**Rejected:** WhatsApp Web automation libraries (ToS violation / ban); WhatsApp Business
API for v1 (overhead > benefit now).
**Revisit if:** manual taps become a real burden (hundreds of parents / multiple
branches) — then move to the official API as a utility template. See `reminders-spec.md`.

---

### D7 — No UPI auto-reconciliation / no SMS parsing in v1
**Decision:** Do not try to auto-detect UPI payments by reading bank SMS, OCR, or
scraping a UPI app.
**Why:** With one static QR, the incoming payment has an amount but no student
attribution, and payee-bank SMS commonly masks/strips sender and note. An SMS-reader
app also needs an always-on phone with SMS permissions and is a bigger build than the
entire rest of the system — while still not solving attribution.
**Rejected:** Android SMS-reader auto-logger (as a v1 dependency); UPI note-parsing as a
load-bearing feature.
**Revisit if:** the centre goes cashless **and** adopts per-student UPI intent links
(`upi://pay?...&tn=<student>`), which would restore attribution. Even then, treat it as
an enhancement, not the primary path.

---

### Manual reconciliation aid (not a decision, just the accepted practice)
Ask parents to put the student's name in the UPI payment note; once a month the owner
eyeballs the sheet against her UPI app's transaction history. This is the reconciliation
method for the UPI half — human, cheap, good enough. No system feature depends on it.
