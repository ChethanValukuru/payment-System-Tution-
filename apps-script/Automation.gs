/**
 * Automation — the two triggered behaviours.
 *
 *  1. onPaymentEdit  : when a teacher picks a Student, stamp the Timestamp and
 *                      default the FeeMonth to the current month. Installed as
 *                      an editable trigger so it runs as the owner and can write
 *                      the protected Timestamp column.
 *  2. emailMonthlyReport : on the 1st of each month, email the previous month's
 *                      report to the main teacher with an .xlsx attachment.
 *                      This is "the one thing left to build" (report-spec.md).
 *
 * installTriggers_() (called by setup()) wires both up idempotently.
 */

// ---- Trigger installation ---------------------------------------------------

function installTriggers_() {
  var ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var wanted = ['onPaymentEdit', 'emailMonthlyReport'];

  // Clear our own existing triggers so re-running setup doesn't duplicate them.
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (wanted.indexOf(existing[i].getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }

  ScriptApp.newTrigger('onPaymentEdit')
    .forSpreadsheet(ssId).onEdit().create();

  ScriptApp.newTrigger('emailMonthlyReport')
    .timeBased().onMonthDay(1).atHour(7).create();
}

// ---- 1. Auto-timestamp on payment entry ------------------------------------

function onPaymentEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== SHEET_PAYMENTS) return;

  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (row < 2) return;
  // Only react when the Student cell (col B = 2) gets a value.
  if (col !== 2 || e.range.getValue() === '') return;

  var tsCell = sh.getRange(row, 1);          // A: Timestamp
  if (tsCell.getValue() === '') {
    tsCell.setValue(new Date());
  }
  var monthCell = sh.getRange(row, 3);       // C: FeeMonth
  if (monthCell.getValue() === '') {
    monthCell.setNumberFormat('@');
    monthCell.setValue(
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM'));
  }
}

// ---- 2. Monthly report email ------------------------------------------------

function emailMonthlyReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = ss.getSheetByName(SHEET_REPORT);
  var calc = ss.getSheetByName(SHEET_CALC);
  if (!report || !calc) return;

  var to = PropertiesService.getScriptProperties().getProperty(PROP_MAIN_EMAIL);
  if (!to) {
    Logger.log('No MAIN_TEACHER_EMAIL set; skipping monthly email.');
    return;
  }

  var tz = Session.getScriptTimeZone();
  var prevMonth = Utilities.formatDate(monthsAgo_(1), tz, 'yyyy-MM');

  // Point the report at last month, without permanently changing what the
  // owner sees: save the current selection and restore it afterwards.
  var selCell = report.getRange('B1');
  var original = selCell.getValue();
  selCell.setNumberFormat('@').setValue(prevMonth);
  SpreadsheetApp.flush();

  try {
    var monthName = report.getRange('D1').getDisplayValue() || prevMonth;
    var countPaid = report.getRange('B4').getDisplayValue();
    var countExp  = report.getRange('B5').getDisplayValue();
    var collected = report.getRange('B6').getDisplayValue();
    var cash      = report.getRange('B7').getDisplayValue();
    var upi       = report.getRange('B8').getDisplayValue();

    var unpaid = collectUnpaid_(calc);

    var subject = 'Tuition fees report — ' + monthName;
    var body = buildEmailBody_(monthName, countPaid, countExp, collected, cash, upi,
                               unpaid, ss.getUrl());

    var options = { htmlBody: body };
    var xlsx = exportXlsx_(ss, 'Tuition fees ' + prevMonth);
    if (xlsx) options.attachments = [xlsx];

    MailApp.sendEmail(to, subject, plainFallback_(monthName, countPaid, countExp,
                      collected, cash, upi, unpaid, ss.getUrl()), options);
  } finally {
    // Restore the owner's previously-selected month.
    selCell.setNumberFormat('@').setValue(original);
    SpreadsheetApp.flush();
  }
}

function collectUnpaid_(calc) {
  // Calc columns: D ParentName(4), P GroupOwed(16), Q GroupStudents(17),
  // R IsFirst(18). One entry per parent group.
  var data = calc.getRange(2, 1, CALC_ROWS, 20).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var isFirst = data[i][17]; // R
    if (isFirst === true) {
      out.push({
        parent:   data[i][3],   // D
        students: data[i][16],  // Q
        owed:     data[i][15]   // P
      });
    }
  }
  return out;
}

function buildEmailBody_(monthName, paid, exp, collected, cash, upi, unpaid, url) {
  var rows = unpaid.map(function (u) {
    return '<tr><td style="padding:2px 10px 2px 0">' + escape_(u.parent || '—') +
           '</td><td style="padding:2px 10px 2px 0">' + escape_(u.students) +
           '</td><td style="padding:2px 0;text-align:right">₹' + u.owed + '</td></tr>';
  }).join('');
  if (!rows) rows = '<tr><td colspan="3" style="padding:2px 0">Everyone has paid 🎉</td></tr>';

  return '' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#202124">' +
    '<h2 style="margin:0 0 8px">Tuition fees — ' + escape_(monthName) + '</h2>' +
    '<table style="border-collapse:collapse;margin:8px 0">' +
    row_('Paid (full)', paid + ' of ' + exp) +
    row_('Total collected', '₹' + collected) +
    row_('Cash', '₹' + cash) +
    row_('UPI', '₹' + upi) +
    '</table>' +
    '<h3 style="margin:16px 0 4px">Unpaid</h3>' +
    '<table style="border-collapse:collapse;font-size:13px">' + rows + '</table>' +
    '<p style="margin:16px 0 0"><a href="' + url + '">Open the sheet</a> to send reminders.</p>' +
    '<p style="color:#5f6368;font-size:12px">Attached: the full report as an Excel (.xlsx) file.</p>' +
    '</div>';
}

function plainFallback_(monthName, paid, exp, collected, cash, upi, unpaid, url) {
  var lines = [
    'Tuition fees — ' + monthName,
    'Paid (full): ' + paid + ' of ' + exp,
    'Total collected: ₹' + collected + '  (Cash ₹' + cash + ', UPI ₹' + upi + ')',
    '', 'Unpaid:'
  ];
  if (unpaid.length === 0) {
    lines.push('  Everyone has paid.');
  } else {
    unpaid.forEach(function (u) {
      lines.push('  - ' + (u.parent || '(no parent name)') + ': ' + u.students + ' — owes ₹' + u.owed);
    });
  }
  lines.push('', 'Open the sheet: ' + url);
  return lines.join('\n');
}

function row_(label, value) {
  return '<tr><td style="padding:2px 16px 2px 0;color:#5f6368">' + label +
         '</td><td style="padding:2px 0;font-weight:bold">' + value + '</td></tr>';
}

function exportXlsx_(ss, name) {
  try {
    var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      Logger.log('xlsx export failed: ' + resp.getResponseCode());
      return null;
    }
    return resp.getBlob().setName(name + '.xlsx');
  } catch (err) {
    Logger.log('xlsx export error: ' + err);
    return null;
  }
}

function monthsAgo_(n) {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - n, 1);
}

function escape_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Send the current report to yourself now, to preview the monthly email. */
function sendTestReportEmail() {
  emailMonthlyReport();
  SpreadsheetApp.getActiveSpreadsheet().toast('Test report email sent.', 'Tuition Fees Tracker', 5);
}
