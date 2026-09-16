/**
 * Sample-data harness — verification only, not part of the live system.
 *
 * After running setup(), run loadSampleData() to populate a small dataset that
 * exercises every rule in the spec (partial, overpaid, sibling grouping,
 * mid-month join, left student, per-student fee override, missing WhatsApp
 * number). Then open Report and check it against the expected numbers printed
 * in apps-script/README.md.
 *
 * Run clearSampleData() to wipe it and start entering real students.
 *
 * The dataset is built for the CURRENT month, so it stays meaningful whenever
 * you run it.
 */

var DASH = ' — '; // the " — " used in DisplayLabel (Name — Class)

function loadSampleData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roster = ss.getSheetByName(SHEET_ROSTER);
  var payments = ss.getSheetByName(SHEET_PAYMENTS);
  var classes = ss.getSheetByName(SHEET_CLASSES);
  if (!roster || !payments || !classes) {
    SpreadsheetApp.getUi && ss.toast('Run setup() first.', 'Tuition Fees Tracker', 6);
    return;
  }

  var tz = Session.getScriptTimeZone();
  var thisMonth = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  var nextMonth = Utilities.formatDate(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), tz, 'yyyy-MM');

  clearSampleData(); // idempotent: start from a clean roster/payments

  // Deterministic class fees so the expected totals hold.
  classes.getRange('A2:B6').setValues([
    ['Class 6', 3000], ['Class 7', 3000], ['Class 8', 3500],
    ['Class 9', 4000], ['Class 10', 4500]
  ]);

  // Roster. Columns: A Name, B Class, (C DisplayLabel is a formula — skip),
  // D ParentName, E ParentWhatsApp, F MonthlyFeeOverride, G SiblingGroup,
  // H Status, I JoinedMonth.
  var students = [
    // Name,     Class,      Parent,  WhatsApp,         Override, Sibling,     Status,  Joined
    ['Aarav',   'Class 8',  'Meera', '919000000001',   '',       '',          'Active', '2026-01'], // pays full -> Paid
    ['Diya',    'Class 6',  'Ravi',  '919000000002',   '',       'SharmaFam', 'Active', '2025-06'], // partial
    ['Kabir',   'Class 10', 'Ravi',  '919000000002',   '',       'SharmaFam', 'Active', '2025-06'], // unpaid (grouped w/ Diya)
    ['Aanya',   'Class 9',  'Sunita','919000000003',   2000,     '',          'Active', '2026-02'], // override 2000 -> Paid
    ['Vihaan',  'Class 7',  'Anil',  '',               '',       '',          'Active', '2025-09'], // unpaid, NO number -> no link
    ['Ishaan',  'Class 8',  'Priya', '919000000005',   '',       '',          'Active', nextMonth], // joins next month -> not expected
    ['Riya',    'Class 10', 'Gita',  '919000000006',   '',       '',          'Left',   '2024-06'], // left -> excluded
    ['Advait',  'Class 6',  'Neha',  '919000000007',   '',       '',          'Active', '2025-11']  // overpays -> Overpaid flag
  ];
  writeCols_(roster, 2, {A: col_(students, 0), B: col_(students, 1)});
  writeCols_(roster, 2, {D: col_(students, 2), E: col_(students, 3),
                         F: col_(students, 4), G: col_(students, 5),
                         H: col_(students, 6), I: col_(students, 7)});
  roster.getRange('E2:E').setNumberFormat('@');
  roster.getRange('I2:I').setNumberFormat('@');

  // Payments for THIS month. A Timestamp, B Student(label), C FeeMonth,
  // D Amount, E Method, F EnteredBy.
  var ts = new Date();
  var pays = [
    [ts, 'Aarav' + DASH + 'Class 8',  thisMonth, 3500, 'UPI',  'Teacher 1'], // full
    [ts, 'Diya' + DASH + 'Class 6',   thisMonth, 1000, 'Cash', 'Teacher 1'], // partial
    [ts, 'Aanya' + DASH + 'Class 9',  thisMonth, 2000, 'UPI',  'Teacher 2'], // == override fee -> Paid
    [ts, 'Advait' + DASH + 'Class 6', thisMonth, 3500, 'Cash', 'Teacher 2']  // > fee -> Overpaid
  ];
  payments.getRange('C2:C' + (1 + pays.length)).setNumberFormat('@');
  payments.getRange(2, 1, pays.length, 6).setValues(pays);

  SpreadsheetApp.flush();
  ss.toast('Sample data loaded for ' + thisMonth + '. Check Report against the README.',
           'Tuition Fees Tracker', 8);
}

function clearSampleData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roster = ss.getSheetByName(SHEET_ROSTER);
  var payments = ss.getSheetByName(SHEET_PAYMENTS);
  if (roster) {
    var lastR = Math.max(roster.getLastRow(), 2);
    // Clear data columns but preserve the DisplayLabel formula in C.
    roster.getRange('A2:B' + lastR).clearContent();
    roster.getRange('D2:I' + lastR).clearContent();
  }
  if (payments) {
    var lastP = Math.max(payments.getLastRow(), 2);
    payments.getRange('A2:G' + lastP).clearContent();
  }
  SpreadsheetApp.flush();
}

// ---- helpers ----

function col_(rows, i) {
  return rows.map(function (r) { return r[i]; });
}

// writeCols_(sheet, startRow, {A:[...], D:[...]}) writes each column array.
function writeCols_(sheet, startRow, colMap) {
  Object.keys(colMap).forEach(function (letter) {
    var arr = colMap[letter];
    var values = arr.map(function (v) { return [v]; });
    sheet.getRange(letter + startRow + ':' + letter + (startRow + arr.length - 1))
      .setValues(values);
  });
}
