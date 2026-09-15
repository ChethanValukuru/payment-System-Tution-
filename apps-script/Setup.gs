/**
 * Tuition Fees Tracker — Sheet builder.
 *
 * Run setup() ONCE against a fresh Google Sheet. It constructs every tab, the
 * dropdowns, the validation, the protection, all Report formulas, and installs
 * the two triggers (auto-timestamp on entry, monthly report email).
 *
 * This is the only code the design allows besides the monthly email
 * (see decisions.md D1). It writes formulas; it does not compute the report
 * itself — the Report tab stays fully formula-driven (report-spec.md).
 *
 * Re-running setup() rebuilds the four data/report tabs from scratch. It clears
 * their contents and formulas but does NOT touch data you have typed unless you
 * let it — so run it on a fresh sheet, or read the README before re-running.
 */

// ---- Layout constants -------------------------------------------------------

var SHEET_ROSTER   = 'Roster';
var SHEET_PAYMENTS = 'Payments';
var SHEET_REPORT   = 'Report';
var SHEET_CLASSES  = 'Classes';
var SHEET_CALC     = 'Calc';

// How many student rows the derived Calc block spans. "Tens of students" per
// data-model.md; 300 is generous headroom and costs nothing at this scale.
var CALC_ROWS = 300;      // data rows 2..301
var CALC_LAST = CALC_ROWS + 1;

var PROP_MAIN_EMAIL = 'MAIN_TEACHER_EMAIL';

// ---------------------------------------------------------------------------

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var classes  = freshSheet_(ss, SHEET_CLASSES);
  var roster   = freshSheet_(ss, SHEET_ROSTER);
  var payments = freshSheet_(ss, SHEET_PAYMENTS);
  var report   = freshSheet_(ss, SHEET_REPORT);
  var calc     = freshSheet_(ss, SHEET_CALC);

  buildClasses_(classes);
  buildRoster_(roster);
  buildPayments_(payments);
  buildCalc_(calc);
  buildReport_(report);

  applyValidation_(ss, roster, payments, classes);
  applyProtection_(ss, roster, payments, report, classes, calc);

  calc.hideSheet();

  // Order the tabs the way a person reads them.
  ss.setActiveSheet(report);
  reorderTabs_(ss, [SHEET_REPORT, SHEET_PAYMENTS, SHEET_ROSTER, SHEET_CLASSES, SHEET_CALC]);

  removeDefaultSheet_(ss);

  // Default the report-email recipient to whoever ran setup. Change any time
  // with setMainTeacherEmail('name@example.com').
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty(PROP_MAIN_EMAIL)) {
    props.setProperty(PROP_MAIN_EMAIL, Session.getEffectiveUser().getEmail() || '');
  }

  installTriggers_();

  SpreadsheetApp.flush();
  ss.toast('Setup complete. Fill Classes fees, then add students in Roster.', 'Tuition Fees Tracker', 8);
}

// ---- Tab builders -----------------------------------------------------------

function buildClasses_(sh) {
  // A:B = class -> default monthly fee (fee lookup, data-model.md D5).
  // D    = teacher names (EnteredBy dropdown).  F = payment methods.
  sh.getRange('A1:F1')
    .setValues([['Class', 'DefaultFee', '', 'Teachers', '', 'Methods']])
    .setFontWeight('bold');

  // Example rows — REPLACE the fees with the centre's real numbers.
  sh.getRange('A2:B6').setValues([
    ['Class 6', 3000],
    ['Class 7', 3000],
    ['Class 8', 3500],
    ['Class 9', 4000],
    ['Class 10', 4500]
  ]);
  sh.getRange('D2:D4').setValues([['Teacher 1'], ['Teacher 2'], ['Teacher 3']]);
  sh.getRange('F2:F3').setValues([['Cash'], ['UPI']]);

  sh.getRange('B2:B').setNumberFormat('₹#,##0');
  sh.getRange('A1:B1').setBackground('#e8eaed');
  sh.setFrozenRows(1);
  sh.getRange('A3').setNote('Fees above are EXAMPLES. Edit them to the centre’s real class fees before use.');
  autosize_(sh, 6);
}

