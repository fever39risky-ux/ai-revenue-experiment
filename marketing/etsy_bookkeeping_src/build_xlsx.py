#!/usr/bin/env python3
"""Build the Small Business Bookkeeping Tracker .xlsx with the stdlib only.

Formulas are written without cached values and the workbook is flagged
fullCalcOnLoad, so Excel / Google Sheets / Numbers compute them on open.
Also prints the computed sample dashboard (python mirror of the formulas)
so the listing mockups show numbers the real file will produce.
Usage: python3 build_xlsx.py OUT.xlsx
"""
import sys, zipfile, datetime
from xml.sax.saxutils import escape

YEAR = 2026
INCOME = ["Sales", "Services", "Commissions", "Refunds received", "Other income"]
EXPENSE = ["Supplies & materials", "Software & subscriptions", "Advertising & marketing",
           "Shipping & postage", "Platform & payment fees", "Office & equipment",
           "Phone & internet", "Travel & mileage", "Professional services", "Rent & utilities",
           "Insurance", "Education & training", "Bank charges", "Other expenses"]
N_INC, N_EXP = 10, 20            # category slots (blank slots are ignored)
TX_ROWS = 2000                   # preformatted transaction rows
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

SAMPLE = [  # (month, day, category, description, amount, method)
    (1, 5, "Sales", "Online shop orders (week 1)", 640, "Card"),
    (1, 9, "Software & subscriptions", "Design software", 29.99, "Card"),
    (1, 14, "Supplies & materials", "Packaging and labels", 86.4, "Card"),
    (1, 21, "Services", "Logo design client", 450, "Bank transfer"),
    (1, 28, "Platform & payment fees", "Marketplace fees January", 58.2, "Deducted"),
    (2, 3, "Sales", "Online shop orders", 910, "Card"),
    (2, 11, "Advertising & marketing", "Social media ads", 120, "Card"),
    (2, 18, "Shipping & postage", "Postage", 74.5, "Cash"),
    (2, 25, "Services", "Website update client", 300, "PayPal"),
    (3, 4, "Sales", "Online shop orders", 1180, "Card"),
    (3, 12, "Office & equipment", "Printer ink", 45, "Card"),
    (3, 19, "Phone & internet", "Internet March", 55, "Direct debit"),
    (3, 27, "Platform & payment fees", "Marketplace fees March", 94.4, "Deducted"),
    (4, 2, "Sales", "Online shop orders", 1020, "Card"),
    (4, 15, "Supplies & materials", "Materials restock", 210, "Card"),
    (4, 22, "Commissions", "Affiliate payout", 62.3, "Bank transfer"),
    (5, 6, "Sales", "Online shop orders", 1340, "Card"),
    (5, 14, "Professional services", "Accountant", 150, "Bank transfer"),
    (5, 20, "Advertising & marketing", "Promoted listings", 90, "Card"),
    (6, 3, "Sales", "Online shop orders", 1265, "Card"),
    (6, 10, "Services", "Product photos client", 380, "Bank transfer"),
    (6, 18, "Shipping & postage", "Postage", 96.8, "Cash"),
    (6, 26, "Software & subscriptions", "Email marketing tool", 19, "Card"),
]

def col(n):  # 1 -> A
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s

def serial(y, m, d):
    return (datetime.date(y, m, d) - datetime.date(1899, 12, 30)).days

# ---- style ids (see STYLES) ----
S_DEF, S_HEAD, S_DATE, S_MONEY, S_PCT, S_TITLE, S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_BAR_R, S_INPUT_PCT, S_BOLD = range(13)

