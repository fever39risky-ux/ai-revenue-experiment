#!/usr/bin/env python3
"""Build the Monthly Budget Planner .xlsx (stdlib only; reuses build_xlsx.py's writer).

Prints a python mirror of the sample figures for the listing images.
Usage: python3 build_budget.py OUT.xlsx
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_xlsx import (Sheet, build, col, serial, S_DEF, S_HEAD, S_DATE, S_MONEY, S_PCT, S_TITLE,
                        S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_BAR_R, S_INPUT_PCT, S_BOLD)
S_INPUT_MONEY = 13
YEAR = 2026
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
N_INC, N_EXP, TX_ROWS = 8, 25, 3000
INCOME = [("Salary", 3200), ("Side income", 300), ("Other income", 0)]
EXPENSE = [("Rent / mortgage", 1100), ("Utilities", 160), ("Groceries", 420), ("Transport", 180), ("Phone & internet", 75),
           ("Insurance", 120), ("Eating out", 150), ("Subscriptions", 45), ("Shopping", 150), ("Health", 60),
           ("Gifts", 50), ("Entertainment", 80), ("Savings transfer", 400), ("Debt payments", 200), ("Other", 50)]
SAMPLE = [(9, 1, "Salary", "Monthly pay", 3200), (9, 3, "Rent / mortgage", "September rent", 1100),
          (9, 4, "Groceries", "Supermarket", 96.4), (9, 6, "Transport", "Fuel", 58), (9, 8, "Subscriptions", "Streaming + music", 26.98),
          (9, 10, "Eating out", "Dinner with friends", 64), (9, 11, "Groceries", "Supermarket", 112.35), (9, 12, "Utilities", "Electricity", 88),
          (9, 14, "Phone & internet", "Mobile + broadband", 75), (9, 15, "Side income", "Freelance job", 250), (9, 16, "Shopping", "Shoes", 89.99),
          (9, 18, "Groceries", "Supermarket", 104.1), (9, 19, "Entertainment", "Cinema", 32), (9, 20, "Insurance", "Car insurance", 120),
          (9, 22, "Health", "Pharmacy", 18.5), (9, 23, "Eating out", "Lunch", 41.2), (9, 25, "Savings transfer", "To savings account", 400),
          (9, 26, "Debt payments", "Credit card", 200), (9, 27, "Transport", "Train pass", 72), (9, 28, "Groceries", "Supermarket", 131.7),
          (9, 29, "Eating out", "Takeaway", 58.5), (9, 30, "Gifts", "Birthday present", 45)]
SET = "'Start Here'"; YR, CUR, MON = SET + "!$B$5", SET + "!$B$6", SET + "!$B$7"

start = Sheet("Start Here"); start.cols = [(1, 26), (2, 18), (3, 60)]
start.put(1, 1, "Monthly Budget Planner", style=S_TITLE)
start.put(1, 2, "Plan each category, log what you spend, see what's left. Excel, Google Sheets and Numbers.", style=S_MUTED)
start.put(1, 4, "Settings", style=S_HEAD); start.put(2, 4, "Your value", style=S_HEAD); start.put(3, 4, "Notes", style=S_HEAD)
for i, (k, v, s, n) in enumerate([("Year", YEAR, S_INPUT, "Only entries dated in this year are counted"),
                                  ("Currency", "USD", S_INPUT, "Label only. Any currency works"),
                                  ("Month to show (1-12)", 9, S_INPUT, "The Monthly Budget tab shows this month")]):
    start.put(1, 5 + i, k, style=S_BOLD); start.put(2, 5 + i, v, style=s); start.put(3, 5 + i, n, style=S_MUTED)
for i, t in enumerate(["How to use it",
        "1. Set the year, currency label and the month you want to see (yellow cells).",
        "2. Categories tab: your income sources and spending categories with a monthly budget for each.",
        "3. Transactions tab: log every payment and every income (date, category from the dropdown, amount).",
        "   Enter all amounts as positive numbers. Income or Expense is filled in for you.",
        "4. Monthly Budget tab: budget vs actual and what's left in every category for the chosen month.",
        "5. Year Overview tab: income, spending, savings and savings rate for all 12 months.",
        "6. The sample rows (September) show how it works. Delete them when you start.",
        "",
        "Google Sheets: upload this file to Google Drive, then open it with Google Sheets.",
        "Excel / Numbers: just open the file. Only edit the yellow cells and the Transactions tab."]):
    start.put(1, 9 + i, t, style=S_HEAD if i == 0 else S_DEF)

cats = Sheet("Categories"); cats.cols = [(1, 28), (2, 11), (3, 16), (4, 44)]
for c, h in enumerate(["Category", "Type", "Monthly budget", "Tip"], 1): cats.put(c, 1, h, style=S_HEAD)
for i in range(N_INC):
    r = 2 + i; n, b = INCOME[i] if i < len(INCOME) else (None, None)
    cats.put(1, r, n, style=S_INPUT); cats.put(2, r, "Income", style=S_MUTED); cats.put(3, r, b, style=S_INPUT_MONEY)
for i in range(N_EXP):
    r = 2 + N_INC + i; n, b = EXPENSE[i] if i < len(EXPENSE) else (None, None)
    cats.put(1, r, n, style=S_INPUT); cats.put(2, r, "Expense", style=S_MUTED); cats.put(3, r, b, style=S_INPUT_MONEY)
cats.put(4, 2, "Rows 2-9: income (expected per month).", style=S_MUTED)
cats.put(4, 10, "Rows 10-34: spending categories with a monthly budget.", style=S_MUTED)
cats.put(4, 3, "Rename any category or fill a blank yellow cell to add one.", style=S_MUTED)
INC_RANGE = "Categories!$A$2:$A$%d" % (1 + N_INC)
ALL_RANGE = "Categories!$A$2:$A$%d" % (1 + N_INC + N_EXP)

tx = Sheet("Transactions"); tx.freeze = (1, 2); tx.cols = [(1, 13), (2, 24), (3, 32), (4, 13), (5, 11), (6, 7), (7, 7)]
for c, h in enumerate(["Date", "Category", "Description", "Amount", "Type (auto)", "Month", "Year"], 1): tx.put(c, 1, h, style=S_HEAD)
for r in range(2, TX_ROWS + 2):
    i = r - 2
    if i < len(SAMPLE):
        m, d, cat, desc, a = SAMPLE[i]
        tx.put(1, r, serial(YEAR, m, d), style=S_DATE); tx.put(2, r, cat); tx.put(3, r, desc); tx.put(4, r, a, style=S_MONEY)
    else:
        tx.put(1, r, style=S_DATE); tx.put(4, r, style=S_MONEY)
    tx.put(5, r, formula='IF(B%d="","",IF(COUNTIF(%s,B%d)>0,"Income","Expense"))' % (r, INC_RANGE, r), style=S_MUTED)
    tx.put(6, r, formula='IF(A%d="","",MONTH(A%d))' % (r, r), style=S_MUTED)
    tx.put(7, r, formula='IF(A%d="","",YEAR(A%d))' % (r, r), style=S_MUTED)
tx.dv.append(("B2:B%d" % (TX_ROWS + 1), "CategoryList"))
def t(c): return "Transactions!$%s$2:$%s$%d" % (c, c, TX_ROWS + 1)
def s_cat(catref, month): return "SUMIFS(%s,%s,%s,%s,%s,%s,%s)" % (t("D"), t("B"), catref, t("G"), YR, t("F"), month)
def s_type(ty, month): return 'SUMIFS(%s,%s,"%s",%s,%s,%s,%s)' % (t("D"), t("E"), ty, t("G"), YR, t("F"), month)

mb = Sheet("Monthly Budget"); mb.cols = [(1, 26), (2, 13), (3, 13), (4, 13), (5, 10), (6, 24)]
mb.put(1, 1, formula='"Budget for "&INDEX({"January","February","March","April","May","June","July","August","September","October","November","December"},%s)&" "&%s' % (MON, YR), style=S_TITLE)
mb.put(1, 2, formula='"All amounts in "&%s&". Change the month on the Start Here tab."' % CUR, style=S_MUTED)
mb.put(1, 4, "Summary", style=S_HEAD); mb.put(2, 4, "Planned", style=S_HEAD); mb.put(3, 4, "Actual", style=S_HEAD); mb.put(4, 4, "Difference", style=S_HEAD)
r0 = 12
inc_first, inc_last = r0 + 2, r0 + 1 + N_INC
exp_first = inc_last + 4; exp_last = exp_first + N_EXP - 1
mb.put(1, 5, "Income", style=S_BOLD); mb.put(2, 5, formula="SUM(B%d:B%d)" % (inc_first, inc_last), style=S_MONEY)
mb.put(3, 5, formula=s_type("Income", MON), style=S_MONEY); mb.put(4, 5, formula="C5-B5", style=S_BMONEY)
mb.put(1, 6, "Spending", style=S_BOLD); mb.put(2, 6, formula="SUM(B%d:B%d)" % (exp_first, exp_last), style=S_MONEY)
mb.put(3, 6, formula=s_type("Expense", MON), style=S_MONEY); mb.put(4, 6, formula="B6-C6", style=S_BMONEY)
mb.put(1, 7, "Left over", style=S_BOLD); mb.put(2, 7, formula="B5-B6", style=S_BMONEY); mb.put(3, 7, formula="C5-C6", style=S_BMONEY)
mb.put(1, 8, "Share of income spent", style=S_BOLD); mb.put(3, 8, formula='IF(C5=0,"",C6/C5)', style=S_PCT)
mb.put(1, 10, "Positive difference = more income than planned / less spent than budgeted.", style=S_MUTED)
mb.put(1, r0, "INCOME", style=S_BOLD)
for c, h in enumerate(["Source", "Expected", "Received", "Difference"], 1): mb.put(c, r0 + 1, h, style=S_HEAD)
for i in range(N_INC):
    r = inc_first + i; cr = "Categories!$A$%d" % (2 + i); br = "Categories!$C$%d" % (2 + i)
    mb.put(1, r, formula='IF(%s="","",%s)' % (cr, cr))
    mb.put(2, r, formula='IF($A%d="","",%s)' % (r, br), style=S_MONEY)
    mb.put(3, r, formula='IF($A%d="","",%s)' % (r, s_cat("$A%d" % r, MON)), style=S_MONEY)
    mb.put(4, r, formula='IF($A%d="","",C%d-B%d)' % (r, r, r), style=S_BMONEY)
mb.put(1, exp_first - 2, "SPENDING", style=S_BOLD)
for c, h in enumerate(["Category", "Budget", "Spent", "Left", "Used", "Used bar"], 1): mb.put(c, exp_first - 1, h, style=S_HEAD)
for i in range(N_EXP):
    r = exp_first + i; cr = "Categories!$A$%d" % (2 + N_INC + i); br = "Categories!$C$%d" % (2 + N_INC + i)
    mb.put(1, r, formula='IF(%s="","",%s)' % (cr, cr))
    mb.put(2, r, formula='IF($A%d="","",%s)' % (r, br), style=S_MONEY)
    mb.put(3, r, formula='IF($A%d="","",%s)' % (r, s_cat("$A%d" % r, MON)), style=S_MONEY)
    mb.put(4, r, formula='IF($A%d="","",B%d-C%d)' % (r, r, r), style=S_BMONEY)
    mb.put(5, r, formula='IF(OR($A%d="",B%d=0),"",C%d/B%d)' % (r, r, r, r), style=S_PCT)
    mb.put(6, r, formula='IF(OR($A%d="",B%d=0),"",REPT("█",MIN(20,ROUND(C%d/B%d*10,0))))' % (r, r, r, r), style=S_BAR_G)

yo = Sheet("Year Overview"); yo.cols = [(1, 12), (2, 13), (3, 13), (4, 13), (5, 12), (6, 13), (7, 24)]
yo.put(1, 1, formula='"Year overview "&%s&" ("&%s&")"' % (YR, CUR), style=S_TITLE)
for c, h in enumerate(["Month", "Income", "Spending", "Saved", "Savings rate", "vs budget", "Saved bar"], 1): yo.put(c, 3, h, style=S_HEAD)
EXP_BUDGET = "SUM(Categories!$C$%d:$C$%d)" % (2 + N_INC, 1 + N_INC + N_EXP)
for m in range(12):
    r = 4 + m
    yo.put(1, r, MONTHS[m], style=S_BOLD)
    yo.put(2, r, formula=s_type("Income", str(m + 1)), style=S_MONEY)
    yo.put(3, r, formula=s_type("Expense", str(m + 1)), style=S_MONEY)
    yo.put(4, r, formula="B%d-C%d" % (r, r), style=S_BMONEY)
    yo.put(5, r, formula='IF(B%d=0,"",D%d/B%d)' % (r, r, r), style=S_PCT)
    yo.put(6, r, formula='IF(C%d=0,"",%s-C%d)' % (r, EXP_BUDGET, r), style=S_MONEY)
    yo.put(7, r, formula='IF(MAX($D$4:$D$15)<=0,"",REPT("█",ROUND(MAX(0,D%d)/MAX($D$4:$D$15)*20,0)))' % r, style=S_BAR_G)
yo.put(1, 16, "Total", style=S_BOLD)
for c in (2, 3, 4): yo.put(c, 16, formula="SUM(%s4:%s15)" % (col(c), col(c)), style=S_BMONEY)
yo.put(5, 16, formula='IF(B16=0,"",D16/B16)', style=S_PCT)
yo.put(1, 18, "'vs budget' = total monthly budget minus actual spending (positive = under budget).", style=S_MUTED)
yo.put(1, 19, "Money moved to savings counts as spending in the Savings transfer category, so 'Saved' is what is left on top.", style=S_MUTED)

SHEETS = [start, mb, tx, cats, yo]

def mirror():
    inc_names = {n for n, _ in INCOME}
    ti = sum(a for m, d, c, _, a in SAMPLE if c in inc_names); te = sum(a for m, d, c, _, a in SAMPLE if c not in inc_names)
    bi = sum(b for _, b in INCOME); be = sum(b for _, b in EXPENSE)
    print("planned inc %.2f spend %.2f | actual inc %.2f spend %.2f left %.2f spent%% %.1f" % (bi, be, ti, te, ti - te, te / ti * 100))
    for n, b in EXPENSE:
        s = sum(a for m, d, c, _, a in SAMPLE if c == n); print("  %-18s budget %7.2f spent %7.2f left %7.2f used %5.1f%%" % (n, b, s, b - s, s / b * 100 if b else 0))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Monthly-Budget-Planner.xlsx", SHEETS, {"CategoryList": ALL_RANGE}, "Monthly Budget Planner")
    mirror()
