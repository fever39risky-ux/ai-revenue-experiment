#!/usr/bin/env python3
"""Build the Wedding Budget Planner .xlsx (stdlib only; reuses build_xlsx.py's writer).

Budget by category, vendor costs and payments with due dates, guest list with RSVPs.
The upcoming-payments list uses a due-date helper column with SMALL (no array formulas).
Prints a python mirror of the sample figures for the listing images.
Usage: python3 build_wedding.py OUT.xlsx
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_xlsx
from build_xlsx import (Sheet, build, col, serial, S_DEF, S_HEAD, S_DATE, S_MONEY, S_PCT, S_TITLE,
                        S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_BAR_R, S_INPUT_PCT, S_BOLD)
S_INPUT_MONEY, S_INPUT_DATE = 13, 14
build_xlsx.STYLES = build_xlsx.STYLES.replace('<cellXfs count="14">', '<cellXfs count="15">').replace(
    '</cellXfs>', '<xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/></cellXfs>')
N_CAT, N_VEN, N_GUEST, N_UP = 25, 150, 400, 12
BUDGET = 25000; WEDDING = (2027, 6, 12)
CATS = [("Venue", .22), ("Catering", .25), ("Photography", .10), ("Videography", .05), ("Attire", .06), ("Rings", .04),
        ("Flowers", .05), ("Music / DJ", .04), ("Cake", .02), ("Stationery", .02), ("Hair & makeup", .02),
        ("Decor & rentals", .04), ("Transport", .02), ("Favors & gifts", .02), ("Officiant", .01), ("Other", .04)]
# (vendor, category, item, cost, paid, due y, m, d)
VENDORS = [("Rosewood Barn", "Venue", "Venue hire", 5200, 1500, 2027, 3, 1), ("Fork & Field", "Catering", "Dinner for 110", 6380, 1000, 2027, 5, 28),
           ("Lena Park Photo", "Photography", "8 hours + album", 2600, 800, 2027, 5, 12), ("Bloom Studio", "Flowers", "Bouquets and centrepieces", 1150, 300, 2027, 5, 29),
           ("Sound Wave DJs", "Music / DJ", "Ceremony + reception", 950, 200, 2027, 5, 15), ("Bridal boutique", "Attire", "Dress and alterations", 1480, 1480, 2027, 1, 10),
           ("Suit hire", "Attire", "Suit hire", 260, 0, 2027, 5, 20), ("Sugar Bakes", "Cake", "3-tier cake", 520, 100, 2027, 5, 30),
           ("PaperLeaf", "Stationery", "Invitations + postage", 410, 410, 2026, 12, 1), ("Jeweller", "Rings", "Two bands", 1350, 1350, 2026, 11, 20),
           ("Glow Team", "Hair & makeup", "Bride + 3", 640, 150, 2027, 6, 1)]
def guests():
    out = []; cyc = [("Yes", "Chicken")] * 5 + [("Yes", "Fish")] * 3 + [("Yes", "Vegetarian")] * 2 + [("Pending", "")] * 3 + [("No", "")] * 2
    for i in range(60):
        rs, meal = cyc[i % len(cyc)]; party = 2 if i % 3 == 0 else 1
        out.append(("Guest %d" % (i + 1), party, rs, meal, (i // 5) + 1 if rs == "Yes" else None))
    return out
GUESTS = guests()

SET = "'Start Here'"; NAMES, WDATE, CUR, TOTAL = SET + "!$B$5", SET + "!$B$6", SET + "!$B$7", SET + "!$B$8"
start = Sheet("Start Here"); start.cols = [(1, 26), (2, 22), (3, 60)]
start.put(1, 1, "Wedding Budget Planner", style=S_TITLE)
start.put(1, 2, "Budget, vendor payments and guest list in one file. Excel, Google Sheets and Numbers.", style=S_MUTED)
start.put(1, 4, "Settings", style=S_HEAD); start.put(2, 4, "Your value", style=S_HEAD); start.put(3, 4, "Notes", style=S_HEAD)
for i, (k, v, s, n) in enumerate([("Couple", "Sam & Alex", S_INPUT, "Shown on the Dashboard"),
                                  ("Wedding date", serial(*WEDDING), S_INPUT_DATE, "Used for the countdown"),
                                  ("Currency", "USD", S_INPUT, "Label only. Any currency works"),
                                  ("Total budget", BUDGET, S_INPUT_MONEY, "Your all-in budget")]):
    start.put(1, 5 + i, k, style=S_BOLD); start.put(2, 5 + i, v, style=s); start.put(3, 5 + i, n, style=S_MUTED)
for i, t in enumerate(["How to use it",
        "1. Fill in the yellow cells above: couple, wedding date, currency and total budget.",
        "2. Budget tab: adjust the % of your budget for each category (16 included, up to 25).",
        "3. Vendors tab: every booking with its category, total cost, amount paid so far and next due date.",
        "4. Guests tab: names, party size, RSVP and meal choice from dropdowns, table number.",
        "5. Dashboard: budget vs committed vs paid, what's still to pay, upcoming payments, RSVPs and cost per guest.",
        "6. The sample rows show how it works. Delete them when you start.",
        "",
        "Google Sheets: upload this file to Google Drive, then open it with Google Sheets.",
        "Excel / Numbers: just open the file. Only edit the yellow cells and the Vendors and Guests tabs."]):
    start.put(1, 10 + i, t, style=S_HEAD if i == 0 else S_DEF)

lists = Sheet("Lists"); lists.cols = [(1, 14), (2, 16)]
lists.put(1, 1, "RSVP", style=S_HEAD); lists.put(2, 1, "Meal", style=S_HEAD)
for i, v in enumerate(["Yes", "No", "Pending"]): lists.put(1, 2 + i, v)
for i, v in enumerate(["Chicken", "Fish", "Vegetarian", "Vegan", "Kids meal", "Other"]): lists.put(2, 2 + i, v)
lists.put(1, 10, "Used by the Guests dropdowns. Edit the meal options if you like.", style=S_MUTED)

C_LAST = 1 + N_CAT
bud = Sheet("Budget"); bud.cols = [(1, 22), (2, 10), (3, 13), (4, 13), (5, 13), (6, 13), (7, 13), (8, 22)]
for c, h in enumerate(["Category", "% of budget", "Planned", "Committed", "Paid", "Still to pay", "Left vs plan", "Committed bar"], 1):
    bud.put(c, 1, h, style=S_HEAD)
V_LAST = 1 + N_VEN
def v(c): return "Vendors!$%s$2:$%s$%d" % (c, c, V_LAST)
for i in range(N_CAT):
    r = 2 + i; n, pct = CATS[i] if i < len(CATS) else (None, None)
    bud.put(1, r, n, style=S_INPUT); bud.put(2, r, pct, style=S_INPUT_PCT)
    bud.put(3, r, formula='IF($A%d="","",B%d*%s)' % (r, r, TOTAL), style=S_MONEY)
    bud.put(4, r, formula='IF($A%d="","",SUMIFS(%s,%s,$A%d))' % (r, v("D"), v("B"), r), style=S_MONEY)
    bud.put(5, r, formula='IF($A%d="","",SUMIFS(%s,%s,$A%d))' % (r, v("E"), v("B"), r), style=S_MONEY)
    bud.put(6, r, formula='IF($A%d="","",D%d-E%d)' % (r, r, r), style=S_MONEY)
    bud.put(7, r, formula='IF($A%d="","",C%d-D%d)' % (r, r, r), style=S_BMONEY)
    bud.put(8, r, formula='IF(OR($A%d="",C%d=0),"",REPT("█",MIN(20,ROUND(D%d/C%d*10,0))))' % (r, r, r, r), style=S_BAR_G)
bud.put(1, C_LAST + 1, "Total", style=S_BOLD)
bud.put(2, C_LAST + 1, formula="SUM(B2:B%d)" % C_LAST, style=S_PCT)
for c in (3, 4, 5, 6, 7): bud.put(c, C_LAST + 1, formula="SUM(%s2:%s%d)" % (col(c), col(c), C_LAST), style=S_BMONEY)
bud.put(1, C_LAST + 3, "Percentages are a starting point, not a rule. Keep the total at 100%. A full bar (10 blocks) = exactly on plan.", style=S_MUTED)
bud.put(1, C_LAST + 4, "Left vs plan below zero means that category is over budget.", style=S_MUTED)

ven = Sheet("Vendors"); ven.freeze = (1, 2)
ven.cols = [(1, 22), (2, 18), (3, 26), (4, 12), (5, 12), (6, 13), (7, 12), (8, 12), (9, 10)]
for c, h in enumerate(["Vendor", "Category", "What for", "Total cost", "Paid so far", "Next due date", "Balance", "Status", "Due order"], 1):
    ven.put(c, 1, h, style=S_HEAD)
for i in range(N_VEN):
    r = 2 + i
    if i < len(VENDORS):
        vn, cat, item, cost, paid, y, m, d = VENDORS[i]
        ven.put(1, r, vn); ven.put(2, r, cat); ven.put(3, r, item); ven.put(4, r, cost, style=S_MONEY); ven.put(5, r, paid, style=S_MONEY)
        ven.put(6, r, serial(y, m, d), style=S_DATE)
    else:
        ven.put(4, r, style=S_MONEY); ven.put(5, r, style=S_MONEY); ven.put(6, r, style=S_DATE)
    ven.put(7, r, formula='IF(A%d="","",D%d-E%d)' % (r, r, r), style=S_MONEY)
    ven.put(8, r, formula='IF(A%d="","",IF(G%d<=0,"Paid",IF(F%d="","Due",IF(F%d<TODAY(),"Overdue","Due"))))' % (r, r, r, r), style=S_BOLD)
    ven.put(9, r, formula='IF(OR(A%d="",G%d<=0,F%d=""),"",F%d+ROW()/100000)' % (r, r, r, r), style=S_MUTED)
ven.dv.append(("B2:B%d" % V_LAST, "CategoryList"))
ven.put(1, V_LAST + 2, "Balance = total cost - paid so far. Update 'Paid so far' and the next due date after each payment.", style=S_MUTED)

G_LAST = 1 + N_GUEST
gu = Sheet("Guests"); gu.freeze = (1, 2); gu.cols = [(1, 26), (2, 9), (3, 11), (4, 14), (5, 9), (6, 30)]
for c, h in enumerate(["Guest / household", "Party of", "RSVP", "Meal", "Table", "Notes"], 1): gu.put(c, 1, h, style=S_HEAD)
for i in range(N_GUEST):
    r = 2 + i
    if i < len(GUESTS):
        n, p, rs, meal, tb = GUESTS[i]
        gu.put(1, r, n); gu.put(2, r, p); gu.put(3, r, rs); gu.put(4, r, meal or None); gu.put(5, r, tb)
gu.dv += [("C2:C%d" % G_LAST, "RsvpList"), ("D2:D%d" % G_LAST, "MealList")]
def g(c): return "Guests!$%s$2:$%s$%d" % (c, c, G_LAST)

db = Sheet("Dashboard"); db.cols = [(1, 26), (2, 15), (3, 3), (4, 22), (5, 18), (6, 13), (7, 13), (8, 11)]
db.put(1, 1, formula='%s&" wedding"' % NAMES, style=S_TITLE)
db.put(1, 2, formula='IF(%s>=TODAY(),DATEDIF(TODAY(),%s,"D")&" days to go","Married!")&"  |  all amounts in "&%s' % (WDATE, WDATE, CUR), style=S_MUTED)
db.put(1, 4, "Money", style=S_HEAD); db.put(2, 4, "", style=S_HEAD)
MONEY = [("Total budget", TOTAL), ("Committed (booked)", "SUM(%s)" % v("D")), ("Paid so far", "SUM(%s)" % v("E")),
         ("Still to pay", "SUM(%s)" % v("G")), ("Left to book", "B5-B6"), ("Paid of committed", 'IF(B6=0,"",B7/B6)')]
for i, (k, f) in enumerate(MONEY):
    db.put(1, 5 + i, k, style=S_BOLD); db.put(2, 5 + i, formula=f, style=S_PCT if i == 5 else S_BMONEY)
db.put(1, 12, "Guests", style=S_HEAD); db.put(2, 12, "", style=S_HEAD)
GST = [("Invited (people)", "SUM(%s)" % g("B")), ("Attending", 'SUMIFS(%s,%s,"Yes")' % (g("B"), g("C"))),
       ("Pending", 'SUMIFS(%s,%s,"Pending")' % (g("B"), g("C"))), ("Declined", 'SUMIFS(%s,%s,"No")' % (g("B"), g("C"))),
       ("No reply yet", "B13-B14-B15-B16"), ("Committed cost per attending guest", 'IF(B14=0,"",B6/B14)')]
for i, (k, f) in enumerate(GST):
    db.put(1, 13 + i, k, style=S_BOLD); db.put(2, 13 + i, formula=f, style=S_BMONEY if i == 5 else S_BOLD)
db.put(1, 20, "Meals (attending)", style=S_HEAD); db.put(2, 20, "", style=S_HEAD)
for i, meal in enumerate(["Chicken", "Fish", "Vegetarian", "Vegan", "Kids meal", "Other"]):
    db.put(1, 21 + i, formula="Lists!$B$%d" % (2 + i), style=S_BOLD)
    db.put(2, 21 + i, formula='SUMIFS(%s,%s,"Yes",%s,A%d)' % (g("B"), g("C"), g("D"), 21 + i), style=S_BOLD)
db.put(1, 28, "Meal counts use party size, so give each household one meal type or split it into rows.", style=S_MUTED)
db.put(4, 4, "Upcoming payments", style=S_HEAD)
for c, h in enumerate(["Vendor", "Due", "Balance", "Status"], 5): db.put(c, 4, h, style=S_HEAD)
for k in range(N_UP):
    r = 5 + k; idx = "MATCH(SMALL(%s,%d),%s,0)" % (v("I"), k + 1, v("I"))
    db.put(4, r, formula='IFERROR(INDEX(%s,%s),"")' % (v("A"), idx))
    db.put(5, r, formula='IFERROR(INDEX(%s,%s),"")' % (v("F"), idx), style=S_DATE)
    db.put(6, r, formula='IFERROR(INDEX(%s,%s),"")' % (v("G"), idx), style=S_MONEY)
    db.put(7, r, formula='IFERROR(INDEX(%s,%s),"")' % (v("H"), idx), style=S_BAR_R)
db.put(4, 5 + N_UP, "Unpaid balances with a due date, soonest first (first 12).", style=S_MUTED)

SHEETS = [start, db, bud, ven, gu, lists]

def mirror():
    committed = sum(x[3] for x in VENDORS); paid = sum(x[4] for x in VENDORS)
    att = sum(p for n, p, rs, m, t in GUESTS if rs == "Yes"); inv = sum(p for n, p, rs, m, t in GUESTS)
    pend = sum(p for n, p, rs, m, t in GUESTS if rs == "Pending"); dec = sum(p for n, p, rs, m, t in GUESTS if rs == "No")
    print("budget %d committed %.2f paid %.2f still %.2f left to book %.2f paid%% %.1f" % (BUDGET, committed, paid, committed - paid, BUDGET - committed, paid / committed * 100))
    print("guests invited %d attending %d pending %d declined %d per guest %.2f" % (inv, att, pend, dec, committed / att))
    for meal in ("Chicken", "Fish", "Vegetarian"): print("  %s %d" % (meal, sum(p for n, p, rs, m, t in GUESTS if rs == "Yes" and m == meal)))
    for n, pct in CATS:
        c = sum(x[3] for x in VENDORS if x[1] == n); pd = sum(x[4] for x in VENDORS if x[1] == n)
        if c: print("  %-16s planned %8.2f committed %8.2f paid %8.2f left %8.2f" % (n, pct * BUDGET, c, pd, pct * BUDGET - c))
    up = sorted((x for x in VENDORS if x[3] - x[4] > 0), key=lambda x: (x[5], x[6], x[7]))
    for x in up[:6]: print("  due %d-%02d-%02d %-16s %8.2f" % (x[5], x[6], x[7], x[0], x[3] - x[4]))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Wedding-Budget-Planner.xlsx", SHEETS,
          {"CategoryList": "Budget!$A$2:$A$%d" % C_LAST, "RsvpList": "Lists!$A$2:$A$4", "MealList": "Lists!$B$2:$B$7"}, "Wedding Budget Planner")
    mirror()
