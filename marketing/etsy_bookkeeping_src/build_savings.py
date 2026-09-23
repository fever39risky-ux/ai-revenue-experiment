#!/usr/bin/env python3
"""Build the Savings Goals & Sinking Funds Tracker .xlsx (stdlib only; reuses build_xlsx.py's writer).

Goals with target amount and date, a deposit/withdrawal log, progress bars, what to save per month
to hit each date, and savings by month. Months left use DATEDIF (Numbers drops DAYS()).
Prints a python mirror of the sample figures (as of today) for the listing images.
Usage: python3 build_savings.py OUT.xlsx
"""
import sys, os, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_xlsx
from build_xlsx import (Sheet, build, col, serial, S_DEF, S_HEAD, S_DATE, S_MONEY, S_PCT, S_TITLE,
                        S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_BAR_R, S_INPUT_PCT, S_BOLD)
S_INPUT_MONEY, S_INPUT_DATE = 13, 14
build_xlsx.STYLES = build_xlsx.STYLES.replace('<cellXfs count="14">', '<cellXfs count="15">').replace(
    '</cellXfs>', '<xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/></cellXfs>')
N_GOAL, N_LOG = 20, 2000
YEAR = 2026; MONTHLY = 600
# (goal, target, target y, m, d, starting balance)
GOALS = [("Emergency fund", 6000, 2027, 6, 30, 1500), ("Holiday gifts", 800, 2026, 12, 1, 0),
         ("Car insurance (annual)", 1200, 2027, 3, 15, 300), ("Summer trip", 2500, 2027, 7, 1, 0),
         ("New laptop", 1400, 2027, 1, 31, 200), ("Car repairs", 500, 2027, 12, 31, 0)]
# (y, m, d, goal, type, amount)
LOG = []
for m in range(1, 10):
    LOG += [(2026, m, 1, "Emergency fund", "Deposit", 250), (2026, m, 1, "Car insurance (annual)", "Deposit", 60)]
    if m >= 4: LOG.append((2026, m, 15, "Summer trip", "Deposit", 150))
    if m >= 6: LOG.append((2026, m, 15, "Holiday gifts", "Deposit", 80))
    if m >= 3: LOG.append((2026, m, 20, "New laptop", "Deposit", 100))
LOG += [(2026, 5, 9, "Emergency fund", "Withdrawal", 400), (2026, 8, 22, "Car repairs", "Deposit", 120),
        (2026, 9, 3, "Car repairs", "Withdrawal", 90)]
LOG.sort()

SET = "'Start Here'"; NAME, CUR, MON, YR = (SET + "!$B$%d" % r for r in (5, 6, 7, 8))
start = Sheet("Start Here"); start.cols = [(1, 30), (2, 22), (3, 60)]
start.put(1, 1, "Savings Goals & Sinking Funds Tracker", style=S_TITLE)
start.put(1, 2, "Set a goal, log what you put in, see what to save each month. Excel, Google Sheets and Numbers.", style=S_MUTED)
start.put(1, 4, "Settings", style=S_HEAD); start.put(2, 4, "Your value", style=S_HEAD); start.put(3, 4, "Notes", style=S_HEAD)
for i, (k, v, s, n) in enumerate([("Name", "My savings", S_INPUT, "Shown on the Dashboard"),
                                  ("Currency", "USD", S_INPUT, "Label only. Any currency works"),
                                  ("Monthly amount for savings", MONTHLY, S_INPUT_MONEY, "What you can set aside each month, in total"),
                                  ("Year", YEAR, S_INPUT, "Year shown on the Dashboard month table")]):
    start.put(1, 5 + i, k, style=S_BOLD); start.put(2, 5 + i, v, style=s); start.put(3, 5 + i, n, style=S_MUTED)
for i, t in enumerate(["How to use it",
        "1. Fill in the yellow cells above.",
        "2. Goals tab: one row per goal or sinking fund. Target amount, target date and what you already have.",
        "3. Log tab: every time you move money in or out, add a row. Goal from the dropdown, Deposit or Withdrawal, amount.",
        "4. Goals tab shows saved so far, what's left, % done, months left and what to save per month to hit the date.",
        "5. Dashboard: all goals with progress bars, total needed per month vs what you have, and savings by month.",
        "6. The sample rows show how it works. Delete them when you start.",
        "",
        "Google Sheets: upload this file to Google Drive, then open it with Google Sheets.",
        "Excel / Numbers: just open the file. Only edit the yellow cells and the Log tab."]):
    start.put(1, 10 + i, t, style=S_HEAD if i == 0 else S_DEF)

