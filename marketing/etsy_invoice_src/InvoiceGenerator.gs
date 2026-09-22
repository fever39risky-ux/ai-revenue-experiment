/**
 * Google Sheets Invoice Generator — bulk PDF invoices + Gmail drafts
 * ------------------------------------------------------------------
 * One row in the "Invoices" sheet = one invoice. Click
 * Invoices > Create invoices for new rows and the script:
 *   1. calculates subtotal / tax / total in code (no manual math),
 *   2. saves a numbered PDF invoice to a Google Drive folder,
 *   3. creates a Gmail DRAFT to the client with the PDF attached
 *      (it never sends anything on its own — you review and press Send),
 *   4. writes the invoice number, PDF link and "Done" back to the row.
 *
 * Setup (about 5 minutes, see the Setup Guide PDF):
 *   1) Create a new Google Sheet > Extensions > Apps Script.
 *   2) Delete the sample code, paste this whole file, click Save.
 *   3) Edit the CONFIG block below (your business name, details, currency, tax).
 *   4) Reload the sheet. Use Invoices > Set up sheet (first time only).
 *   5) Fill rows, then Invoices > Create invoices for new rows.
 *      Google asks for permission the first time (Sheets, Docs, Drive, Gmail).
 *
 * Optional: an AI-written cover email. Leave OPENAI_API_KEY empty and a
 * clean built-in email template is used instead. AI only ever writes the
 * email wording — every amount is calculated by this script.
 */

const CONFIG = {
  BUSINESS_NAME: 'Your Business Name',
  BUSINESS_DETAILS: '123 Example Street, City\nyou@example.com\nTax ID: (optional)',
  PAYMENT_DETAILS: 'Bank transfer: Bank name, Account 0000000\nPayPal: you@example.com',
  CURRENCY_SYMBOL: '$',          // e.g. '$', '€', '£', 'A$'
  CURRENCY_DECIMALS: 2,
  TAX_RATE: 0,                    // e.g. 0.2 for 20% VAT; 0 = no tax line
  TAX_LABEL: 'Tax',               // e.g. 'VAT', 'GST', 'Sales tax'
  DUE_DAYS: 14,                   // payment due N days after issue date
  INVOICE_PREFIX: 'INV-',
  PDF_FOLDER: 'Invoices (PDF)',   // Drive folder, created automatically
  CREATE_GMAIL_DRAFT: true,       // false = PDF only, no email draft
  SHEET_NAME: 'Invoices',
  OPENAI_API_KEY: '',             // optional, leave '' to use the template email
  OPENAI_MODEL: 'gpt-4o-mini'
};

// Column layout of the Invoices sheet (1-based).
const COL = { CLIENT: 1, CONTACT: 2, EMAIL: 3, PROJECT: 4, ITEMS: 5, NOTES: 6,
              STATUS: 7, NUMBER: 8, PDF: 9 };
const HEADERS = ['Client / Company', 'Contact name', 'Client email', 'Project / Subject',
  'Line items (one per line: Item ; Qty ; Unit price)', 'Notes on invoice (optional)',
  'Status', 'Invoice #', 'PDF link'];
const DONE = 'Done';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Invoices')
    .addItem('Create invoices for new rows', 'createInvoices')
    .addSeparator()
    .addItem('Set up sheet (first time)', 'setupSheet')
    .addToUi();
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() > 0) {
    SpreadsheetApp.getUi().alert('The "' + CONFIG.SHEET_NAME + '" sheet already has data — nothing changed.');
    return;
  }
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.getRange(2, 1, 2, 6).setValues([
    ['Acme Ltd', 'Jane Smith', 'jane@example.com', 'Website update — May',
     'Homepage redesign ; 1 ; 450\nExtra page ; 2 ; 120', 'Thank you for your business!'],
    ['Blue Cafe', 'Tom Lee', 'tom@example.com', 'Monthly bookkeeping',
     'Bookkeeping (monthly) ; 1 ; 300', '']
  ]);
  sheet.getRange(2, COL.ITEMS, 2, 1).setWrap(true);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
  sheet.setColumnWidth(COL.ITEMS, 360);
}

function createInvoices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + CONFIG.SHEET_NAME + ' (run Invoices > Set up sheet)');
  const folder = getOrCreateFolder_(CONFIG.PDF_FOLDER);
  const values = sheet.getDataRange().getValues();
  const props = PropertiesService.getDocumentProperties();

  let made = 0, failed = 0;
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const client = String(row[COL.CLIENT - 1] || '').trim();
    const status = String(row[COL.STATUS - 1] || '').trim();
    if (!client || status === DONE) continue;
    try {
      const items = parseItems(row[COL.ITEMS - 1]);
      if (items.length === 0) throw new Error('no valid line items (format: Item ; Qty ; Unit price)');
      const totals = calcTotals(items, CONFIG.TAX_RATE);
      const number = nextInvoiceNumber_(props);
      const inv = {
        number, client,
        contact: String(row[COL.CONTACT - 1] || '').trim(),
        email: String(row[COL.EMAIL - 1] || '').trim(),
        project: String(row[COL.PROJECT - 1] || '').trim(),
        notes: String(row[COL.NOTES - 1] || '').trim(),
        items, totals,
        issued: new Date(),
        due: new Date(Date.now() + CONFIG.DUE_DAYS * 864e5)
      };
      const pdf = makePdf_(folder, inv);
      if (CONFIG.CREATE_GMAIL_DRAFT && inv.email) {
        GmailApp.createDraft(inv.email, 'Invoice ' + number + (inv.project ? ' — ' + inv.project : ''),
          coverEmail_(inv), { attachments: [pdf.getBlob()] });
      }
      sheet.getRange(r + 1, COL.STATUS, 1, 3).setValues([[DONE, number, pdf.getUrl()]]);
      made++;
    } catch (e) {
      sheet.getRange(r + 1, COL.STATUS).setValue('ERROR: ' + e.message);
      failed++;
    }
  }
  ss.toast(made + ' invoice(s) created' + (failed ? ', ' + failed + ' error(s) — see Status column' : ''),
           'Invoices', 6);
}

