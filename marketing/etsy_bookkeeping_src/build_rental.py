#!/usr/bin/env python3
"""Build the Rental Property Income & Expense Tracker .xlsx (stdlib only; reuses build_xlsx.py's writer).

Expense categories follow the common rental-schedule headings landlords use at tax time.
Prints a python mirror of the sample figures for the listing images.
Usage: python3 build_rental.py OUT.xlsx
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_xlsx import (Sheet, build, col, serial, S_DEF, S_HEAD, S_DATE, S_MONEY, S_PCT, S_TITLE,
                        S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_BOLD)
S_INPUT_MONEY = 13
YEAR = 2026
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
N_PROP, N_INC, N_EXP, TX_ROWS = 10, 8, 20, 3000
PROPS = [("12 Oak Street", 1450), ("Maple Duplex - Unit A", 1100), ("Maple Duplex - Unit B", 1050)]
INCOME = ["Rent", "Late fees", "Pet fees", "Other income"]
EXPENSE = ["Advertising", "Auto and travel", "Cleaning and maintenance", "Commissions", "Insurance",
           "Legal and professional fees", "Management fees", "Mortgage interest", "Other interest", "Repairs",
           "Supplies", "Property taxes", "Utilities", "HOA fees", "Other expenses"]
def sample():
    rows = []
    for m in range(1, 10):
        rows += [(m, 1, "12 Oak Street", "Rent", "Rent %s" % MONTHS[m - 1], 1450),
                 (m, 1, "Maple Duplex - Unit A", "Rent", "Rent %s" % MONTHS[m - 1], 1100),
                 (m, 15, "12 Oak Street", "Mortgage interest", "Mortgage interest part", 612.4 - 1.3 * m),
                 (m, 15, "Maple Duplex - Unit A", "Mortgage interest", "Mortgage interest part (half)", 405.8 - 0.9 * m),
                 (m, 15, "Maple Duplex - Unit B", "Mortgage interest", "Mortgage interest part (half)", 405.8 - 0.9 * m)]
        if m != 4: rows.append((m, 1, "Maple Duplex - Unit B", "Rent", "Rent %s" % MONTHS[m - 1], 1050))
        rows.append((m, 20, "Maple Duplex - Unit A", "Utilities", "Water and trash (shared)", 38.5))
        rows.append((m, 20, "Maple Duplex - Unit B", "Utilities", "Water and trash (shared)", 38.5))
    rows += [(1, 12, "12 Oak Street", "Insurance", "Annual landlord policy", 980), (1, 12, "Maple Duplex - Unit A", "Insurance", "Annual policy (half)", 610),
             (1, 12, "Maple Duplex - Unit B", "Insurance", "Annual policy (half)", 610), (2, 9, "12 Oak Street", "Repairs", "Water heater thermostat", 185),
             (3, 6, "Maple Duplex - Unit B", "Late fees", "Late fee March", 50), (4, 3, "Maple Duplex - Unit B", "Advertising", "Listing ad (vacant April)", 45),
             (4, 18, "Maple Duplex - Unit B", "Cleaning and maintenance", "Turnover cleaning", 260), (4, 25, "Maple Duplex - Unit B", "Commissions", "Tenant placement fee", 525),
             (5, 7, "Maple Duplex - Unit A", "Repairs", "Dishwasher repair", 142), (5, 21, "12 Oak Street", "Cleaning and maintenance", "Gutter cleaning", 120),
             (6, 2, "12 Oak Street", "Property taxes", "Property tax 1st half", 1640), (6, 2, "Maple Duplex - Unit A", "Property taxes", "Property tax 1st half (half)", 1175),
             (6, 2, "Maple Duplex - Unit B", "Property taxes", "Property tax 1st half (half)", 1175), (6, 14, "Maple Duplex - Unit A", "Pet fees", "Pet rent", 35),
             (7, 11, "12 Oak Street", "Auto and travel", "Mileage for inspection", 28.9), (7, 19, "Maple Duplex - Unit A", "Supplies", "Smoke detector batteries", 22.6),
             (8, 8, "12 Oak Street", "Repairs", "Fence panel", 310), (8, 26, "Maple Duplex - Unit B", "Repairs", "Faucet cartridge", 64.2),
             (9, 4, "12 Oak Street", "Legal and professional fees", "Lease review", 150), (9, 14, "Maple Duplex - Unit A", "Pet fees", "Pet rent", 35)]
    return sorted(rows)
SAMPLE = sample()

SET = "'Start Here'"; YR, CUR, SEL = SET + "!$B$5", SET + "!$B$6", SET + "!$B$7"
start = Sheet("Start Here"); start.cols = [(1, 28), (2, 26), (3, 60)]
start.put(1, 1, "Rental Property Income & Expense Tracker", style=S_TITLE)
start.put(1, 2, "Rent, expenses and net cash flow for every property. Excel, Google Sheets and Numbers.", style=S_MUTED)
start.put(1, 4, "Settings", style=S_HEAD); start.put(2, 4, "Your value", style=S_HEAD); start.put(3, 4, "Notes", style=S_HEAD)
for i, (k, v, s, n) in enumerate([("Year", YEAR, S_INPUT, "Only entries dated in this year are counted"),
                                  ("Currency", "USD", S_INPUT, "Label only. Any currency works"),
                                  ("Property for Monthly tab", PROPS[0][0], S_INPUT, "Pick from the dropdown. The Monthly tab also shows all properties")]):
    start.put(1, 5 + i, k, style=S_BOLD); start.put(2, 5 + i, v, style=s); start.put(3, 5 + i, n, style=S_MUTED)
start.dv.append(("B7", "PropertyList"))
for i, t in enumerate(["How to use it",
        "1. Properties tab: name each property or unit and enter the expected monthly rent.",
        "2. Categories tab: income and expense categories (rename or add your own).",
        "3. Transactions tab: log every rent payment and expense (date, property and category from dropdowns, amount).",
        "   Enter all amounts as positive numbers. Income or Expense is filled in for you.",
        "4. Property Summary: income, expenses, net cash flow and rent collected vs expected for each property.",
        "5. Categories by Property: every category totalled per property for the year (handy at tax time).",
        "6. Monthly: month-by-month income, expenses and net for all properties and for the one you pick above.",
        "7. The sample rows show how it works. Delete them when you start.",
        "",
        "Google Sheets: upload this file to Google Drive, then open it with Google Sheets.",
        "Excel / Numbers: just open the file. Only edit the yellow cells and the Transactions tab.",
        "A record-keeping tool, not tax or legal advice. Depreciation is not calculated; ask your tax professional."]):
    start.put(1, 9 + i, t, style=S_HEAD if i == 0 else S_DEF)

props = Sheet("Properties"); props.cols = [(1, 30), (2, 18), (3, 40)]
for c, h in enumerate(["Property / unit", "Expected monthly rent", "Notes"], 1): props.put(c, 1, h, style=S_HEAD)
for i in range(N_PROP):
    r = 2 + i; n, rent = PROPS[i] if i < len(PROPS) else (None, None)
    props.put(1, r, n, style=S_INPUT); props.put(2, r, rent, style=S_INPUT_MONEY); props.put(3, r, None, style=S_INPUT)
props.put(1, N_PROP + 3, "Up to 10 properties or units. Blank rows are ignored.", style=S_MUTED)
PROP_RANGE = "Properties!$A$2:$A$%d" % (1 + N_PROP)

cats = Sheet("Categories"); cats.cols = [(1, 30), (2, 11), (3, 50)]
for c, h in enumerate(["Category", "Type", "Tip"], 1): cats.put(c, 1, h, style=S_HEAD)
for i in range(N_INC):
    r = 2 + i; cats.put(1, r, INCOME[i] if i < len(INCOME) else None, style=S_INPUT); cats.put(2, r, "Income", style=S_MUTED)
for i in range(N_EXP):
    r = 2 + N_INC + i; cats.put(1, r, EXPENSE[i] if i < len(EXPENSE) else None, style=S_INPUT); cats.put(2, r, "Expense", style=S_MUTED)
cats.put(3, 2, "Rows 2-9: income categories.", style=S_MUTED)
cats.put(3, 2 + N_INC, "Rows 10-29: expense categories. Rename any or fill a blank yellow cell.", style=S_MUTED)
cats.put(3, 3 + N_INC, "Record only the interest part of a mortgage payment as Mortgage interest.", style=S_MUTED)
INC_RANGE = "Categories!$A$2:$A$%d" % (1 + N_INC)
ALL_RANGE = "Categories!$A$2:$A$%d" % (1 + N_INC + N_EXP)

tx = Sheet("Transactions"); tx.freeze = (1, 2)
tx.cols = [(1, 13), (2, 26), (3, 28), (4, 32), (5, 13), (6, 11), (7, 7), (8, 7)]
for c, h in enumerate(["Date", "Property", "Category", "Description", "Amount", "Type (auto)", "Month", "Year"], 1): tx.put(c, 1, h, style=S_HEAD)
for r in range(2, TX_ROWS + 2):
    i = r - 2
    if i < len(SAMPLE):
        m, d, p, cat, desc, a = SAMPLE[i]
        tx.put(1, r, serial(YEAR, m, d), style=S_DATE); tx.put(2, r, p); tx.put(3, r, cat); tx.put(4, r, desc); tx.put(5, r, round(a, 2), style=S_MONEY)
    else:
        tx.put(1, r, style=S_DATE); tx.put(5, r, style=S_MONEY)
    tx.put(6, r, formula='IF(C%d="","",IF(COUNTIF(%s,C%d)>0,"Income","Expense"))' % (r, INC_RANGE, r), style=S_MUTED)
    tx.put(7, r, formula='IF(A%d="","",MONTH(A%d))' % (r, r), style=S_MUTED)
    tx.put(8, r, formula='IF(A%d="","",YEAR(A%d))' % (r, r), style=S_MUTED)
tx.dv += [("B2:B%d" % (TX_ROWS + 1), "PropertyList"), ("C2:C%d" % (TX_ROWS + 1), "CategoryList")]
def t(c): return "Transactions!$%s$2:$%s$%d" % (c, c, TX_ROWS + 1)
def sums(*crit):  # crit pairs: (column letter, criterion expr)
    return "SUMIFS(%s,%s,%s%s)" % (t("E"), t("H"), YR, "".join(",%s,%s" % (t(c), v) for c, v in crit))

ps = Sheet("Property Summary"); ps.cols = [(1, 28), (2, 13), (3, 13), (4, 13), (5, 11), (6, 14), (7, 14), (8, 12), (9, 22)]
ps.put(1, 1, formula='"Property summary "&%s&" ("&%s&")"' % (YR, CUR), style=S_TITLE)
ps.put(1, 2, "Net = income minus expenses (cash flow, before depreciation).", style=S_MUTED)
for c, h in enumerate(["Property", "Income", "Expenses", "Net", "Margin", "Rent collected", "Rent expected", "Collected", "Net bar"], 1):
    ps.put(c, 4, h, style=S_HEAD)
MON_MAX = 'IF(%s=YEAR(TODAY()),MONTH(TODAY()),12)' % YR
for i in range(N_PROP):
    r = 5 + i; pr = "Properties!$A$%d" % (2 + i)
    ps.put(1, r, formula='IF(%s="","",%s)' % (pr, pr), style=S_BOLD)
    ps.put(2, r, formula='IF($A%d="","",%s)' % (r, sums(("B", "$A%d" % r), ("F", '"Income"'))), style=S_MONEY)
    ps.put(3, r, formula='IF($A%d="","",%s)' % (r, sums(("B", "$A%d" % r), ("F", '"Expense"'))), style=S_MONEY)
    ps.put(4, r, formula='IF($A%d="","",B%d-C%d)' % (r, r, r), style=S_BMONEY)
    ps.put(5, r, formula='IF(OR($A%d="",B%d=0),"",D%d/B%d)' % (r, r, r, r), style=S_PCT)
    ps.put(7, r, formula='IF($A%d="","",Properties!$B$%d*%s)' % (r, 2 + i, MON_MAX), style=S_MONEY)
    ps.put(8, r, formula='IF(OR($A%d="",G%d=0),"",F%d/G%d)' % (r, r, r, r), style=S_PCT)
    ps.put(9, r, formula='IF(OR($A%d="",MAX($D$5:$D$%d)<=0),"",REPT("█",ROUND(MAX(0,D%d)/MAX($D$5:$D$%d)*20,0)))' % (r, 4 + N_PROP, r, 4 + N_PROP), style=S_BAR_G)
TOT = 5 + N_PROP
ps.put(1, TOT, "All properties", style=S_BOLD)
for c in (2, 3, 4, 6, 7): ps.put(c, TOT, formula="SUM(%s5:%s%d)" % (col(c), col(c), TOT - 1), style=S_BMONEY)
ps.put(5, TOT, formula='IF(B%d=0,"",D%d/B%d)' % (TOT, TOT, TOT), style=S_PCT)
ps.put(8, TOT, formula='IF(G%d=0,"",F%d/G%d)' % (TOT, TOT, TOT), style=S_PCT)
ps.put(1, TOT + 2, "Rent expected = expected monthly rent x months so far this year (all 12 months for past years).", style=S_MUTED)
ps.put(1, TOT + 3, "Rent collected counts the 'Rent' category only. Rename it on the Categories tab and this follows row 2 there.", style=S_MUTED)
for i in range(N_PROP):  # rent collected follows the first income category, so renaming it still works
    r = 5 + i
    ps.put(6, r, formula='IF($A%d="","",%s)' % (r, sums(("B", "$A%d" % r), ("C", "Categories!$A$2"))), style=S_MONEY)

cp = Sheet("Categories by Property"); cp.freeze = (2, 4)
cp.cols = [(1, 28)] + [(2 + j, 15) for j in range(N_PROP)] + [(2 + N_PROP, 14)]
cp.put(1, 1, formula='"Totals by category and property "&%s&" ("&%s&")"' % (YR, CUR), style=S_TITLE)
cp.put(1, 2, "Use these yearly totals when you prepare your rental income schedule. Not tax advice.", style=S_MUTED)
cp.put(1, 3, "Category", style=S_HEAD)
for j in range(N_PROP):
    cp.put(2 + j, 3, formula='IF(Properties!$A$%d="","",Properties!$A$%d)' % (2 + j, 2 + j), style=S_HEAD)
cp.put(2 + N_PROP, 3, "All", style=S_HEAD)
rows_cp = [("INCOME", None)] + [(None, 2 + i) for i in range(N_INC)] + [("EXPENSES", None)] + [(None, 2 + N_INC + i) for i in range(N_EXP)]
r = 4; inc_rows, exp_rows = [], []
for label, catrow in rows_cp:
    if label:
        cp.put(1, r, label, style=S_BOLD); section = label
    else:
        cr = "Categories!$A$%d" % catrow
        cp.put(1, r, formula='IF(%s="","",%s)' % (cr, cr))
        for j in range(N_PROP):
            C = col(2 + j)
            cp.put(2 + j, r, formula='IF(OR($A%d="",%s$3=""),"",%s)' % (r, C, sums(("B", "%s$3" % C), ("C", "$A%d" % r))), style=S_MONEY)
        cp.put(2 + N_PROP, r, formula='IF($A%d="","",%s)' % (r, sums(("C", "$A%d" % r))), style=S_MONEY)
        (inc_rows if section == "INCOME" else exp_rows).append(r)
    r += 1
for lab, rr in (("Total income", inc_rows), ("Total expenses", exp_rows)):
    cp.put(1, r, lab, style=S_BOLD)
    for j in range(N_PROP + 1):
        C = col(2 + j); cp.put(2 + j, r, formula='IF(%s$3="","",SUM(%s%d:%s%d))' % (C, C, rr[0], C, rr[-1]), style=S_BMONEY)
    r += 1
cp.put(1, r, "Net", style=S_BOLD)
for j in range(N_PROP + 1):
    C = col(2 + j); cp.put(2 + j, r, formula='IF(%s$3="","",%s%d-%s%d)' % (C, C, r - 2, C, r - 1), style=S_BMONEY)

mo = Sheet("Monthly"); mo.cols = [(1, 10), (2, 13), (3, 13), (4, 13), (5, 3), (6, 13), (7, 13), (8, 13), (9, 22)]
mo.put(1, 1, formula='"Monthly cash flow "&%s&" ("&%s&")"' % (YR, CUR), style=S_TITLE)
mo.put(1, 2, formula='"Right side: "&%s&". Change the property on the Start Here tab."' % SEL, style=S_MUTED)
mo.put(2, 3, "All properties", style=S_BOLD); mo.put(6, 3, formula=SEL, style=S_BOLD)
for c, h in enumerate(["Month", "Income", "Expenses", "Net", "", "Income", "Expenses", "Net", "Net bar (selected)"], 1):
    if h: mo.put(c, 4, h, style=S_HEAD)
for m in range(12):
    r = 5 + m; M = str(m + 1)
    mo.put(1, r, MONTHS[m], style=S_BOLD)
    mo.put(2, r, formula=sums(("G", M), ("F", '"Income"')), style=S_MONEY)
    mo.put(3, r, formula=sums(("G", M), ("F", '"Expense"')), style=S_MONEY)
    mo.put(4, r, formula="B%d-C%d" % (r, r), style=S_BMONEY)
    mo.put(6, r, formula=sums(("G", M), ("F", '"Income"'), ("B", SEL)), style=S_MONEY)
    mo.put(7, r, formula=sums(("G", M), ("F", '"Expense"'), ("B", SEL)), style=S_MONEY)
    mo.put(8, r, formula="F%d-G%d" % (r, r), style=S_BMONEY)
    mo.put(9, r, formula='IF(MAX($H$5:$H$16)<=0,"",REPT("█",ROUND(MAX(0,H%d)/MAX($H$5:$H$16)*20,0)))' % r, style=S_BAR_G)
mo.put(1, 17, "Total", style=S_BOLD)
for c in (2, 3, 4, 6, 7, 8): mo.put(c, 17, formula="SUM(%s5:%s16)" % (col(c), col(c)), style=S_BMONEY)
mo.put(1, 19, "Months with a negative net usually mean a large yearly bill (insurance, property tax) or a vacancy.", style=S_MUTED)

SHEETS = [start, ps, tx, cp, mo, props, cats]

def mirror():
    inc = set(INCOME)
    for p, _ in PROPS:
        i = sum(a for m, d, pp, c, _, a in SAMPLE if pp == p and c in inc); e = sum(a for m, d, pp, c, _, a in SAMPLE if pp == p and c not in inc)
        rent = sum(a for m, d, pp, c, _, a in SAMPLE if pp == p and c == "Rent")
        print("%-24s income %9.2f expenses %9.2f net %9.2f margin %5.1f%% rent %9.2f" % (p, i, e, i - e, (i - e) / i * 100, rent))
    ti = sum(a for *_, c, _, a in SAMPLE if c in inc); te = sum(a for *_, c, _, a in SAMPLE if c not in inc)
    print("ALL income %.2f expenses %.2f net %.2f" % (ti, te, ti - te))
    for m in range(1, 10):
        i = sum(a for mm, d, pp, c, _, a in SAMPLE if mm == m and c in inc); e = sum(a for mm, d, pp, c, _, a in SAMPLE if mm == m and c not in inc)
        si = sum(a for mm, d, pp, c, _, a in SAMPLE if mm == m and c in inc and pp == PROPS[0][0]); se = sum(a for mm, d, pp, c, _, a in SAMPLE if mm == m and c not in inc and pp == PROPS[0][0])
        print("  %s all %8.2f %8.2f %8.2f | oak %8.2f %8.2f %8.2f" % (MONTHS[m - 1], i, e, i - e, si, se, si - se))
    for cat in EXPENSE:
        v = [sum(a for *_, pp, c, _, a in SAMPLE if pp == p and c == cat) for p, _ in PROPS]
        if any(v): print("  %-28s %s" % (cat, " ".join("%9.2f" % x for x in v)))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Rental-Property-Tracker.xlsx", SHEETS,
          {"CategoryList": ALL_RANGE, "PropertyList": PROP_RANGE}, "Rental Property Income & Expense Tracker")
    mirror()