function buildRoster_(sh) {
  var headers = ['Name', 'Class', 'DisplayLabel', 'ParentName', 'ParentWhatsApp',
                 'MonthlyFeeOverride', 'SiblingGroup', 'Status', 'JoinedMonth'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#e8eaed');

  // DisplayLabel is derived: "Name — Class". Auto-fills for every row.
  sh.getRange('C2').setFormula(
    '=ARRAYFORMULA(IF($A2:$A="","",$A2:$A&" — "&$B2:$B))');

  // Keep phone numbers and month strings as literal text.
  sh.getRange('E2:E').setNumberFormat('@');        // ParentWhatsApp: 91XXXXXXXXXX
  sh.getRange('I2:I').setNumberFormat('@');        // JoinedMonth: YYYY-MM
  sh.getRange('F2:F').setNumberFormat('₹#,##0'); // fee override

  sh.getRange('C1').setNote('Auto-built from Name + Class. Do not type here.');
  sh.getRange('E1').setNote('Digits only, country code, no + or spaces. India: 91XXXXXXXXXX.');
  sh.getRange('F1').setNote('Fill ONLY when this student’s fee differs from the class default.');
  sh.getRange('I1').setNote('YYYY-MM. A student is not "unpaid" for months before this.');
  sh.setFrozenRows(1);
  autosize_(sh, headers.length);
}

function buildPayments_(sh) {
  var headers = ['Timestamp', 'Student', 'FeeMonth', 'Amount', 'Method', 'EnteredBy', 'Note'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#e8eaed');

  sh.getRange('A2:A').setNumberFormat('yyyy-mm-dd hh:mm'); // Timestamp (auto-set)
  sh.getRange('C2:C').setNumberFormat('@');                // FeeMonth YYYY-MM (text)
  sh.getRange('D2:D').setNumberFormat('₹#,##0');      // Amount

  sh.getRange('A1').setNote('Set automatically when you pick a Student. Do not type here.');
  sh.getRange('B1').setNote('Pick from the dropdown. Never type a name — this prevents typos.');
  sh.getRange('C1').setNote('The month the payment is FOR. Auto-filled to the current month; change if needed.');
  sh.getRange('D1').setNote('What was actually received. Two rows for one student/month = partial then top-up.');
  sh.setFrozenRows(1);
  autosize_(sh, headers.length);
}

/**
 * Hidden derived block: one row per roster student, computing fee, received,
 * owed, pay-status, and the grouped WhatsApp reminder. The visible Report reads
 * from here so its own formulas stay simple (report-spec.md).
 */
function buildCalc_(sh) {
  var headers = ['Name', 'Class', 'DisplayLabel', 'ParentName', 'ParentWhatsApp',
                 'SiblingGroup', 'Status', 'JoinedMonth', 'Fee', 'Expected',
                 'Received', 'Owed', 'PayStatus', 'ReminderKey', 'NeedsReminder',
                 'GroupOwed', 'GroupStudents', 'IsFirst', 'MessageText', 'ReminderLink'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  var L = CALC_LAST;
  var row2 = [[
    '=IF(Roster!A2="","",Roster!A2)',                                                   // A Name
    '=IF($A2="","",Roster!B2)',                                                         // B Class
    '=IF($A2="","",Roster!C2)',                                                         // C DisplayLabel
    '=IF($A2="","",Roster!D2)',                                                         // D ParentName
    '=IF($A2="","",Roster!E2)',                                                         // E ParentWhatsApp
    '=IF($A2="","",Roster!G2)',                                                         // F SiblingGroup
    '=IF($A2="","",Roster!H2)',                                                         // G Status
    '=IF($A2="","",Roster!I2)',                                                         // H JoinedMonth
    '=IF($A2="","",IF(Roster!F2<>"",Roster!F2,IFERROR(VLOOKUP(Roster!B2,Classes!$A$2:$B,2,FALSE),0)))', // I Fee
    '=IF($A2="",FALSE,AND($G2="Active",OR($H2="",$H2<=Report!$B$1)))',                  // J Expected
    '=IF($A2="",0,SUMIFS(Payments!$D:$D,Payments!$B:$B,$C2,Payments!$C:$C,Report!$B$1))', // K Received
    '=IF($A2="",0,MAX($I2-$K2,0))',                                                     // L Owed
    '=IF($A2="","",IF(NOT($J2),"",IF($K2=0,"Unpaid",IF($K2<$I2,"Partial",IF($K2=$I2,"Paid","Overpaid")))))', // M PayStatus
    '=IF($A2="","",IF($F2<>"",$F2,IF($E2<>"",$E2,$C2)))',                               // N ReminderKey
    '=IF($A2="",FALSE,AND($J2,OR($M2="Unpaid",$M2="Partial")))',                        // O NeedsReminder
    '=IF($O2,SUMIFS($L$2:$L$' + L + ',$N$2:$N$' + L + ',$N2,$O$2:$O$' + L + ',TRUE),"")', // P GroupOwed
    '=IF($O2,TEXTJOIN(", ",TRUE,IF(($N$2:$N$' + L + '=$N2)*($O$2:$O$' + L + '=TRUE),$A$2:$A$' + L + '&" ("&$B$2:$B$' + L + '&")","")),"")', // Q GroupStudents
    '=IF($O2,COUNTIFS($N$2:$N2,$N2,$O$2:$O2,TRUE)=1,FALSE)',                            // R IsFirst
    '=IF(AND($O2,$R2),"Namaste"&IF($D2<>""," "&$D2,"")&", this is a gentle reminder that the tuition fee for "&$Q2&" for "&Report!$D$1&" is pending. Amount due: ₹"&$P2&". You can pay by cash or by scanning our UPI QR. Thank you.","")', // S MessageText
    '=IF(AND($O2,$R2,$E2<>""),HYPERLINK("https://wa.me/"&$E2&"?text="&ENCODEURL($S2),"Send reminder"),"")' // T ReminderLink
  ]];

  sh.getRange('A2:T2').setFormulas(row2);
  sh.getRange('A2:T2').copyTo(sh.getRange('A3:T' + L)); // fill-down (adjusts relative refs)
  sh.getRange('I2:I').setNumberFormat('₹#,##0');
  sh.getRange('K2:L').setNumberFormat('₹#,##0');
  sh.getRange('P2:P').setNumberFormat('₹#,##0');
}

function buildReport_(sh) {
  var L = CALC_LAST;
  var nowMonth = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');

  // Row 1 — month selector (the ONLY editable cell on this tab).
  sh.getRange('A1').setValue('Report month (YYYY-MM):').setFontWeight('bold');
  sh.getRange('B1').setNumberFormat('@').setValue(nowMonth)
    .setBackground('#fff2cc').setFontWeight('bold');
  sh.getRange('C1').setValue('Month:').setFontWeight('bold');
  sh.getRange('D1').setFormula('=IFERROR(TEXT(DATEVALUE($B$1&"-01"),"MMMM YYYY"),$B$1)');
  sh.getRange('B1').setNote('Type any month as YYYY-MM (e.g. 2026-09). The whole report recomputes.');

  // Summary block.
  sh.getRange('A3').setValue('SUMMARY').setFontWeight('bold').setBackground('#e8eaed');
  var summary = [
    ['Count paid (full)',   '=COUNTIF(Calc!$M$2:$M$' + L + ',"Paid")'],
    ['Count expected',      '=COUNTIF(Calc!$J$2:$J$' + L + ',TRUE)'],
    ['Total collected',     '=SUMIFS(Payments!$D:$D,Payments!$C:$C,$B$1)'],
    ['Cash total',          '=SUMIFS(Payments!$D:$D,Payments!$C:$C,$B$1,Payments!$E:$E,"Cash")'],
    ['UPI total',           '=SUMIFS(Payments!$D:$D,Payments!$C:$C,$B$1,Payments!$E:$E,"UPI")']
  ];
  for (var i = 0; i < summary.length; i++) {
    var r = 4 + i;
    sh.getRange(r, 1).setValue(summary[i][0]);
    sh.getRange(r, 2).setFormula(summary[i][1]);
  }
  sh.getRange('B6:B8').setNumberFormat('₹#,##0');

  // Per-class breakdown (driven off the Classes list, up to 20 classes).
  sh.getRange('A10').setValue('PER-CLASS BREAKDOWN').setFontWeight('bold').setBackground('#e8eaed');
  sh.getRange('A11:D11').setValues([['Class', 'Expected', 'Paid', 'Collected']]).setFontWeight('bold');
  for (var k = 0; k < 20; k++) {
    var rr = 12 + k;
    var cls = k + 2; // Classes row
    sh.getRange(rr, 1).setFormula('=IF(Classes!A' + cls + '="","",Classes!A' + cls + ')');
    sh.getRange(rr, 2).setFormula('=IF($A' + rr + '="","",COUNTIFS(Calc!$B$2:$B$' + L + ',$A' + rr + ',Calc!$J$2:$J$' + L + ',TRUE))');
    sh.getRange(rr, 3).setFormula('=IF($A' + rr + '="","",COUNTIFS(Calc!$B$2:$B$' + L + ',$A' + rr + ',Calc!$M$2:$M$' + L + ',"Paid"))');
    sh.getRange(rr, 4).setFormula('=IF($A' + rr + '="","",SUMIFS(Calc!$K$2:$K$' + L + ',Calc!$B$2:$B$' + L + ',$A' + rr + '))');
  }
  sh.getRange('D12:D31').setNumberFormat('₹#,##0');

  // Unpaid list — one row per parent (siblings grouped), with a tap-to-send link.
  sh.getRange('A33').setValue('UNPAID LIST  (one row per parent — tap to send)')
    .setFontWeight('bold').setBackground('#e8eaed');
  sh.getRange('A34:D34').setValues([['Parent', 'Student(s)', 'Total owed', 'Reminder']]).setFontWeight('bold');
  sh.getRange('A35').setFormula(
    '=IFERROR(FILTER({Calc!$D$2:$D$' + L + ',Calc!$Q$2:$Q$' + L + ',Calc!$P$2:$P$' + L + ',Calc!$T$2:$T$' + L + '},Calc!$R$2:$R$' + L + '=TRUE),"None 🎉")');
  sh.getRange('C35:C').setNumberFormat('₹#,##0');

  // Partial payments (top-right band).
  sh.getRange('F3').setValue('PARTIAL PAYMENTS').setFontWeight('bold').setBackground('#e8eaed');
  sh.getRange('F4:J4').setValues([['Name', 'Class', 'Received', 'Fee', 'Owed']]).setFontWeight('bold');
  sh.getRange('F5').setFormula(
    '=IFERROR(FILTER({Calc!$A$2:$A$' + L + ',Calc!$B$2:$B$' + L + ',Calc!$K$2:$K$' + L + ',Calc!$I$2:$I$' + L + ',Calc!$L$2:$L$' + L + '},Calc!$M$2:$M$' + L + '="Partial"),"None")');

  // Overpaid / duplicate-entry flags (further-right band).
  sh.getRange('L3').setValue('OVERPAID / CHECK').setFontWeight('bold').setBackground('#e8eaed');
  sh.getRange('L4:O4').setValues([['Name', 'Class', 'Received', 'Fee']]).setFontWeight('bold');
  sh.getRange('L5').setFormula(
    '=IFERROR(FILTER({Calc!$A$2:$A$' + L + ',Calc!$B$2:$B$' + L + ',Calc!$K$2:$K$' + L + ',Calc!$I$2:$I$' + L + '},Calc!$M$2:$M$' + L + '="Overpaid"),"None")');

  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 180);
  sh.setColumnWidth(2, 220);
}

// ---- Validation -------------------------------------------------------------

function applyValidation_(ss, roster, payments, classes) {
  // Roster.Class -> Classes list.
  var classRange = classes.getRange('A2:A21');
  roster.getRange('B2:B').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(classRange, true)
      .setAllowInvalid(false).build());

  // Roster.Status -> Active / Left.
  roster.getRange('H2:H').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Active', 'Left'], true)
      .setAllowInvalid(false).build());

  // Payments.Student -> Roster.DisplayLabel (the anti-typo control).
  payments.getRange('B2:B').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(roster.getRange('C2:C' + CALC_LAST), true)
      .setAllowInvalid(false).build());

  // Payments.Method -> Cash / UPI.
  payments.getRange('E2:E').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Cash', 'UPI'], true)
      .setAllowInvalid(false).build());

  // Payments.EnteredBy -> Teachers list.
  payments.getRange('F2:F').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(classes.getRange('D2:D21'), true)
      .setAllowInvalid(true).build());
}