// ---- pure helpers (no Google services; unit-testable) ----

function parseItems(raw) {
  return String(raw || '').split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const parts = line.split(';').map(x => (x || '').trim());
    const qty = Number(parts[1]);
    const price = Number(String(parts[2] || '').replace(/[^0-9.\-]/g, ''));
    return { name: parts[0], qty, price };
  }).filter(it => it.name && isFinite(it.qty) && it.qty > 0 && isFinite(it.price));
}

function calcTotals(items, taxRate) {
  const round = n => Math.round(n * 100) / 100;
  const subtotal = round(items.reduce((s, it) => s + it.qty * it.price, 0));
  const tax = round(subtotal * (taxRate || 0));
  return { subtotal, tax, total: round(subtotal + tax) };
}

function money(n) {
  const fixed = Number(n).toFixed(CONFIG.CURRENCY_DECIMALS);
  const [i, d] = fixed.split('.');
  return CONFIG.CURRENCY_SYMBOL + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
}

function templateEmail(inv) {
  return 'Hi ' + (inv.contact || inv.client) + ',\n\n' +
    'Please find attached invoice ' + inv.number + (inv.project ? ' for ' + inv.project : '') +
    ', totalling ' + money(inv.totals.total) + ', due on ' + fmtDate_(inv.due) + '.\n\n' +
    'Payment details are on the invoice. Let me know if you have any questions.\n\n' +
    'Thank you,\n' + CONFIG.BUSINESS_NAME;
}

// ---- Google-service helpers ----

function coverEmail_(inv) {
  if (!CONFIG.OPENAI_API_KEY) return templateEmail(inv);
  try {
    const prompt = 'Write a short, friendly, professional email body (no subject line, no signature) ' +
      'sending an invoice to a client. Do not invent any facts, discounts or amounts.\n' +
      'Client contact: ' + (inv.contact || inv.client) + '\nInvoice number: ' + inv.number +
      '\nProject: ' + (inv.project || '(none)') + '\nTotal: ' + money(inv.totals.total) +
      '\nDue date: ' + fmtDate_(inv.due) + '\nMention the invoice PDF is attached.';
    return askAI_(prompt) + '\n\n' + CONFIG.BUSINESS_NAME;
  } catch (e) {
    return templateEmail(inv); // never block an invoice because the AI call failed
  }
}

function askAI_(prompt) {
  const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.OPENAI_API_KEY },
    payload: JSON.stringify({ model: CONFIG.OPENAI_MODEL, temperature: 0.3,
      messages: [{ role: 'user', content: prompt }] }),
    muteHttpExceptions: true
  });
  const body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) throw new Error((body.error && body.error.message) || 'AI error');
  return body.choices[0].message.content.trim();
}

function makePdf_(folder, inv) {
  const doc = DocumentApp.create(inv.number);
  const b = doc.getBody();
  b.appendParagraph('INVOICE').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  b.appendParagraph(CONFIG.BUSINESS_NAME).editAsText().setBold(true);
  b.appendParagraph(CONFIG.BUSINESS_DETAILS);
  b.appendParagraph('');
  b.appendParagraph('Bill to: ' + inv.client + (inv.contact ? ' (Attn: ' + inv.contact + ')' : ''));
  if (inv.project) b.appendParagraph('Project: ' + inv.project);
  b.appendParagraph('Invoice #: ' + inv.number + '    Date: ' + fmtDate_(inv.issued) +
                    '    Due: ' + fmtDate_(inv.due));
  b.appendParagraph('');
  const rows = [['Item', 'Qty', 'Unit price', 'Amount']];
  inv.items.forEach(it => rows.push([it.name, String(it.qty), money(it.price), money(it.qty * it.price)]));
  rows.push(['', '', 'Subtotal', money(inv.totals.subtotal)]);
  if (CONFIG.TAX_RATE) rows.push(['', '', CONFIG.TAX_LABEL + ' (' + (CONFIG.TAX_RATE * 100) + '%)',
                                  money(inv.totals.tax)]);
  rows.push(['', '', 'TOTAL DUE', money(inv.totals.total)]);
  const table = b.appendTable(rows);
  table.getRow(0).editAsText().setBold(true);
  table.getRow(rows.length - 1).editAsText().setBold(true);
  b.appendParagraph('');
  b.appendParagraph('Payment details').editAsText().setBold(true);
  b.appendParagraph(CONFIG.PAYMENT_DETAILS);
  if (inv.notes) { b.appendParagraph(''); b.appendParagraph(inv.notes); }
  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  const pdf = folder.createFile(file.getAs('application/pdf')).setName(inv.number + '.pdf');
  file.setTrashed(true); // keep Drive tidy: only the PDF is kept
  return pdf;
}

function nextInvoiceNumber_(props) {
  const n = Number(props.getProperty('INVOICE_SEQ') || '0') + 1;
  props.setProperty('INVOICE_SEQ', String(n));
  return CONFIG.INVOICE_PREFIX + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy') +
         '-' + ('000' + n).slice(-4);
}

function fmtDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'd MMM yyyy');
}

function getOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
