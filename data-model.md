# Data Model

The whole system is **one Google Sheet with three tabs**: `Roster`, `Payments`,
`Report`. `Roster` and `Payments` hold data. `Report` is entirely derived — nobody
types into it.

---

## Identity: how a student is uniquely referred to
There is **no ID column**. A student is identified by **Name + Class** together.

- Class alone is not an identity (a class has many students).
- Name alone can collide (two "Aarav"s).
- **Name + Class** is effectively unique.

**Collision rule:** the only unresolved case is *same name in the same class*. It is
rare. When it actually occurs, disambiguate that one student by appending the parent's
name or a nickname to the display label (e.g. `Aarav (R.) — Class 8`). Do not build a
general ID system for a collision that may never happen. See `decisions.md` (D4).

The teacher never types a name. They pick a **display label** from a dropdown. The
label is `Name — Class`.

---

## Tab 1: `Roster` (master list — only the main teacher edits)

| Column | Type | Required | Notes |
|---|---|---|---|
| `Name` | text | yes | Student's name. |
| `Class` | text/enum | yes | e.g. `Class 6`, `Class 10`. Drives the default fee. |
| `DisplayLabel` | text (derived) | yes | `Name — Class`. Used as the dropdown value in Payments. Auto-built from Name + Class. |
| `ParentName` | text | no | For the reminder message and disambiguation. |
| `ParentWhatsApp` | text | yes if reminders wanted | Digits only, with country code, no `+`. India = `91XXXXXXXXXX`. See `reminders-spec.md`. |
| `MonthlyFeeOverride` | number | no | Fill only when this student's fee differs from the class default. |
| `SiblingGroup` | text | no | Same value for siblings (e.g. a family surname or code). Lets one parent get one combined reminder. |
| `Status` | enum | yes | `Active` or `Left`. `Left` students are excluded from unpaid lists and reports. |
| `JoinedMonth` | month (YYYY-MM) | no | So a student isn't counted "unpaid" for months before they joined. |

**Fee resolution (used everywhere a fee is needed):**
```
fee(student) = MonthlyFeeOverride if present, else ClassDefaultFee(student.Class)
```
Class default fees live in a small lookup (either a `Classes` helper tab or a fixed
range on `Roster`). Overrides handle siblings/scholarships without special logic.

---

## Tab 2: `Payments` (append-only log — teachers edit here)

One row = one payment event. Teachers add rows; they do not edit `Report` or `Roster`.

| Column | Type | Required | Entry method | Notes |
|---|---|---|---|---|
| `Timestamp` | datetime | yes | auto | Set on row creation (or by the Form). |
| `Student` | text | yes | **dropdown** of `Roster.DisplayLabel` | This is the anti-typo control. Never free text. |
| `FeeMonth` | month (YYYY-MM) | yes | dropdown / default = current month | The month the payment is *for* (not necessarily when paid). |
| `Amount` | number | yes | typed | What was actually received (supports partial payments). |
| `Method` | enum | yes | dropdown | `Cash` or `UPI`. |
| `EnteredBy` | text | no | dropdown of teacher names | Optional; sisters, so not for policing — just handy. |
| `Note` | text | no | typed | Free notes ("paid half", etc.). |

**Rules**
- `Student` must be a value that exists in `Roster.DisplayLabel` (data validation:
  reject anything not in the list). This is what keeps names clean.
- `Amount` is what was received, so two rows for the same student/month = a partial
  then a top-up. The report sums them.
- Do not delete rows to "correct" mistakes casually; add a correcting note or a
  negative-amount adjustment row if needed (keeps history intact).

---

## Tab 3: `Report` (derived — no manual entry)
Formulas only. Defined in `report-spec.md`. Has a control cell for the target month
(pick a month, the whole report recomputes).

---

## Protection (matters even with trusted family — it prevents accidents)
- `Roster`: editable by main teacher only. Others: view.
- `Payments`: teachers may **add rows**; the header row and any helper/formula columns
  are protected. Ideally lock all columns except the ones teachers fill.
- `Report`: no one edits; protect the whole tab except the month-selector cell.
- The Sheet handles concurrent edits by multiple teachers natively — no extra work.

## Data volume reality
This is tens of students, a few payments each per month. Google Sheets handles this
without any performance concern. Do not introduce a real database; there is no scale
problem to solve. See `decisions.md` (D1).