// ---- Protection -------------------------------------------------------------

function applyProtection_(ss, roster, payments, report, classes, calc) {
  // Owner-only tabs: Roster, Classes, Calc, and the derived parts of Report.
  ownerOnlySheet_(roster,  'Roster — main teacher only');
  ownerOnlySheet_(classes, 'Classes / config — main teacher only');
  ownerOnlySheet_(calc,    'Derived — do not edit');

  // Report: protect everything except the month selector (B1).
  var rp = report.protect().setDescription('Report — derived; only B1 is editable');
  rp.setUnprotectedRanges([report.getRange('B1')]);
  lockToOwner_(rp);

  // Payments: teachers add rows. Protect the header + auto Timestamp column;
  // leave Student..Note (B:G) open for entry.
  var pp = payments.protect().setDescription('Payments — add rows in B:G only');
  pp.setUnprotectedRanges([payments.getRange('B2:G' + Math.max(CALC_LAST, 1000))]);
  lockToOwner_(pp);
}

function ownerOnlySheet_(sh, desc) {
  var p = sh.protect().setDescription(desc);
  lockToOwner_(p);
}

function lockToOwner_(protection) {
  try {
    var me = Session.getEffectiveUser();
    protection.addEditor(me);
    var editors = protection.getEditors();
    for (var i = 0; i < editors.length; i++) {
      if (editors[i].getEmail() && editors[i].getEmail() !== me.getEmail()) {
        protection.removeEditor(editors[i]);
      }
    }
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  } catch (err) {
    // Protection is a safety net against accidents, not security. If the
    // environment won't allow editor changes, keep going.
    Logger.log('Protection note: ' + err);
  }
}

