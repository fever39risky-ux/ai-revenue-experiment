#!/usr/bin/env python3
"""Build the FREE one-sheet Simple Budget (lite) .xlsx, the owned-site lead magnet.

Deliberately a subset of the paid Monthly Budget Planner: one month, totals typed in by
hand, no transaction log, no dropdowns, no year overview. The sheet points to the full version.
Usage: python3 build_budget_lite.py OUT.xlsx
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_xlsx import Sheet, build, S_DEF, S_HEAD, S_MONEY, S_PCT, S_TITLE, S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_BOLD
S_INPUT_MONEY = 13
INCOME = [("Salary", 3200), ("Side income", 250)]
EXPENSE = [("Rent / mortgage", 1100, 1100), ("Utilities", 160, 88), ("Groceries", 420, 444.55), ("Transport", 180, 130),
           ("Phone & internet", 75, 75), ("Insurance", 120, 120), ("Eating out", 150, 163.7), ("Subscriptions", 45, 26.98),
           ("Shopping", 150, 89.99), ("Savings transfer", 400, 400), ("Debt payments", 200, 200), ("Other", 50, 45)]
N_INC, N_EXP = 3, 15
FULL = "https://fever39risky-ux.github.io/ai-revenue-experiment/store/spreadsheets.html"

s = Sheet("Start Here"); s.cols = [(1, 24), (2, 13), (3, 13), (4, 13), (5, 9), (6, 24)]
s.put(1, 1, "Simple Monthly Budget (free)", style=S_TITLE)
s.put(1, 2, "Type your monthly budget and what you actually spent in the yellow cells. Everything else updates.", style=S_MUTED)
s.put(1, 4, "Summary", style=S_HEAD); s.put(2, 4, "Planned", style=S_HEAD); s.put(3, 4, "Actual", style=S_HEAD); s.put(4, 4, "Difference", style=S_HEAD)
inc0 = 12; inc_last = inc0 + N_INC - 1
exp0 = inc_last + 4; exp_last = exp0 + N_EXP - 1
s.put(1, 5, "Income", style=S_BOLD); s.put(2, 5, formula="SUM(B%d:B%d)" % (inc0, inc_last), style=S_MONEY)
s.put(3, 5, formula="SUM(C%d:C%d)" % (inc0, inc_last), style=S_MONEY); s.put(4, 5, formula="C5-B5", style=S_BMONEY)
s.put(1, 6, "Spending", style=S_BOLD); s.put(2, 6, formula="SUM(B%d:B%d)" % (exp0, exp_last), style=S_MONEY)
s.put(3, 6, formula="SUM(C%d:C%d)" % (exp0, exp_last), style=S_MONEY); s.put(4, 6, formula="B6-C6", style=S_BMONEY)
s.put(1, 7, "Left over", style=S_BOLD); s.put(2, 7, formula="B5-B6", style=S_BMONEY); s.put(3, 7, formula="C5-C6", style=S_BMONEY)
s.put(1, 8, "Share of income spent", style=S_BOLD); s.put(3, 8, formula='IF(C5=0,"",C6/C5)', style=S_PCT)
s.put(1, inc0 - 2, "INCOME", style=S_BOLD)
for c, h in enumerate(["Source", "Expected", "Received", "Difference"], 1): s.put(c, inc0 - 1, h, style=S_HEAD)
for i in range(N_INC):
    r = inc0 + i; n, b = INCOME[i] if i < len(INCOME) else (None, None)
    s.put(1, r, n, style=S_INPUT); s.put(2, r, b, style=S_INPUT_MONEY); s.put(3, r, b, style=S_INPUT_MONEY)
    s.put(4, r, formula='IF(B%d="","",C%d-B%d)' % (r, r, r), style=S_BMONEY)
s.put(1, exp0 - 2, "SPENDING", style=S_BOLD)
for c, h in enumerate(["Category", "Budget", "Spent", "Left", "Used", "Used bar"], 1): s.put(c, exp0 - 1, h, style=S_HEAD)
for i in range(N_EXP):
    r = exp0 + i; n, b, a = EXPENSE[i] if i < len(EXPENSE) else (None, None, None)
    s.put(1, r, n, style=S_INPUT); s.put(2, r, b, style=S_INPUT_MONEY); s.put(3, r, a, style=S_INPUT_MONEY)
    s.put(4, r, formula='IF(B%d="","",B%d-C%d)' % (r, r, r), style=S_BMONEY)
    s.put(5, r, formula='IF(OR(B%d="",B%d=0),"",C%d/B%d)' % (r, r, r, r), style=S_PCT)
    s.put(6, r, formula='IF(OR(B%d="",B%d=0),"",REPT("█",MIN(20,ROUND(C%d/B%d*10,0))))' % (r, r, r, r), style=S_BAR_G)
n0 = exp_last + 2
for i, t in enumerate(["Negative 'Left' = overspent. The sample numbers show how it works; overwrite them with yours.",
                       "Works in Excel, Google Sheets (upload to Drive, open with Google Sheets) and Apple Numbers.",
                       "",
                       "Want it to add up your spending for you? The full Monthly Budget Planner adds a 3,000-row",
                       "transaction log with category dropdowns, automatic month totals, and a 12-month overview with savings rate:",
                       FULL]):
    s.put(1, n0 + i, t, style=S_HEAD if i == 3 else S_MUTED)

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Simple-Monthly-Budget-Free.xlsx", [s], {"SpendingTable": "'Start Here'!$A$18:$F$32"}, "Simple Monthly Budget (free)")
    ti = sum(b for _, b in INCOME); te = sum(a for _, _, a in EXPENSE); be = sum(b for _, b, _ in EXPENSE)
    print("income %.2f planned spend %.2f actual spend %.2f left %.2f spent%% %.1f" % (ti, be, te, ti - te, te / ti * 100))
