#!/usr/bin/env python3
"""Build the Small Business Inventory Tracker .xlsx (stdlib only; reuses build_xlsx.py's writer).

No array formulas: the reorder list uses a running-count helper column so it works
the same in Excel, Google Sheets and Numbers.
Prints a python mirror of the sample figures for the listing images.
Usage: python3 build_inventory.py OUT.xlsx
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_xlsx import (Sheet, build, col, serial, S_DEF, S_HEAD, S_DATE, S_MONEY, S_PCT, S_TITLE,
                        S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_BAR_R, S_BOLD)
S_INPUT_MONEY = 13
YEAR = 2026
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
N_PROD, TX_ROWS, N_REORDER = 200, 3000, 25
TYPES = [("Purchase in", 1), ("Sale out", -1), ("Return in", 1), ("Adjustment +", 1), ("Adjustment -", -1)]
# (sku, name, category, unit cost, sale price, reorder point, opening stock)
PRODUCTS = [("CND-LAV", "Soy candle - Lavender", "Candles", 4.10, 18, 10, 24), ("CND-CED", "Soy candle - Cedar", "Candles", 4.10, 18, 10, 20),
            ("CND-VAN", "Soy candle - Vanilla", "Candles", 4.10, 18, 10, 12), ("MLT-SET", "Wax melts set", "Wax melts", 1.60, 8, 15, 40),
            ("DIF-REE", "Reed diffuser 100ml", "Diffusers", 5.30, 22, 6, 10), ("GFT-BOX", "Gift box (3 candles)", "Gift sets", 13.50, 48, 4, 6),
            ("MAT-WCK", "Wicks (pack of 50)", "Supplies", 3.20, 0, 2, 3), ("MAT-JAR", "Amber jars 8oz", "Supplies", 0.95, 0, 30, 60)]
MOVES = [  # (month, day, sku, type, qty, unit price, note)
    (7, 2, "CND-LAV", "Sale out", 6, 18, "Market stall"), (7, 2, "CND-CED", "Sale out", 4, 18, "Market stall"),
    (7, 9, "MLT-SET", "Sale out", 12, 8, "Online orders"), (7, 15, "MAT-JAR", "Purchase in", 48, 0.95, "Supplier order"),
    (7, 18, "CND-VAN", "Sale out", 5, 18, "Online orders"), (7, 26, "GFT-BOX", "Sale out", 3, 48, "Online orders"),
    (8, 3, "CND-LAV", "Purchase in", 20, 4.10, "Poured batch"), (8, 5, "CND-LAV", "Sale out", 14, 18, "Online orders"),
    (8, 11, "DIF-REE", "Sale out", 5, 22, "Online orders"), (8, 14, "MAT-JAR", "Adjustment -", 40, 0.95, "Used for candle batch"),
    (8, 20, "CND-CED", "Sale out", 9, 18, "Online orders"), (8, 22, "MLT-SET", "Sale out", 10, 8, "Online orders"),
    (8, 28, "CND-VAN", "Return in", 1, 18, "Customer return"), (9, 4, "CND-LAV", "Sale out", 11, 18, "Online orders"),
    (9, 6, "GFT-BOX", "Sale out", 2, 48, "Online orders"), (9, 10, "MAT-WCK", "Adjustment -", 1, 3.20, "Used for candle batch"),
    (9, 12, "CND-VAN", "Sale out", 4, 18, "Market stall"), (9, 15, "MLT-SET", "Purchase in", 20, 1.60, "Made batch"),
    (9, 16, "DIF-REE", "Adjustment -", 1, 5.30, "Broken in storage")]

SET = "'Start Here'"; BIZ, CUR, YR = SET + "!$B$5", SET + "!$B$6", SET + "!$B$7"
start = Sheet("Start Here"); start.cols = [(1, 28), (2, 22), (3, 60)]
start.put(1, 1, "Small Business Inventory Tracker", style=S_TITLE)
start.put(1, 2, "Stock levels, reorder alerts, stock value and sales by month. Excel, Google Sheets and Numbers.", style=S_MUTED)
start.put(1, 4, "Settings", style=S_HEAD); start.put(2, 4, "Your value", style=S_HEAD); start.put(3, 4, "Notes", style=S_HEAD)
for i, (k, v, s, n) in enumerate([("Business name", "Your Business", S_INPUT, "Shown on the Dashboard"),
                                  ("Currency", "USD", S_INPUT, "Label only. Any currency works"),
                                  ("Year for monthly totals", YEAR, S_INPUT, "Stock levels always use every movement; monthly totals use this year")]):
    start.put(1, 5 + i, k, style=S_BOLD); start.put(2, 5 + i, v, style=s); start.put(3, 5 + i, n, style=S_MUTED)
for i, t in enumerate(["How to use it",
        "1. Products tab: one row per item (SKU, name, category, unit cost, sale price, reorder point, opening stock).",
        "2. Stock Movements tab: log every change (date, SKU from the dropdown, type, quantity).",
        "   Types: Purchase in, Sale out, Return in, Adjustment + and Adjustment - (damage, use, stock count fixes).",
        "   Enter quantities as positive numbers. The sign is set by the type.",
        "3. Products tab updates current stock, stock value and status (OK / Reorder / Out of stock).",
        "4. Dashboard: totals, the reorder list and units sold and sales by month.",
        "5. The sample rows show how it works. Delete them (Products and Stock Movements) when you start.",
        "",
        "Google Sheets: upload this file to Google Drive, then open it with Google Sheets.",
        "Excel / Numbers: just open the file. Only edit the yellow cells and the Stock Movements tab."]):
    start.put(1, 9 + i, t, style=S_HEAD if i == 0 else S_DEF)

lists = Sheet("Lists"); lists.cols = [(1, 18), (2, 8)]
lists.put(1, 1, "Movement type", style=S_HEAD); lists.put(2, 1, "Sign", style=S_HEAD)
for i, (ty, sg) in enumerate(TYPES): lists.put(1, 2 + i, ty); lists.put(2, 2 + i, sg)
lists.put(1, 9, "Used by the Stock Movements dropdown. Do not edit.", style=S_MUTED)
TYPE_RANGE = "Lists!$A$2:$A$%d" % (1 + len(TYPES)); TYPE_TABLE = "Lists!$A$2:$B$%d" % (1 + len(TYPES))

P_LAST = 1 + N_PROD
SKU_RANGE = "Products!$A$2:$A$%d" % P_LAST
mv = Sheet("Stock Movements"); mv.freeze = (1, 2)
mv.cols = [(1, 13), (2, 14), (3, 15), (4, 9), (5, 12), (6, 26), (7, 28), (8, 11), (9, 7), (10, 7), (11, 12)]
for c, h in enumerate(["Date", "SKU", "Type", "Qty", "Unit price", "Note", "Product (auto)", "Stock change", "Month", "Year", "Sale value"], 1):
    mv.put(c, 1, h, style=S_HEAD)
for r in range(2, TX_ROWS + 2):
    i = r - 2
    if i < len(MOVES):
        m, d, sku, ty, q, up, note = MOVES[i]
        mv.put(1, r, serial(YEAR, m, d), style=S_DATE); mv.put(2, r, sku); mv.put(3, r, ty); mv.put(4, r, q); mv.put(5, r, up, style=S_MONEY); mv.put(6, r, note)
    else:
        mv.put(1, r, style=S_DATE); mv.put(5, r, style=S_MONEY)
    mv.put(7, r, formula='IF(B%d="","",IFERROR(INDEX(Products!$B$2:$B$%d,MATCH(B%d,%s,0)),"Unknown SKU"))' % (r, P_LAST, r, SKU_RANGE), style=S_MUTED)
    mv.put(8, r, formula='IF(OR(C%d="",D%d=""),"",D%d*IFERROR(VLOOKUP(C%d,%s,2,0),0))' % (r, r, r, r, TYPE_TABLE), style=S_MUTED)
    mv.put(9, r, formula='IF(A%d="","",MONTH(A%d))' % (r, r), style=S_MUTED)
    mv.put(10, r, formula='IF(A%d="","",YEAR(A%d))' % (r, r), style=S_MUTED)
    mv.put(11, r, formula='IF(C%d="Sale out",D%d*E%d,"")' % (r, r, r), style=S_MUTED)
mv.dv += [("B2:B%d" % (TX_ROWS + 1), "SkuList"), ("C2:C%d" % (TX_ROWS + 1), "TypeList")]
def m(c): return "'Stock Movements'!$%s$2:$%s$%d" % (c, c, TX_ROWS + 1)

pr = Sheet("Products"); pr.freeze = (3, 2)
pr.cols = [(1, 12), (2, 26), (3, 14), (4, 11), (5, 11), (6, 10), (7, 10), (8, 9), (9, 9), (10, 11), (11, 13), (12, 13), (13, 14), (14, 9)]
for c, h in enumerate(["SKU", "Product", "Category", "Unit cost", "Sale price", "Reorder at", "Opening stock",
                       "In", "Out", "In stock", "Stock value", "Retail value", "Status", "Reorder #"], 1):
    pr.put(c, 1, h, style=S_HEAD)
for i in range(N_PROD):
    r = 2 + i
    vals = PRODUCTS[i] if i < len(PRODUCTS) else (None,) * 7
    for c, (v, s) in enumerate(zip(vals, (S_INPUT, S_INPUT, S_INPUT, S_INPUT_MONEY, S_INPUT_MONEY, S_INPUT, S_INPUT)), 1):
        pr.put(c, r, v, style=s)
    pr.put(8, r, formula='IF($A%d="","",SUMIFS(%s,%s,$A%d,%s,">0"))' % (r, m("H"), m("B"), r, m("H")), style=S_MUTED)
    pr.put(9, r, formula='IF($A%d="","",-SUMIFS(%s,%s,$A%d,%s,"<0"))' % (r, m("H"), m("B"), r, m("H")), style=S_MUTED)
    pr.put(10, r, formula='IF($A%d="","",G%d+H%d-I%d)' % (r, r, r, r), style=S_BOLD)
    pr.put(11, r, formula='IF($A%d="","",J%d*D%d)' % (r, r, r), style=S_MONEY)
    pr.put(12, r, formula='IF($A%d="","",J%d*E%d)' % (r, r, r), style=S_MONEY)
    pr.put(13, r, formula='IF($A%d="","",IF(J%d<=0,"Out of stock",IF(J%d<=F%d,"Reorder","OK")))' % (r, r, r, r), style=S_BOLD)
    prev = "0" if i == 0 else "MAX($N$2:N%d)" % (r - 1)
    pr.put(14, r, formula='IF(OR(M%d="Reorder",M%d="Out of stock"),%s+1,"")' % (r, r, prev), style=S_MUTED)
pr.put(1, P_LAST + 2, "Grey columns are automatic. In stock = opening stock + in - out. Status turns to Reorder at or below the reorder point.", style=S_MUTED)
def p(c): return "Products!$%s$2:$%s$%d" % (c, c, P_LAST)

db = Sheet("Dashboard"); db.cols = [(1, 26), (2, 16), (3, 14), (4, 14), (5, 14), (6, 3), (7, 12), (8, 12), (9, 14), (10, 22)]
db.put(1, 1, formula='%s&" inventory"' % BIZ, style=S_TITLE)
db.put(1, 2, formula='"All amounts in "&%s&". Monthly totals for "&%s&"."' % (CUR, YR), style=S_MUTED)
KPIS = [("Products", 'COUNTA(%s)' % p("A"), S_BOLD), ("Units in stock", "SUM(%s)" % p("J"), S_BOLD),
        ("Stock value (at cost)", "SUM(%s)" % p("K"), S_BMONEY), ("Retail value", "SUM(%s)" % p("L"), S_BMONEY),
        ("Need to reorder", 'COUNTIF(%s,"Reorder")' % p("M"), S_BOLD), ("Out of stock", 'COUNTIF(%s,"Out of stock")' % p("M"), S_BOLD)]
for i, (k, f, s) in enumerate(KPIS):
    db.put(1, 4 + i, k, style=S_BOLD); db.put(2, 4 + i, formula=f, style=s)
R_RE = 12
db.put(1, R_RE - 1, "Reorder list", style=S_BOLD)
for c, h in enumerate(["Product", "SKU", "In stock", "Reorder at", "Status"], 1): db.put(c, R_RE, h, style=S_HEAD)
for k in range(N_REORDER):
    r = R_RE + 1 + k
    idx = "MATCH(%d,%s,0)" % (k + 1, p("N"))
    db.put(1, r, formula='IFERROR(INDEX(%s,%s),"")' % (p("B"), idx))
    db.put(2, r, formula='IFERROR(INDEX(%s,%s),"")' % (p("A"), idx), style=S_MUTED)
    db.put(3, r, formula='IFERROR(INDEX(%s,%s),"")' % (p("J"), idx), style=S_BOLD)
    db.put(4, r, formula='IFERROR(INDEX(%s,%s),"")' % (p("F"), idx))
    db.put(5, r, formula='IFERROR(INDEX(%s,%s),"")' % (p("M"), idx), style=S_BAR_R)
db.put(1, R_RE + N_REORDER + 1, "Shows the first 25 items that need reordering, in Products tab order.", style=S_MUTED)
db.put(7, R_RE - 1, "By month", style=S_BOLD)
for c, h in enumerate(["Month", "Units sold", "Sales", "Sales bar"], 7): db.put(c, R_RE, h, style=S_HEAD)
for mo in range(12):
    r = R_RE + 1 + mo; M = str(mo + 1)
    db.put(7, r, MONTHS[mo], style=S_BOLD)
    db.put(8, r, formula='SUMIFS(%s,%s,"Sale out",%s,%s,%s,%s)' % (m("D"), m("C"), m("J"), YR, m("I"), M))
    db.put(9, r, formula='SUMIFS(%s,%s,%s,%s,%s)' % (m("K"), m("J"), YR, m("I"), M), style=S_MONEY)
    db.put(10, r, formula='IF(MAX($I$%d:$I$%d)<=0,"",REPT("█",ROUND(I%d/MAX($I$%d:$I$%d)*20,0)))' % (R_RE + 1, R_RE + 12, r, R_RE + 1, R_RE + 12), style=S_BAR_G)
db.put(7, R_RE + 13, "Total", style=S_BOLD)
db.put(8, R_RE + 13, formula="SUM(H%d:H%d)" % (R_RE + 1, R_RE + 12), style=S_BOLD)
db.put(9, R_RE + 13, formula="SUM(I%d:I%d)" % (R_RE + 1, R_RE + 12), style=S_BMONEY)
db.put(7, R_RE + 15, "Sales = quantity x unit price on Sale out rows.", style=S_MUTED)

SHEETS = [start, db, pr, mv, lists]

def mirror():
    sign = dict(TYPES); stock = {}
    for sku, name, cat, cost, price, ro, op in PRODUCTS: stock[sku] = [op, 0, 0]
    for mo, d, sku, ty, q, up, note in MOVES:
        stock[sku][1 if sign[ty] > 0 else 2] += q
    tv = rv = 0; reorder = []
    for sku, name, cat, cost, price, ro, op in PRODUCTS:
        o, i, out = stock[sku]; cur = o + i - out; tv += cur * cost; rv += cur * price
        st = "Out of stock" if cur <= 0 else ("Reorder" if cur <= ro else "OK")
        if st != "OK": reorder.append((name, cur, ro, st))
        print("%-8s %-22s in %3d out %3d stock %3d value %8.2f retail %8.2f %s" % (sku, name, i, out, cur, cur * cost, cur * price, st))
    print("units %d stock value %.2f retail %.2f reorder %s" % (sum(s[0] + s[1] - s[2] for s in stock.values()), tv, rv, reorder))
    for mo in (7, 8, 9):
        u = sum(q for mm, d, s, ty, q, up, n in MOVES if mm == mo and ty == "Sale out"); v = sum(q * up for mm, d, s, ty, q, up, n in MOVES if mm == mo and ty == "Sale out")
        print("  %s units %d sales %.2f" % (MONTHS[mo - 1], u, v))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Inventory-Tracker.xlsx", SHEETS,
          {"SkuList": SKU_RANGE, "TypeList": TYPE_RANGE}, "Small Business Inventory Tracker")
    mirror()