G_LAST = 1 + N_GOAL; L_LAST = 1 + N_LOG
def lg(c): return "Log!$%s$2:$%s$%d" % (c, c, L_LAST)
go = Sheet("Goals"); go.freeze = (1, 2)
go.cols = [(1, 26), (2, 12), (3, 12), (4, 12), (5, 12), (6, 12), (7, 9), (8, 9), (9, 13), (10, 11), (11, 22)]
for c, h in enumerate(["Goal / fund", "Target", "Target date", "Starting balance", "Saved", "Left", "% done", "Months left",
                       "Save per month", "Status", "Progress"], 1):
    go.put(c, 1, h, style=S_HEAD)
for i in range(N_GOAL):
    r = 2 + i
    if i < len(GOALS):
        n, t, y, m, d, sb = GOALS[i]
        go.put(1, r, n, style=S_INPUT); go.put(2, r, t, style=S_INPUT_MONEY); go.put(3, r, serial(y, m, d), style=S_INPUT_DATE)
        go.put(4, r, sb, style=S_INPUT_MONEY)
    else:
        go.put(1, r, style=S_INPUT); go.put(2, r, style=S_INPUT_MONEY); go.put(3, r, style=S_INPUT_DATE); go.put(4, r, style=S_INPUT_MONEY)
    go.put(5, r, formula='IF(A%d="","",D%d+SUMIFS(%s,%s,$A%d))' % (r, r, lg("F"), lg("B"), r), style=S_BMONEY)
    go.put(6, r, formula='IF(A%d="","",MAX(0,B%d-E%d))' % (r, r, r), style=S_MONEY)
    go.put(7, r, formula='IF(OR(A%d="",B%d=0),"",MIN(1,E%d/B%d))' % (r, r, r, r), style=S_PCT)
    go.put(8, r, formula='IF(OR(A%d="",C%d=""),"",IF(C%d<=TODAY(),0,DATEDIF(TODAY(),C%d,"M")+1))' % (r, r, r, r), style=S_DEF)
    go.put(9, r, formula='IF(OR(A%d="",C%d=""),"",IF(F%d=0,0,F%d/MAX(1,H%d)))' % (r, r, r, r, r), style=S_BMONEY)
    go.put(10, r, formula='IF(A%d="","",IF(F%d=0,"Done",IF(AND(C%d<>"",C%d<TODAY()),"Past date","Saving")))' % (r, r, r, r), style=S_BOLD)
    go.put(11, r, formula='IF(OR(A%d="",B%d=0),"",REPT("█",ROUND(G%d*10,0))&REPT("░",10-ROUND(G%d*10,0)))' % (r, r, r, r), style=S_BAR_G)
go.put(1, G_LAST + 2, "Months left counts this month. Save per month = what's left / months left (the whole amount if the date has passed).", style=S_MUTED)

log = Sheet("Log"); log.freeze = (1, 2); log.cols = [(1, 12), (2, 26), (3, 13), (4, 12), (5, 30), (6, 12), (7, 8), (8, 8)]
for c, h in enumerate(["Date", "Goal / fund", "Type", "Amount", "Note", "Change", "Month", "Year"], 1): log.put(c, 1, h, style=S_HEAD)
for i in range(N_LOG):
    r = 2 + i
    if i < len(LOG):
        y, m, d, g, t, a = LOG[i]
        log.put(1, r, serial(y, m, d), style=S_DATE); log.put(2, r, g); log.put(3, r, t); log.put(4, r, a, style=S_MONEY)
    else:
        log.put(1, r, style=S_DATE); log.put(4, r, style=S_MONEY)
    log.put(6, r, formula='IF(OR(B%d="",D%d=""),0,IF(C%d="Withdrawal",-D%d,D%d))' % (r, r, r, r, r), style=S_MONEY)
    log.put(7, r, formula='IF(A%d="","",MONTH(A%d))' % (r, r), style=S_MUTED)
    log.put(8, r, formula='IF(A%d="","",YEAR(A%d))' % (r, r), style=S_MUTED)
log.dv += [("B2:B%d" % L_LAST, "GoalList"), ("C2:C%d" % L_LAST, '"Deposit,Withdrawal"')]
log.put(1, L_LAST + 2, "Amounts are positive. Pick Withdrawal when you take money out. Change, Month and Year are helpers; leave them.", style=S_MUTED)