// ---- Small helpers ----------------------------------------------------------

function freshSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return ss.insertSheet(name);
  // Drop existing protections so a re-run doesn't stack them, then clear.
  var prots = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)
    .concat(sh.getProtections(SpreadsheetApp.ProtectionType.RANGE));
  for (var i = 0; i < prots.length; i++) {
    try { prots[i].remove(); } catch (e) {}
  }
  sh.clear();
  sh.clearNotes();
  var maxR = sh.getMaxRows(), maxC = sh.getMaxColumns();
  sh.getRange(1, 1, maxR, maxC).setDataValidation(null);
  return sh;
}

function reorderTabs_(ss, order) {
  for (var i = 0; i < order.length; i++) {
    var sh = ss.getSheetByName(order[i]);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  }
}

function removeDefaultSheet_(ss) {
  var def = ss.getSheetByName('Sheet1');
  var known = [SHEET_ROSTER, SHEET_PAYMENTS, SHEET_REPORT, SHEET_CLASSES, SHEET_CALC];
  if (def && known.indexOf('Sheet1') === -1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(def); } catch (e) {}
  }
}

function autosize_(sh, cols) {
  try { sh.autoResizeColumns(1, cols); } catch (e) {}
}

/** Change who receives the monthly report email. */
function setMainTeacherEmail(email) {
  PropertiesService.getScriptProperties().setProperty(PROP_MAIN_EMAIL, email);
  SpreadsheetApp.getActiveSpreadsheet().toast('Report email set to ' + email, 'Tuition Fees Tracker', 5);
}
