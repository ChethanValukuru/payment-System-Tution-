# Reminders Specification

## Mechanism (v1): WhatsApp click-to-chat
Each unpaid row in the report produces a **`wa.me` link** that opens WhatsApp with the
message already typed. The main teacher taps it and presses send. The message is sent
**manually from her own WhatsApp** — no API, no cost, no approval, no ban risk.

### Link format
```
https://wa.me/<number>?text=<url-encoded message>
```
- `<number>` = parent's number, **digits only, country code, no `+` and no spaces**.
  India: `91XXXXXXXXXX`. Store it this way in `Roster.ParentWhatsApp`.
- `<message>` = the reminder text, URL-encoded (spaces → `%20`, newline → `%0A`, etc.).
- In Sheets, build the link with a formula that concatenates the number and an encoded
  message (e.g. using `ENCODEURL(...)`), then wrap it as a clickable `HYPERLINK`.

### Message template
Placeholders resolve per student from `Roster` + report:
```
Namaste {ParentName}, this is a gentle reminder that the tuition fee for
{StudentName} ({Class}) for {MonthName} is pending. Amount due: ₹{Owed}.
You can pay by cash or by scanning our UPI QR. Thank you.
```
Keep it short, factual, no pressure. Owed = `fee - received` (so it's correct for
partial payments too).

### Rules
- One message per **parent**, not per student — siblings are grouped so a parent with
  two kids gets a single combined reminder.
- Manual trigger only: the teacher chooses when to send and can skip anyone.
- Rows with no `ParentWhatsApp` simply have no link.

### Known limits
- One tap per parent (not zero-touch). At tuition scale this is trivial.
- Sending manually to *many* contacts very rapidly can still look spammy to WhatsApp;
  at this volume it's a non-issue, but don't script taps to fake automation — that
  recreates the ban risk below.

---

## Why not fully automated in v1
Automating messages from a **personal WhatsApp number** (via WhatsApp Web automation
libraries or unofficial tools) violates WhatsApp's terms and gets numbers **banned**.
If that number is also the tuition centre's main contact, a ban is severe. Honesty of
the operators is irrelevant — the ban is triggered by the automation pattern, not by
intent. So v1 stays manual click-to-chat.

---

## Future option (only if volume ever justifies it): WhatsApp Business API
Zero-touch reminders are possible via the official API, but with real setup overhead:
- A **BSP** (Business Solution Provider) account and a Meta-verified business.
- **Message templates** submitted to Meta for approval; a fee reminder is a **utility**
  template (transactional), the cheapest category.
- **Cost is not the blocker** — utility messages in India are on the order of a few
  paise each, so reminders for even 100 students cost a few rupees a month.
- **DPDP Act (India, in force):** storing and messaging parents' numbers makes the
  operator a data fiduciary. Keep a consent record for each number and honour deletion
  requests. This is the real overhead, not the money.

Revisit the API only when the manual taps become a genuine burden (hundreds of parents,
or multiple branches). Until then it's over-engineering. See `decisions.md` (D6).

## Consent note (applies even to v1)
Even for manual click-to-chat, only message numbers the parent gave you for this
purpose. There's an existing tuition relationship, so this is straightforward — just
don't repurpose the numbers for anything but fee communication.