def gr(c): return "Goals!$%s$2:$%s$%d" % (c, c, G_LAST)
db = Sheet("Dashboard"); db.cols = [(1, 30), (2, 14), (3, 3), (4, 26), (5, 12), (6, 12), (7, 9), (8, 13), (9, 22)]
db.put(1, 1, formula='%s&" dashboard"' % NAME, style=S_TITLE)
db.put(1, 2, formula='"All amounts in "&%s&". Month table shows "&%s&"."' % (CUR, YR), style=S_MUTED)
db.put(1, 4, "Overview", style=S_HEAD); db.put(2, 4, "", style=S_HEAD)
OV = [("Total of all targets", "SUM(%s)" % gr("B"), S_BMONEY), ("Saved so far", "SUM(%s)" % gr("E"), S_BMONEY),
      ("Still to save", "SUM(%s)" % gr("F"), S_BMONEY), ("Overall progress", 'IF(B5=0,"",MIN(1,B6/B5))', S_PCT),
      ("Needed per month (all goals)", "SUM(%s)" % gr("I"), S_BMONEY), ("You set aside per month", MON, S_BMONEY),
      ("Spare (+) or short (-) per month", "B10-B9", S_BMONEY), ("Goals done", 'COUNTIFS(%s,"Done")' % gr("J"), S_BOLD)]
for i, (k, f, s) in enumerate(OV):
    db.put(1, 5 + i, k, style=S_BOLD); db.put(2, 5 + i, formula=f, style=s)
db.put(1, 14, "Month", style=S_HEAD); db.put(2, 14, "Net saved", style=S_HEAD)
for m in range(12):
    r = 15 + m
    db.put(1, r, datetime.date(2000, m + 1, 1).strftime("%B"), style=S_BOLD)
    db.put(2, r, formula="SUMIFS(%s,%s,%d,%s,%s)" % (lg("F"), lg("G"), m + 1, lg("H"), YR), style=S_MONEY)
db.put(1, 27, "Year total", style=S_BOLD); db.put(2, 27, formula="SUM(B15:B26)", style=S_BMONEY)
db.put(1, 28, "Net saved = deposits minus withdrawals logged that month (starting balances are not included).", style=S_MUTED)
db.put(4, 4, "Goals", style=S_HEAD)
for c, h in enumerate(["Saved", "Target", "Done", "Per month", "Progress"], 5): db.put(c, 4, h, style=S_HEAD)
for k in range(12):
    r = 5 + k; s = 2 + k
    for c, src, st in [(4, "A", S_DEF), (5, "E", S_MONEY), (6, "B", S_MONEY), (7, "G", S_PCT), (8, "I", S_MONEY), (9, "K", S_BAR_G)]:
        db.put(c, r, formula='IF(Goals!$A%d="","",Goals!%s%d)' % (s, src, s), style=st)
db.put(4, 18, "First 12 goals. The Goals tab has all of them.", style=S_MUTED)

SHEETS = [start, db, go, log]

def months_left(t, today):
    if t <= today: return 0
    m = (t.year - today.year) * 12 + t.month - today.month - (1 if t.day < today.day else 0)
    return m + 1

def mirror(today=None):
    today = today or datetime.date.today(); tot = [0, 0, 0, 0]
    for n, t, y, m, d, sb in GOALS:
        saved = sb + sum(a if ty == "Deposit" else -a for *_, g, ty, a in LOG if g == n)
        left = max(0, t - saved); ml = months_left(datetime.date(y, m, d), today); pm = 0 if left == 0 else left / max(1, ml)
        tot[0] += t; tot[1] += saved; tot[2] += left; tot[3] += pm
        print("  %-24s saved %8.2f left %8.2f done %5.1f%% months %2d per month %8.2f" % (n, saved, left, min(1, saved / t) * 100, ml, pm))
    print("targets %.2f saved %.2f left %.2f progress %.1f%% needed/mo %.2f spare %.2f" % (tot[0], tot[1], tot[2], tot[1] / tot[0] * 100, tot[3], MONTHLY - tot[3]))
    for m in (5, 8, 9): print("  month %d net %.2f" % (m, sum(a if ty == "Deposit" else -a for y, mm, d, g, ty, a in LOG if mm == m)))
    print("  year net %.2f" % sum(a if ty == "Deposit" else -a for y, mm, d, g, ty, a in LOG))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Savings-Goals-Tracker.xlsx", SHEETS,
          {"GoalList": "Goals!$A$2:$A$%d" % G_LAST}, "Savings Goals & Sinking Funds Tracker")
    mirror()
