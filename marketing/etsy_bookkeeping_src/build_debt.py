#!/usr/bin/env python3
"""Build the Debt Payoff Planner .xlsx (stdlib only; reuses build_xlsx.py's writer).

Three month-by-month schedules share one engine: Snowball (smallest balance first),
Avalanche (highest APR first) and Minimums only (no extra, no roll-over).
Prints a python mirror of the sample results for the listing images.
Usage: python3 build_debt.py OUT.xlsx
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_xlsx
from build_xlsx import (Sheet, build, col, serial, S_DEF, S_HEAD, S_MONEY, S_PCT, S_TITLE,
                        S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_BOLD)
S_INPUT_MONEY, S_MONTH, S_INPUT_DATE = 13, 14, 15
build_xlsx.STYLES = (build_xlsx.STYLES
    .replace('<numFmts count="2">', '<numFmts count="3"><numFmt numFmtId="166" formatCode="mmm yyyy"/>')
    .replace('<cellXfs count="14">', '<cellXfs count="16">')
    .replace('</cellXfs>', '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
             '<xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/></cellXfs>'))

N, MONTHS_N, R0 = 8, 240, 11          # debt slots, schedule months (20 years), first schedule row
START = (2026, 10, 1); EXTRA = 300
DEBTS = [("Credit card", 4200, 24.99, 120), ("Store card", 850, 29.99, 35), ("Car loan", 9800, 7.5, 265),
         ("Student loan", 14500, 5.5, 160), ("Personal loan", 3100, 12.0, 110), ("Medical bill", 600, 0, 50)]
SET = "'Start Here'"; START_REF, CUR, EXTRA_REF = SET + "!$B$5", SET + "!$B$6", SET + "!$B$7"
D_LAST = 1 + N
def dr(c): return "Debts!$%s$2:$%s$%d" % (c, c, D_LAST)
BUDGET = "(SUM(%s)+%s)" % (dr("D"), EXTRA_REF)

start = Sheet("Start Here"); start.cols = [(1, 30), (2, 16), (3, 62)]
start.put(1, 1, "Debt Payoff Planner", style=S_TITLE)
start.put(1, 2, "Snowball vs avalanche: see your debt-free date and the interest you save. Excel, Google Sheets and Numbers.", style=S_MUTED)
start.put(1, 4, "Settings", style=S_HEAD); start.put(2, 4, "Your value", style=S_HEAD); start.put(3, 4, "Notes", style=S_HEAD)
for i, (k, v, s, n) in enumerate([("First payment month", serial(*START), S_INPUT_DATE, "Any date in the month of your first planned payment"),
                                  ("Currency", "USD", S_INPUT, "Label only. Any currency works"),
                                  ("Extra payment per month", EXTRA, S_INPUT_MONEY, "Paid on top of all minimums. 0 is fine")]):
    start.put(1, 5 + i, k, style=S_BOLD); start.put(2, 5 + i, v, style=s); start.put(3, 5 + i, n, style=S_MUTED)
for i, t in enumerate(["How to use it",
        "1. Debts tab: enter up to 8 debts (name, balance today, APR %, minimum monthly payment).",
        "2. Set the first payment month and your extra payment per month above (yellow cells).",
        "3. Payoff Plan tab: debt-free date, total interest and interest saved for each strategy,",
        "   plus the payoff date of every debt and your remaining balance year by year.",
        "4. Snowball / Avalanche / Minimums tabs: the month-by-month payment for every debt.",
        "",
        "Snowball pays the smallest balance first (quick wins). Avalanche pays the highest APR first",
        "(least interest). When a debt is paid off, its minimum rolls over to the next one.",
        "The sample debts show how it works. Replace them with your own.",
        "",
        "Google Sheets: upload this file to Google Drive, then open it with Google Sheets.",
        "Excel / Numbers: just open the file. Only edit the yellow cells.",
        "Estimates only: interest is calculated monthly (APR / 12). Not financial advice."]):
    start.put(1, 9 + i, t, style=S_HEAD if i == 0 else S_DEF)

debts = Sheet("Debts"); debts.cols = [(1, 26), (2, 14), (3, 10), (4, 16), (5, 14), (6, 14), (7, 14), (8, 14)]
for c, h in enumerate(["Debt", "Balance", "APR %", "Minimum payment", "Snowball key", "Snowball order", "Avalanche key", "Avalanche order"], 1):
    debts.put(c, 1, h, style=S_HEAD)
for i in range(N):
    r = 2 + i; name, bal, apr, mn = DEBTS[i] if i < len(DEBTS) else (None, None, None, None)
    debts.put(1, r, name, style=S_INPUT); debts.put(2, r, bal, style=S_INPUT_MONEY)
    debts.put(3, r, apr, style=S_INPUT); debts.put(4, r, mn, style=S_INPUT_MONEY)
    debts.put(5, r, formula='IF(A%d="",1E12+ROW(),B%d+ROW()/1E6)' % (r, r), style=S_MUTED)
    debts.put(6, r, formula='RANK(E%d,$E$2:$E$%d,1)' % (r, D_LAST), style=S_MUTED)
    debts.put(7, r, formula='IF(A%d="",1E12+ROW(),ROW()/1E6-C%d)' % (r, r), style=S_MUTED)
    debts.put(8, r, formula='RANK(G%d,$G$2:$G$%d,1)' % (r, D_LAST), style=S_MUTED)
debts.put(1, D_LAST + 1, "Total", style=S_BOLD)
debts.put(2, D_LAST + 1, formula="SUM(B2:B%d)" % D_LAST, style=S_BMONEY)
debts.put(4, D_LAST + 1, formula="SUM(D2:D%d)" % D_LAST, style=S_BMONEY)
debts.put(1, D_LAST + 3, "Enter APR as a number, e.g. 24.99 for 24.99%. Blank rows are ignored. Order columns are automatic.", style=S_MUTED)
debts.put(1, D_LAST + 4, "The minimum payment must be more than the monthly interest, or that balance will grow.", style=S_MUTED)

# schedule columns: A month, B date, C total paid, D balance left, payments E.., balances after them, pool, minimums helper
PAY0, END0 = 5, 5 + N; POOL = END0 + N; MIN0 = POOL + 1
def schedule(name, order_col, rollover):
    s = Sheet(name); s.freeze = (3, R0)
    s.cols = [(1, 8), (2, 11), (3, 12), (4, 13)] + [(PAY0 + k, 13) for k in range(2 * N)] + [(POOL, 11)] + [(MIN0 + k, 11) for k in range(N)]
    s.put(1, 1, name + " schedule", style=S_TITLE)
    s.put(1, 2, {"Snowball": "Smallest balance first. Freed-up minimums roll over to the next debt.",
                 "Avalanche": "Highest APR first. Freed-up minimums roll over to the next debt.",
                 "Minimums": "Only the minimum payment on each debt, no extra and no roll-over (for comparison)."}[name], style=S_MUTED)
    s.put(1, 4, "Monthly budget", style=S_BOLD)
    s.put(3, 4, formula=BUDGET if rollover else "SUM(%s)" % dr("D"), style=S_BMONEY)
    for lab, row in (("Payoff order", 3), ("Debt", 5), ("Monthly rate", 6), ("Minimum", 7), ("Start balance", 8), ("Paid off in month", 9)):
        s.put(4, row, lab, style=S_BOLD)
    for k in range(N):
        pc = PAY0 + k; P = col(pc)
        s.put(pc, 3, k + 1, style=S_BOLD)
        if order_col:
            s.put(pc, 4, formula="MATCH(%s3,%s,0)" % (P, dr(order_col)), style=S_MUTED)
        else:
            s.put(pc, 4, k + 1, style=S_MUTED)
        idx = "%s$4" % P
        s.put(pc, 5, formula='IF(INDEX(%s,%s)="","(empty)",INDEX(%s,%s))' % (dr("A"), idx, dr("A"), idx), style=S_BOLD)
        s.put(pc, 6, formula="INDEX(%s,%s)/1200" % (dr("C"), idx), style=S_PCT)
        s.put(pc, 7, formula="INDEX(%s,%s)*1" % (dr("D"), idx), style=S_MONEY)
        s.put(pc, 8, formula='IF(INDEX(%s,%s)="",0,INDEX(%s,%s)*1)' % (dr("A"), idx, dr("B"), idx), style=S_MONEY)
        E = col(END0 + k)
        s.put(pc, 9, formula='IF(%s$8=0,"",IF(COUNTIF(%s%d:%s%d,">0.005")>=%d,"20+ yrs",COUNTIF(%s%d:%s%d,">0.005")+1))'
              % (P, E, R0, E, R0 + MONTHS_N - 1, MONTHS_N, E, R0, E, R0 + MONTHS_N - 1), style=S_BOLD)
    heads = ["Month", "Date", "Total paid", "Balance left"] + ['="Pay: "&%s5' % col(PAY0 + k) for k in range(N)] + \
            ['="Left: "&%s5' % col(PAY0 + k) for k in range(N)] + ["Extra pool"] + ['="Min: "&%s5' % col(PAY0 + k) for k in range(N)]
    for c, h in enumerate(heads, 1):
        if h.startswith("="): s.put(c, R0 - 1, formula=h[1:], style=S_HEAD)
        else: s.put(c, R0 - 1, h, style=S_HEAD)
    for m in range(MONTHS_N):
        r = R0 + m
        s.put(1, r, m + 1)
        s.put(2, r, formula="EDATE(%s,A%d-1)" % (START_REF, r), style=S_MONTH)
        s.put(3, r, formula="SUM(%s%d:%s%d)" % (col(PAY0), r, col(PAY0 + N - 1), r), style=S_MONEY)
        s.put(4, r, formula="SUM(%s%d:%s%d)" % (col(END0), r, col(END0 + N - 1), r), style=S_BMONEY)
        s.put(POOL, r, formula="MAX(0,$C$4-SUM(%s%d:%s%d))" % (col(MIN0), r, col(MIN0 + N - 1), r), style=S_MONEY)
        for k in range(N):
            P, E, M = col(PAY0 + k), col(END0 + k), col(MIN0 + k)
            prev = "%s$8" % P if m == 0 else "%s%d" % (E, r - 1)
            I = "%s*(1+%s$6)" % (prev, P)
            s.put(MIN0 + k, r, formula="MAX(0,MIN(%s,%s$7))" % (I, P), style=S_MONEY)
            if rollover:
                used = "0" if k == 0 else "(SUM($%s%d:%s%d)-SUM($%s%d:%s%d))" % (col(PAY0), r, col(PAY0 + k - 1), r, col(MIN0), r, col(MIN0 + k - 1), r)
                s.put(PAY0 + k, r, formula="%s%d+MAX(0,MIN(%s-%s%d,%s%d-%s))" % (M, r, I, M, r, col(POOL), r, used), style=S_MONEY)
            else:
                s.put(PAY0 + k, r, formula="%s%d" % (M, r), style=S_MONEY)
            s.put(END0 + k, r, formula="MAX(0,ROUND(%s-%s%d,2))" % (I, P, r), style=S_MONEY)
    return s

snow, aval, mins = schedule("Snowball", "F", True), schedule("Avalanche", "H", True), schedule("Minimums", None, False)
LAST = R0 + MONTHS_N - 1

plan = Sheet("Payoff Plan"); plan.cols = [(1, 26), (2, 16), (3, 16), (4, 16), (5, 3), (6, 16), (7, 16), (8, 24)]
plan.put(1, 1, "Your debt payoff plan", style=S_TITLE)
plan.put(1, 2, formula='"All amounts in "&%s&". Change debts on the Debts tab, extra payment on Start Here."' % CUR, style=S_MUTED)
plan.put(1, 4, "Total debt", style=S_BOLD); plan.put(2, 4, formula="SUM(%s)" % dr("B"), style=S_BMONEY)
plan.put(1, 5, "Monthly budget (minimums + extra)", style=S_BOLD); plan.put(2, 5, formula=BUDGET, style=S_BMONEY)
for c, h in enumerate(["Strategy", "Snowball", "Avalanche", "Minimums only"], 1): plan.put(c, 7, h, style=S_HEAD)
def months_f(sh): return 'IF(COUNTIF(%s!$D$%d:$D$%d,">0.005")>=%d,"20+ yrs",COUNTIF(%s!$D$%d:$D$%d,">0.005")+1)' % (sh, R0, LAST, MONTHS_N, sh, R0, LAST)
for c, sh in ((2, "Snowball"), (3, "Avalanche"), (4, "Minimums")):
    L = col(c)
    plan.put(c, 8, formula=months_f(sh), style=S_BOLD)
    plan.put(c, 9, formula='IF(ISNUMBER(%s8),EDATE(%s,%s8-1),"not in 20 yrs")' % (L, START_REF, L), style=S_MONTH)
    plan.put(c, 10, formula="SUM(%s!$C$%d:$C$%d)-SUM(%s)+%s!$D$%d" % (sh, R0, LAST, dr("B"), sh, LAST), style=S_MONEY)
    plan.put(c, 11, formula="SUM(%s!$C$%d:$C$%d)" % (sh, R0, LAST), style=S_MONEY)
    if c < 4:
        plan.put(c, 12, formula="$D$10-%s10" % L, style=S_BMONEY)
        plan.put(c, 13, formula='IF(AND(ISNUMBER(%s8),ISNUMBER($D$8)),$D$8-%s8,"")' % (L, L), style=S_BOLD)
for r, lab in ((8, "Months to debt-free"), (9, "Debt-free date"), (10, "Total interest"), (11, "Total paid"),
               (12, "Interest saved vs minimums"), (13, "Months saved vs minimums")):
    plan.put(1, r, lab, style=S_BOLD)
plan.put(1, 14, "If Minimums only never finishes within 20 years, the savings lines stay blank or understate the real saving.", style=S_MUTED)

plan.put(1, 16, "Payoff date for each debt", style=S_BOLD)
for c, h in enumerate(["Debt", "Balance", "APR %", "Snowball #", "", "Snowball paid off", "Avalanche #", "Avalanche paid off"], 1):
    plan.put(c, 17, h, style=S_HEAD)
def payoff(sh, order):
    return 'IF(ISNUMBER(INDEX(%s!$E$9:$%s$9,%s)),EDATE(%s,INDEX(%s!$E$9:$%s$9,%s)-1),INDEX(%s!$E$9:$%s$9,%s))' % (
        sh, col(PAY0 + N - 1), order, START_REF, sh, col(PAY0 + N - 1), order, sh, col(PAY0 + N - 1), order)
for i in range(N):
    r = 18 + i; d = 2 + i
    plan.put(1, r, formula='IF(Debts!$A$%d="","",Debts!$A$%d)' % (d, d))
    plan.put(2, r, formula='IF($A%d="","",Debts!$B$%d)' % (r, d), style=S_MONEY)
    plan.put(3, r, formula='IF($A%d="","",Debts!$C$%d)' % (r, d))
    plan.put(4, r, formula='IF($A%d="","",Debts!$F$%d)' % (r, d))
    plan.put(6, r, formula='IF($A%d="","",%s)' % (r, payoff("Snowball", "Debts!$F$%d" % d)), style=S_MONTH)
    plan.put(7, r, formula='IF($A%d="","",Debts!$H$%d)' % (r, d))
    plan.put(8, r, formula='IF($A%d="","",%s)' % (r, payoff("Avalanche", "Debts!$H$%d" % d)), style=S_MONTH)

YR0 = 18 + N + 2
plan.put(1, YR0, "Balance left at the end of each year of the plan", style=S_BOLD)
for c, h in enumerate(["Plan year", "Snowball", "Avalanche", "Minimums only", "", "Snowball progress"], 1):
    plan.put(c, YR0 + 1, h, style=S_HEAD)
for y in range(1, 21):
    r = YR0 + 1 + y
    plan.put(1, r, "Year %d" % y, style=S_BOLD)
    for c, sh in ((2, "Snowball"), (3, "Avalanche"), (4, "Minimums")):
        plan.put(c, r, formula="%s!$D$%d" % (sh, R0 + 12 * y - 1), style=S_MONEY)
    plan.put(6, r, formula='IF($B$4<=0,"",REPT("█",ROUND(MAX(0,1-B%d/$B$4)*20,0)))' % r, style=S_BAR_G)
plan.put(1, YR0 + 22, "Progress bar = share of your starting debt paid off under the snowball plan.", style=S_MUTED)

SHEETS = [start, plan, debts, snow, aval, mins]

def simulate(order, rollover):
    bal = [float(b) for _, b, _, _ in DEBTS]; rate = [a / 1200 for _, _, a, _ in DEBTS]; mn = [m for *_, m in DEBTS]
    budget = sum(mn) + (EXTRA if rollover else 0); paid = 0.0; payoff = {}; month = 0
    while sum(bal) > 0.005 and month < MONTHS_N:
        month += 1
        I = {j: bal[j] * (1 + rate[j]) for j in order}; M = {j: max(0, min(I[j], mn[j])) for j in order}
        pool = max(0, budget - sum(M.values())); used = 0.0
        for j in order:
            pay = M[j] + (max(0, min(I[j] - M[j], pool - used)) if rollover else 0); used += pay - M[j]
            bal[j] = max(0, round(I[j] - pay, 2)); paid += pay
            if bal[j] <= 0.005 and j not in payoff: payoff[j] = month
    interest = paid - sum(b for _, b, _, _ in DEBTS) + sum(bal)
    return month, interest, paid, payoff

def mirror():
    n = range(len(DEBTS))
    snowball = sorted(n, key=lambda j: DEBTS[j][1]); avalanche = sorted(n, key=lambda j: -DEBTS[j][2])
    res = {}
    for label, order, roll in (("Snowball", snowball, True), ("Avalanche", avalanche, True), ("Minimums", list(n), False)):
        res[label] = simulate(order, roll); mo, it, pd, po = res[label]
        print("%-9s months %3d interest %9.2f paid %9.2f payoff %s" % (label, mo, it, pd, {DEBTS[j][0]: po.get(j) for j in n}))
    for label in ("Snowball", "Avalanche"):
        print("%s saves %.2f interest and %d months vs minimums" % (label, res["Minimums"][1] - res[label][1], res["Minimums"][0] - res[label][0]))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Debt-Payoff-Planner.xlsx", SHEETS, {"DebtNames": dr("A")}, "Debt Payoff Planner")
    mirror()