class Sheet:
    def __init__(self, name):
        self.name, self.rows, self.cols, self.merges, self.dv, self.freeze = name, {}, [], [], [], None
    def put(self, ref_col, row, value=None, formula=None, style=0):
        self.rows.setdefault(row, {})[ref_col] = (value, formula, style)
    def xml(self):
        out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
               '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
               'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">']
        out.append('<sheetViews><sheetView workbookViewId="0"%s>' % (' tabSelected="1"' if self.name == "Start Here" else ''))
        if self.freeze:
            c, r = self.freeze
            out.append('<pane %sySplit="%d" topLeftCell="%s%d" activePane="bottomLeft" state="frozen"/>' % (
                ('xSplit="%d" ' % (c - 1)) if c > 1 else '', r - 1, col(c), r))
        out.append('</sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/>')
        if self.cols:
            out.append('<cols>' + ''.join('<col min="%d" max="%d" width="%s" customWidth="1"/>' % (i, i, w) for i, w in self.cols) + '</cols>')
        out.append('<sheetData>')
        for r in sorted(self.rows):
            cells = []
            for c in sorted(self.rows[r]):
                v, f, s = self.rows[r][c]
                ref = '%s%d' % (col(c), r)
                st = ' s="%d"' % s if s else ''
                if f is not None:
                    cells.append('<c r="%s"%s><f>%s</f></c>' % (ref, st, escape(f)))
                elif isinstance(v, str):
                    cells.append('<c r="%s"%s t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (ref, st, escape(v)))
                elif v is not None:
                    cells.append('<c r="%s"%s><v>%s</v></c>' % (ref, st, v))
                else:
                    cells.append('<c r="%s"%s/>' % (ref, st))
            out.append('<row r="%d">%s</row>' % (r, ''.join(cells)))
        out.append('</sheetData>')
        if self.merges:
            out.append('<mergeCells count="%d">%s</mergeCells>' % (len(self.merges), ''.join('<mergeCell ref="%s"/>' % m for m in self.merges)))
        if self.dv:
            out.append('<dataValidations count="%d">' % len(self.dv))
            for sq, f1 in self.dv:
                out.append('<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="%s"><formula1>%s</formula1></dataValidation>' % (sq, escape(f1)))
            out.append('</dataValidations>')
        out.append('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>')
        return ''.join(out)

TX = "Transactions"
def rng(c):  # whole preformatted transaction column
    return "%s!$%s$2:$%s$%d" % (TX, c, c, TX_ROWS + 1)

# ---------------- Start Here (settings) ----------------
start = Sheet("Start Here"); start.cols = [(1, 30), (2, 26), (3, 60)]
start.put(1, 1, "Small Business Bookkeeping Tracker", style=S_TITLE)
start.put(1, 2, "Income & expenses, monthly profit and loss, tax set-aside. Works in Google Sheets, Excel and Numbers.", style=S_MUTED)
start.put(1, 4, "Settings", style=S_HEAD); start.put(2, 4, "Your value", style=S_HEAD); start.put(3, 4, "Notes", style=S_HEAD)
settings = [("Business name", "Your Business Name", S_INPUT, "Shown on the Dashboard"),
            ("Tracking year", YEAR, S_INPUT, "Only transactions dated in this year are counted"),
            ("Currency", "USD", S_INPUT, "Label only. Amounts are plain numbers, so any currency works"),
            ("Tax set-aside rate", 0.25, S_INPUT_PCT, "Share of profit to put aside for tax (estimate only, not tax advice)")]
for i, (k, v, s, n) in enumerate(settings):
    start.put(1, 5 + i, k, style=S_BOLD); start.put(2, 5 + i, v, style=s); start.put(3, 5 + i, n, style=S_MUTED)
steps = ["How to use it",
         "1. Set your business name, year, currency and tax rate above (yellow cells).",
         "2. Optional: rename or add categories on the Categories tab. Changes flow through everywhere.",
         "3. Record every sale and every cost on the Transactions tab: date, category (dropdown), amount.",
         "   Enter all amounts as positive numbers. Income or Expense is filled in for you from the category.",
         "4. Open the Dashboard and Monthly P&L tabs. Everything is calculated automatically.",
         "5. The sample rows (Jan to Jun) show how it works. Delete them when you start.",
         "",
         "Google Sheets: upload this file to Google Drive, then open it with Google Sheets (or File > Import).",
         "Excel / Numbers: just open the file.",
         "Only edit the yellow cells, the Categories tab and the Transactions tab. Grey formula cells update themselves."]
for i, t in enumerate(steps):
    start.put(1, 11 + i, t, style=S_HEAD if i == 0 else S_DEF)
YEAR_REF, CUR_REF, TAX_REF, NAME_REF = "'Start Here'!$B$6", "'Start Here'!$B$7", "'Start Here'!$B$8", "'Start Here'!$B$5"

# ---------------- Categories ----------------
cats = Sheet("Categories"); cats.cols = [(1, 32), (2, 12), (3, 50)]
cats.put(1, 1, "Category", style=S_HEAD); cats.put(2, 1, "Type", style=S_HEAD); cats.put(3, 1, "Tip", style=S_HEAD)
for i in range(N_INC):
    cats.put(1, 2 + i, INCOME[i] if i < len(INCOME) else None, style=S_INPUT); cats.put(2, 2 + i, "Income", style=S_MUTED)
for i in range(N_EXP):
    cats.put(1, 2 + N_INC + i, EXPENSE[i] if i < len(EXPENSE) else None, style=S_INPUT); cats.put(2, 2 + N_INC + i, "Expense", style=S_MUTED)
cats.put(3, 2, "Rows 2-11 are income categories.", style=S_MUTED)
cats.put(3, 12, "Rows 12-31 are expense categories.", style=S_MUTED)
cats.put(3, 3, "Rename any category or fill a blank yellow cell to add one.", style=S_MUTED)
INC_RANGE = "Categories!$A$2:$A$%d" % (1 + N_INC)
ALL_RANGE = "Categories!$A$2:$A$%d" % (1 + N_INC + N_EXP)

# ---------------- Transactions ----------------
tx = Sheet(TX); tx.freeze = (1, 2)
tx.cols = [(1, 13), (2, 28), (3, 34), (4, 14), (5, 16), (6, 30), (7, 11), (8, 8), (9, 8)]
for c, h in enumerate(["Date", "Category", "Description", "Amount", "Payment method", "Notes", "Type (auto)", "Month", "Year"], 1):
    tx.put(c, 1, h, style=S_HEAD)
for r in range(2, TX_ROWS + 2):
    i = r - 2
    if i < len(SAMPLE):
        m, d, cat, desc, amt, meth = SAMPLE[i]
        tx.put(1, r, serial(YEAR, m, d), style=S_DATE); tx.put(2, r, cat); tx.put(3, r, desc)
        tx.put(4, r, amt, style=S_MONEY); tx.put(5, r, meth)
    else:
        tx.put(1, r, style=S_DATE); tx.put(4, r, style=S_MONEY)
    tx.put(7, r, formula='IF(B%d="","",IF(COUNTIF(%s,B%d)>0,"Income","Expense"))' % (r, INC_RANGE, r), style=S_MUTED)
    tx.put(8, r, formula='IF(A%d="","",MONTH(A%d))' % (r, r), style=S_MUTED)
    tx.put(9, r, formula='IF(A%d="","",YEAR(A%d))' % (r, r), style=S_MUTED)
tx.dv.append(("B2:B%d" % (TX_ROWS + 1), "CategoryList"))
tx.dv.append(("E2:E%d" % (TX_ROWS + 1), '"Card,Cash,Bank transfer,PayPal,Direct debit,Deducted,Other"'))

def sumifs(type_or_cat, month_expr, by="type"):
    crit = (rng("G"), '"%s"' % type_or_cat) if by == "type" else (rng("B"), type_or_cat)
    f = "SUMIFS(%s,%s,%s,%s,%s" % (rng("D"), crit[0], crit[1], rng("I"), YEAR_REF)
    if month_expr:
        f += ",%s,%s" % (rng("H"), month_expr)
    return f + ")"

# ---------------- Monthly P&L ----------------
pl = Sheet("Monthly P&L"); pl.freeze = (2, 4)
pl.cols = [(1, 30)] + [(c, 11) for c in range(2, 14)] + [(14, 13)]
pl.put(1, 1, formula='"Profit & Loss "&%s&" ("&%s&")"' % (YEAR_REF, CUR_REF), style=S_TITLE)
pl.put(1, 3, "Category", style=S_HEAD)
for m in range(12):
    pl.put(2 + m, 2, m + 1, style=S_MUTED)      # month numbers used by the formulas
    pl.put(2 + m, 3, MONTHS[m], style=S_HEAD)
pl.put(14, 3, "Year total", style=S_HEAD)
r = 4
pl.put(1, r, "INCOME", style=S_BOLD); r += 1
inc_first = r
for i in range(N_INC):
    cref = "Categories!$A$%d" % (2 + i)
    pl.put(1, r, formula='IF(%s="","",%s)' % (cref, cref))
    for m in range(12):
        pl.put(2 + m, r, formula='IF($A%d="",0,%s)' % (r, sumifs("$A%d" % r, "%s$2" % col(2 + m), by="cat")), style=S_MONEY)
    pl.put(14, r, formula="SUM(B%d:M%d)" % (r, r), style=S_BMONEY); r += 1
inc_total = r
pl.put(1, r, "Total income", style=S_BOLD)
for c in range(2, 15):
    pl.put(c, r, formula="SUM(%s%d:%s%d)" % (col(c), inc_first, col(c), r - 1), style=S_BMONEY)
r += 2
pl.put(1, r, "EXPENSES", style=S_BOLD); r += 1
exp_first = r
for i in range(N_EXP):
    cref = "Categories!$A$%d" % (2 + N_INC + i)
    pl.put(1, r, formula='IF(%s="","",%s)' % (cref, cref))
    for m in range(12):
        pl.put(2 + m, r, formula='IF($A%d="",0,%s)' % (r, sumifs("$A%d" % r, "%s$2" % col(2 + m), by="cat")), style=S_MONEY)
    pl.put(14, r, formula="SUM(B%d:M%d)" % (r, r), style=S_BMONEY); r += 1
exp_total = r
pl.put(1, r, "Total expenses", style=S_BOLD)
for c in range(2, 15):
    pl.put(c, r, formula="SUM(%s%d:%s%d)" % (col(c), exp_first, col(c), r - 1), style=S_BMONEY)
r += 2
pl.put(1, r, "NET PROFIT", style=S_BOLD)
for c in range(2, 15):
    pl.put(c, r, formula="%s%d-%s%d" % (col(c), inc_total, col(c), exp_total), style=S_BMONEY)
net_row = r; r += 1
pl.put(1, r, "Profit margin", style=S_MUTED)
for c in range(2, 15):
    pl.put(c, r, formula='IF(%s%d=0,"",%s%d/%s%d)' % (col(c), inc_total, col(c), net_row, col(c), inc_total), style=S_PCT)
r += 1
pl.put(1, r, "Uncategorised (check these)", style=S_MUTED)
for m in range(12):
    pl.put(2 + m, r, formula='SUMIFS(%s,%s,"",%s,%s,%s,%s$2)' % (rng("D"), rng("B"), rng("I"), YEAR_REF, rng("H"), col(2 + m)), style=S_MONEY)
pl.put(14, r, formula="SUM(B%d:M%d)" % (r, r), style=S_BMONEY)

# ---------------- Dashboard ----------------
db = Sheet("Dashboard"); db.cols = [(1, 16), (2, 14), (3, 14), (4, 14), (5, 4), (6, 24), (7, 24)]
db.put(1, 1, formula='%s&" · "&%s' % (NAME_REF, YEAR_REF), style=S_TITLE)
db.put(1, 2, formula='"All amounts in "&%s&". Updates automatically from the Transactions tab."' % CUR_REF, style=S_MUTED)
db.put(1, 4, "Year to date", style=S_HEAD); db.put(2, 4, "", style=S_HEAD)
db.put(1, 5, "Total income", style=S_BOLD); db.put(2, 5, formula=sumifs("Income", None), style=S_BMONEY)
db.put(1, 6, "Total expenses", style=S_BOLD); db.put(2, 6, formula=sumifs("Expense", None), style=S_BMONEY)
db.put(1, 7, "Net profit", style=S_BOLD); db.put(2, 7, formula="B5-B6", style=S_BMONEY)
db.put(1, 8, "Profit margin", style=S_BOLD); db.put(2, 8, formula='IF(B5=0,"",B7/B5)', style=S_PCT)
db.put(1, 9, "Tax set-aside", style=S_BOLD); db.put(2, 9, formula="MAX(0,B7)*%s" % TAX_REF, style=S_BMONEY)
db.put(1, 10, "Transactions", style=S_BOLD); db.put(2, 10, formula="COUNTIFS(%s,%s)" % (rng("I"), YEAR_REF))
db.put(1, 12, "Month", style=S_HEAD); db.put(2, 12, "Income", style=S_HEAD); db.put(3, 12, "Expenses", style=S_HEAD)
db.put(4, 12, "Profit", style=S_HEAD); db.put(6, 12, "Income bar", style=S_HEAD); db.put(7, 12, "Expense bar", style=S_HEAD)
for m in range(12):
    rr = 13 + m
    db.put(1, rr, MONTHS[m], style=S_BOLD)
    db.put(2, rr, formula=sumifs("Income", str(m + 1)), style=S_MONEY)
    db.put(3, rr, formula=sumifs("Expense", str(m + 1)), style=S_MONEY)
    db.put(4, rr, formula="B%d-C%d" % (rr, rr), style=S_BMONEY)
    db.put(6, rr, formula='IF(MAX($B$13:$C$24)=0,"",REPT("█",ROUND(B%d/MAX($B$13:$C$24)*20,0)))' % rr, style=S_BAR_G)
    db.put(7, rr, formula='IF(MAX($B$13:$C$24)=0,"",REPT("█",ROUND(C%d/MAX($B$13:$C$24)*20,0)))' % rr, style=S_BAR_R)
db.put(1, 26, "Top expense categories: see the Monthly P&L tab. Tax set-aside is a simple estimate, not tax advice.", style=S_MUTED)

SHEETS = [start, db, tx, pl, cats]

STYLES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="#,##0.00;[Red]-#,##0.00"/></numFmts>
<fonts count="7">
<font><sz val="11"/><name val="Arial"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
<font><b/><sz val="18"/><color rgb="FF13202B"/><name val="Arial"/></font>
<font><b/><sz val="11"/><name val="Arial"/></font>
<font><sz val="10"/><color rgb="FF6B7A86"/><name val="Arial"/></font>
<font><sz val="11"/><color rgb="FF1F7F7A"/><name val="Arial"/></font>
<font><sz val="11"/><color rgb="FFD0605E"/><name val="Arial"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F7F7A"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D5"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="165" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="9" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''

def build(path):
    n = len(SHEETS)
    ct = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
          '<Default Extension="xml" ContentType="application/xml"/>',
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
          '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
          '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>']
    ct += ['<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' % (i + 1) for i in range(n)]
    ct.append('</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>')
    wb = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>']
    wb += ['<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (escape(s.name), i + 1, i + 1) for i, s in enumerate(SHEETS)]
    wb.append('</sheets><definedNames><definedName name="CategoryList">%s</definedName></definedNames>' % ALL_RANGE)
    wb.append('<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>')
    wbrels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">']
    wbrels += ['<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>' % (i + 1, i + 1) for i in range(n)]
    wbrels.append('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' % (n + 1))
    core = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            '<dc:title>Small Business Bookkeeping Tracker</dc:title><dc:creator></dc:creator>'
            '<dcterms:created xsi:type="dcterms:W3CDTF">2026-09-22T00:00:00Z</dcterms:created></cp:coreProperties>')
    app = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
           '<Application>Microsoft Excel</Application></Properties>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", "".join(ct))
        z.writestr("_rels/.rels", rels)
        z.writestr("docProps/core.xml", core)
        z.writestr("docProps/app.xml", app)
        z.writestr("xl/workbook.xml", "".join(wb))
        z.writestr("xl/_rels/workbook.xml.rels", "".join(wbrels))
        z.writestr("xl/styles.xml", STYLES)
        for i, s in enumerate(SHEETS):
            z.writestr("xl/worksheets/sheet%d.xml" % (i + 1), s.xml())

def mirror():
    inc = [0.0] * 12; exp = [0.0] * 12
    for m, d, cat, desc, amt, meth in SAMPLE:
        (inc if cat in INCOME else exp)[m - 1] += amt
    ti, te = sum(inc), sum(exp)
    print("income", [round(x, 2) for x in inc]); print("expense", [round(x, 2) for x in exp])
    print("total income %.2f expenses %.2f net %.2f margin %.1f%% tax %.2f" % (ti, te, ti - te, (ti - te) / ti * 100, (ti - te) * 0.25))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Bookkeeping-Tracker.xlsx")
    mirror()
