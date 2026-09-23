#!/usr/bin/env python3
"""Build the Etsy Seller Profit Tracker .xlsx (stdlib only; reuses build_xlsx.py's writer).

Fee defaults are Etsy's published US rates and are editable yellow cells.
Prints a python mirror of the sample dashboard for the listing images.
Usage: python3 build_etsy_seller.py OUT.xlsx
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_xlsx import (Sheet, build, col, serial, S_DEF, S_HEAD, S_DATE, S_MONEY, S_PCT, S_TITLE,
                        S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_INPUT_PCT, S_BOLD)
S_INPUT_MONEY = 13
YEAR = 2026
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
N_PROD, ORD_ROWS, EXP_ROWS = 30, 1500, 300
FEES = [("Transaction fee", 0.065, S_INPUT_PCT, "% of item price + shipping charged"),
        ("Payment processing %", 0.03, S_INPUT_PCT, "% of order total (US rate; varies by country)"),
        ("Payment processing fixed", 0.25, S_INPUT_MONEY, "Per order (US rate; varies by country)"),
        ("Listing fee per item sold", 0.20, S_INPUT_MONEY, "Auto-renew fee charged for each item sold"),
        ("Offsite Ads fee", 0.15, S_INPUT_PCT, "Only on orders you mark Yes (12% for some shops)")]
PRODUCTS = [("Ceramic mug", 6.40, 1.10, 28), ("Linen tote bag", 4.20, 0.60, 22), ("Sticker pack", 0.90, 0.15, 6),
            ("Art print A4", 1.80, 0.70, 18), ("Custom pet portrait", 3.00, 1.20, 55)]
ORDERS = [  # (month, day, product, qty, item total, shipping charged, label cost, offsite)
    (1, 4, "Ceramic mug", 1, 28, 6.5, 5.9, "No"), (1, 9, "Sticker pack", 3, 18, 1.5, 1.2, "No"),
    (1, 15, "Custom pet portrait", 1, 55, 0, 4.8, "Yes"), (1, 22, "Linen tote bag", 2, 44, 5, 4.6, "No"),
    (1, 28, "Art print A4", 1, 18, 3.5, 2.9, "No"), (2, 3, "Ceramic mug", 2, 56, 8, 7.4, "No"),
    (2, 8, "Sticker pack", 5, 30, 1.5, 1.2, "No"), (2, 14, "Custom pet portrait", 1, 55, 0, 4.8, "No"),
    (2, 19, "Art print A4", 2, 36, 3.5, 3.1, "Yes"), (2, 25, "Linen tote bag", 1, 22, 5, 4.2, "No"),
    (3, 2, "Custom pet portrait", 2, 110, 0, 5.6, "No"), (3, 7, "Ceramic mug", 1, 28, 6.5, 5.9, "No"),
    (3, 12, "Sticker pack", 2, 12, 1.5, 1.2, "No"), (3, 18, "Art print A4", 1, 18, 3.5, 2.9, "No"),
    (3, 24, "Linen tote bag", 3, 66, 5, 5.3, "Yes"), (3, 29, "Ceramic mug", 1, 28, 6.5, 5.9, "No")]
EXPENSES = [(1, 10, "Etsy Ads", 30), (1, 20, "Packaging supplies (bulk)", 42), (2, 10, "Etsy Ads", 30),
            (2, 16, "Photo props", 18), (3, 10, "Etsy Ads", 30), (3, 21, "Label printer paper", 24)]

SET = "'Start Here'"
NAME, YR, CUR = SET + "!$B$5", SET + "!$B$6", SET + "!$B$7"
TXF, PPF, PFX, LSF, OFF = [SET + "!$B$%d" % (9 + i) for i in range(5)]

start = Sheet("Start Here"); start.cols = [(1, 30), (2, 22), (3, 58)]
start.put(1, 1, "Etsy Seller Profit Tracker", style=S_TITLE)
start.put(1, 2, "Orders, Etsy fees, cost of goods and real profit per product and per month.", style=S_MUTED)
start.put(1, 4, "Settings", style=S_HEAD); start.put(2, 4, "Your value", style=S_HEAD); start.put(3, 4, "Notes", style=S_HEAD)
for i, (k, v, s, n) in enumerate([("Shop name", "Your Shop Name", S_INPUT, "Shown on the Dashboard"),
                                  ("Tracking year", YEAR, S_INPUT, "Only orders and expenses dated in this year are counted"),
                                  ("Currency", "USD", S_INPUT, "Label only. Use your shop currency")]):
    start.put(1, 5 + i, k, style=S_BOLD); start.put(2, 5 + i, v, style=s); start.put(3, 5 + i, n, style=S_MUTED)
start.put(1, 8, "Etsy fee rates", style=S_HEAD); start.put(2, 8, "", style=S_HEAD)
start.put(3, 8, "Defaults = Etsy's published US rates. Check your own fee schedule and edit.", style=S_HEAD)
for i, (k, v, s, n) in enumerate(FEES):
    start.put(1, 9 + i, k, style=S_BOLD); start.put(2, 9 + i, v, style=s); start.put(3, 9 + i, n, style=S_MUTED)
for i, t in enumerate(["How to use it",
        "1. Fill the yellow cells above: shop name, year, currency and your fee rates.",
        "2. Products tab: one row per product with material and packaging cost per unit and your price.",
        "3. Orders tab: one row per order. Pick the product from the dropdown, enter quantity, item total",
        "   (what the buyer paid for the items after any discount), shipping charged and your label cost.",
        "   Mark Offsite Ads Yes if Etsy charged an Offsite Ads fee on that order.",
        "4. Expenses tab: other costs such as Etsy Ads, bulk supplies, subscriptions.",
        "5. Dashboard: real profit by month and by product. Price Calculator: price for a target margin.",
        "6. The sample rows show how it works. Delete them (Orders, Expenses, Products) when you start.",
        "",
        "Fees are an estimate from your rates. Your Etsy Payments statement is the final word.",
        "Google Sheets: upload to Google Drive, then open with Google Sheets. Excel / Numbers: just open it."]):
    start.put(1, 15 + i, t, style=S_HEAD if i == 0 else S_DEF)

prod = Sheet("Products"); prod.freeze = (1, 2)
prod.cols = [(1, 28), (2, 14), (3, 14), (4, 14), (5, 13), (6, 14), (7, 14), (8, 11)]
for c, h in enumerate(["Product", "Material cost / unit", "Packaging / unit", "Unit cost (auto)", "Your price",
                       "Etsy fees / unit (auto)", "Profit / unit (auto)", "Margin (auto)"], 1):
    prod.put(c, 1, h, style=S_HEAD)
for i in range(N_PROD):
    r = 2 + i
    if i < len(PRODUCTS):
        n, m, p, pr = PRODUCTS[i]
        prod.put(1, r, n, style=S_INPUT); prod.put(2, r, m, style=S_INPUT_MONEY); prod.put(3, r, p, style=S_INPUT_MONEY); prod.put(5, r, pr, style=S_INPUT_MONEY)
    else:
        for c in (1,): prod.put(c, r, style=S_INPUT)
        for c in (2, 3, 5): prod.put(c, r, style=S_INPUT_MONEY)
    prod.put(4, r, formula='IF(A%d="","",B%d+C%d)' % (r, r, r), style=S_MONEY)
    prod.put(6, r, formula='IF(OR(A%d="",E%d=""),"",E%d*(%s+%s)+%s+%s)' % (r, r, r, TXF, PPF, PFX, LSF), style=S_MONEY)
    prod.put(7, r, formula='IF(OR(A%d="",E%d=""),"",E%d-D%d-F%d)' % (r, r, r, r, r), style=S_BMONEY)
    prod.put(8, r, formula='IF(OR(A%d="",E%d=0),"",G%d/E%d)' % (r, r, r, r), style=S_PCT)
PROD_LIST = "Products!$A$2:$A$%d" % (1 + N_PROD)

o = Sheet("Orders"); o.freeze = (1, 2)
o.cols = [(1, 12), (2, 24), (3, 7), (4, 12), (5, 12), (6, 12), (7, 10), (8, 12), (9, 12), (10, 12), (11, 12), (12, 10), (13, 7), (14, 7)]
for c, h in enumerate(["Date", "Product", "Qty", "Item total", "Shipping charged", "Label cost", "Offsite Ads?",
                       "Revenue (auto)", "Etsy fees (auto)", "Cost of goods (auto)", "Profit (auto)", "Margin (auto)", "Month", "Year"], 1):
    o.put(c, 1, h, style=S_HEAD)
for r in range(2, ORD_ROWS + 2):
    i = r - 2
    if i < len(ORDERS):
        m, d, pn, q, it, sc, lc, off = ORDERS[i]
        o.put(1, r, serial(YEAR, m, d), style=S_DATE); o.put(2, r, pn); o.put(3, r, q)
        o.put(4, r, it, style=S_MONEY); o.put(5, r, sc, style=S_MONEY); o.put(6, r, lc, style=S_MONEY); o.put(7, r, off)
    else:
        o.put(1, r, style=S_DATE)
        for c in (4, 5, 6): o.put(c, r, style=S_MONEY)
    o.put(8, r, formula='IF(A%d="","",D%d+E%d)' % (r, r, r), style=S_MONEY)
    o.put(9, r, formula='IF(A%d="","",H%d*(%s+%s)+%s+C%d*%s+IF(G%d="Yes",H%d*%s,0))' % (r, r, TXF, PPF, PFX, r, LSF, r, r, OFF), style=S_MONEY)
    o.put(10, r, formula='IF(A%d="","",C%d*IFERROR(INDEX(Products!$D$2:$D$%d,MATCH(B%d,%s,0)),0))' % (r, r, 1 + N_PROD, r, PROD_LIST), style=S_MONEY)
    o.put(11, r, formula='IF(A%d="","",H%d-F%d-I%d-J%d)' % (r, r, r, r, r), style=S_BMONEY)
    o.put(12, r, formula='IF(OR(A%d="",H%d=0),"",K%d/H%d)' % (r, r, r, r), style=S_PCT)
    o.put(13, r, formula='IF(A%d="","",MONTH(A%d))' % (r, r), style=S_MUTED)
    o.put(14, r, formula='IF(A%d="","",YEAR(A%d))' % (r, r), style=S_MUTED)
o.dv.append(("B2:B%d" % (ORD_ROWS + 1), "ProductList"))
o.dv.append(("G2:G%d" % (ORD_ROWS + 1), '"No,Yes"'))
def orng(c): return "Orders!$%s$2:$%s$%d" % (c, c, ORD_ROWS + 1)

ex = Sheet("Expenses"); ex.freeze = (1, 2); ex.cols = [(1, 12), (2, 36), (3, 13), (4, 7), (5, 7)]
for c, h in enumerate(["Date", "Description", "Amount", "Month", "Year"], 1):
    ex.put(c, 1, h, style=S_HEAD)
for r in range(2, EXP_ROWS + 2):
    i = r - 2
    if i < len(EXPENSES):
        m, d, desc, a = EXPENSES[i]
        ex.put(1, r, serial(YEAR, m, d), style=S_DATE); ex.put(2, r, desc); ex.put(3, r, a, style=S_MONEY)
    else:
        ex.put(1, r, style=S_DATE); ex.put(3, r, style=S_MONEY)
    ex.put(4, r, formula='IF(A%d="","",MONTH(A%d))' % (r, r), style=S_MUTED)
    ex.put(5, r, formula='IF(A%d="","",YEAR(A%d))' % (r, r), style=S_MUTED)
def erng(c): return "Expenses!$%s$2:$%s$%d" % (c, c, EXP_ROWS + 1)

def osum(c, month=None, prod=None):
    f = "SUMIFS(%s,%s,%s" % (orng(c), orng("N"), YR)
    if month: f += ",%s,%s" % (orng("M"), month)
    if prod: f += ",%s,%s" % (orng("B"), prod)
    return f + ")"
def esum(month=None):
    f = "SUMIFS(%s,%s,%s" % (erng("C"), erng("E"), YR)
    return f + (",%s,%s)" % (erng("D"), month) if month else ")")

db = Sheet("Dashboard"); db.cols = [(1, 26), (2, 13), (3, 13), (4, 13), (5, 13), (6, 13), (7, 13), (8, 24)]
db.put(1, 1, formula='%s&" · "&%s' % (NAME, YR), style=S_TITLE)
db.put(1, 2, formula='"All amounts in "&%s&". Updates from the Orders and Expenses tabs."' % CUR, style=S_MUTED)
db.put(1, 4, "Year to date", style=S_HEAD); db.put(2, 4, "", style=S_HEAD)
ytd = [("Orders", "COUNTIFS(%s,%s)" % (orng("N"), YR), S_DEF), ("Items sold", osum("C"), S_DEF),
       ("Revenue (items + shipping)", osum("H"), S_BMONEY), ("Etsy fees", osum("I"), S_BMONEY),
       ("Shipping labels", osum("F"), S_BMONEY), ("Cost of goods", osum("J"), S_BMONEY),
       ("Other expenses", esum(), S_BMONEY), ("Net profit", "B7-B8-B9-B10-B11", S_BMONEY),
       ("Profit margin", 'IF(B7=0,"",B12/B7)', S_PCT), ("Fees as % of revenue", 'IF(B7=0,"",B8/B7)', S_PCT)]
for i, (k, f, s) in enumerate(ytd):
    db.put(1, 5 + i, k, style=S_BOLD); db.put(2, 5 + i, formula=f, style=s)
R0 = 17
for c, h in enumerate(["Month", "Revenue", "Etsy fees", "Labels", "Cost of goods", "Other exp.", "Net profit", "Profit bar"], 1):
    db.put(c, R0, h, style=S_HEAD)
for m in range(12):
    r = R0 + 1 + m
    db.put(1, r, MONTHS[m], style=S_BOLD)
    db.put(2, r, formula=osum("H", str(m + 1)), style=S_MONEY); db.put(3, r, formula=osum("I", str(m + 1)), style=S_MONEY)
    db.put(4, r, formula=osum("F", str(m + 1)), style=S_MONEY); db.put(5, r, formula=osum("J", str(m + 1)), style=S_MONEY)
    db.put(6, r, formula=esum(str(m + 1)), style=S_MONEY); db.put(7, r, formula="B%d-C%d-D%d-E%d-F%d" % (r, r, r, r, r), style=S_BMONEY)
    db.put(8, r, formula='IF(MAX($G$%d:$G$%d)<=0,"",REPT("█",ROUND(MAX(0,G%d)/MAX($G$%d:$G$%d)*20,0)))' % (R0 + 1, R0 + 12, r, R0 + 1, R0 + 12), style=S_BAR_G)
P0 = R0 + 15
db.put(1, P0 - 1, "By product (orders profit, before other expenses)", style=S_BOLD)
for c, h in enumerate(["Product", "Units sold", "Revenue", "Etsy fees", "Profit", "Margin"], 1):
    db.put(c, P0, h, style=S_HEAD)
for i in range(N_PROD):
    r = P0 + 1 + i; pr = "Products!$A$%d" % (2 + i)
    db.put(1, r, formula='IF(%s="","",%s)' % (pr, pr))
    db.put(2, r, formula='IF($A%d="","",%s)' % (r, osum("C", prod="$A%d" % r)))
    db.put(3, r, formula='IF($A%d="","",%s)' % (r, osum("H", prod="$A%d" % r)), style=S_MONEY)
    db.put(4, r, formula='IF($A%d="","",%s)' % (r, osum("I", prod="$A%d" % r)), style=S_MONEY)
    db.put(5, r, formula='IF($A%d="","",%s)' % (r, osum("K", prod="$A%d" % r)), style=S_BMONEY)
    db.put(6, r, formula='IF(OR($A%d="",C%d=0),"",E%d/C%d)' % (r, r, r, r), style=S_PCT)

pc = Sheet("Price Calculator"); pc.cols = [(1, 34), (2, 16), (3, 56)]
pc.put(1, 1, "Price Calculator", style=S_TITLE)
pc.put(1, 2, "What should I charge to keep a target profit margin after Etsy fees?", style=S_MUTED)
rows = [("Material + packaging cost / unit", 6.0, S_INPUT_MONEY, "Your cost to make one item"),
        ("Label cost you pay", 5.0, S_INPUT_MONEY, "Postage for one order"),
        ("Shipping you charge the buyer", 5.0, S_INPUT_MONEY, "0 if you offer free shipping"),
        ("Target profit margin", 0.35, S_INPUT_PCT, "Profit as a share of revenue"),
        ("Offsite Ads order? (Yes/No)", "No", S_INPUT, "Yes adds the Offsite Ads fee")]
for i, (k, v, s, n) in enumerate(rows):
    pc.put(1, 4 + i, k, style=S_BOLD); pc.put(2, 4 + i, v, style=s); pc.put(3, 4 + i, n, style=S_MUTED)
VAR = '(%s+%s+IF(B8="Yes",%s,0))' % (TXF, PPF, OFF)
pc.put(1, 10, "Suggested item price", style=S_BOLD)
pc.put(2, 10, formula='IF(1-%s-B7<=0,"margin too high",(B4+B5-B6*(1-%s-B7)+%s+%s)/(1-%s-B7))' % (VAR, VAR, PFX, LSF, VAR), style=S_BMONEY)
pc.put(3, 10, "Item price so that (price + shipping) minus all costs = target margin of (price + shipping)", style=S_MUTED)
pc.put(1, 11, "Check: profit at that price", style=S_MUTED)
pc.put(2, 11, formula='IF(ISNUMBER(B10),(B10+B6)*(1-%s)-%s-%s-B4-B5,"")' % (VAR, PFX, LSF), style=S_MONEY)
pc.put(1, 13, "Margin", style=S_HEAD); pc.put(2, 13, "Item price", style=S_HEAD); pc.put(3, 13, "", style=S_HEAD)
for i, mg in enumerate([0.2, 0.3, 0.4, 0.5, 0.6]):
    r = 14 + i
    pc.put(1, r, mg, style=S_PCT)
    pc.put(2, r, formula='IF(1-%s-A%d<=0,"",(B4+B5-B6*(1-%s-A%d)+%s+%s)/(1-%s-A%d))' % (VAR, r, VAR, r, PFX, LSF, VAR, r), style=S_MONEY)

SHEETS = [start, db, o, prod, ex, pc]

def mirror():
    tx, pp, pf, lf, off = [f[1] for f in FEES]
    cost = {n: m + p for n, m, p, _ in PRODUCTS}
    mon = {m: [0.0] * 5 for m in (1, 2, 3)}
    for m, d, pn, q, it, sc, lc, o_ in ORDERS:
        rev = it + sc; fee = rev * (tx + pp) + pf + q * lf + (rev * off if o_ == "Yes" else 0)
        v = mon[m]; v[0] += rev; v[1] += fee; v[2] += lc; v[3] += q * cost[pn]
    for m, d, desc, a in EXPENSES: mon[m][4] += a
    T = [sum(mon[m][k] for m in mon) for k in range(5)]
    for m in mon:
        v = mon[m]; print(MONTHS[m - 1], " ".join("%.2f" % x for x in v), "net %.2f" % (v[0] - sum(v[1:])))
    net = T[0] - sum(T[1:])
    print("orders %d items %d rev %.2f fees %.2f labels %.2f cogs %.2f other %.2f net %.2f margin %.1f%% feepct %.1f%%" % (
        len(ORDERS), sum(x[3] for x in ORDERS), T[0], T[1], T[2], T[3], T[4], net, net / T[0] * 100, T[1] / T[0] * 100))
    c, lab, ship, mg = 6.0, 5.0, 5.0, 0.35; var = tx + pp
    p = (c + lab - ship * (1 - var - mg) + pf + lf) / (1 - var - mg)
    print("calc price %.2f check %.2f target %.2f" % (p, (p + ship) * (1 - var) - pf - lf - c - lab, mg * (p + ship)))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Etsy-Seller-Profit-Tracker.xlsx", SHEETS,
          {"ProductList": PROD_LIST}, "Etsy Seller Profit Tracker")
    mirror()
