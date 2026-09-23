#!/usr/bin/env python3
"""Build the Freelance Time Tracker & Invoice .xlsx (stdlib only; reuses build_xlsx.py's writer).

Time log by client and project with per-client rates, unbilled vs billed totals, hours and earnings
by month, and a printable invoice that pulls the lines for one client + invoice number.
The invoice line list uses a helper column with SMALL (no array formulas, no wildcards).
Prints a python mirror of the sample figures for the listing images.
Usage: python3 build_freelance.py OUT.xlsx
"""
import sys, os, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_xlsx
from build_xlsx import (Sheet, build, col, serial, S_DEF, S_HEAD, S_DATE, S_MONEY, S_PCT, S_TITLE,
                        S_BMONEY, S_INPUT, S_MUTED, S_BAR_G, S_BAR_R, S_INPUT_PCT, S_BOLD)
S_INPUT_MONEY, S_INPUT_DATE = 13, 14
build_xlsx.STYLES = build_xlsx.STYLES.replace('<cellXfs count="14">', '<cellXfs count="15">').replace(
    '</cellXfs>', '<xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/></cellXfs>')
N_CLI, N_LOG, N_INV = 30, 1000, 25
YEAR = 2026; RATE = 60; TAX = 0.0; TERMS = 14
# (client, hourly rate or None = default, contact)
CLIENTS = [("Northwind Studio", 75, "accounts@northwind.example"), ("Bright Bakery", None, "hello@brightbakery.example"),
           ("Kestrel Labs", 90, "ap@kestrel.example")]
# (y, m, d, client, project, task, hours, billable, invoice #)
LOG = [(2026, 7, 6, "Northwind Studio", "Website refresh", "Discovery call and notes", 1.5, "Yes", "INV-001"),
       (2026, 7, 8, "Northwind Studio", "Website refresh", "Wireframes", 4, "Yes", "INV-001"),
       (2026, 7, 14, "Bright Bakery", "Menu design", "Menu layout v1", 3, "Yes", "INV-002"),
       (2026, 7, 21, "Northwind Studio", "Website refresh", "Homepage design", 6, "Yes", "INV-001"),
       (2026, 7, 29, "Kestrel Labs", "Pitch deck", "Deck outline", 2.5, "Yes", "INV-003"),
       (2026, 8, 4, "Kestrel Labs", "Pitch deck", "Slide design", 7, "Yes", "INV-003"),
       (2026, 8, 11, "Bright Bakery", "Menu design", "Revisions", 1.5, "Yes", "INV-002"),
       (2026, 8, 12, "Bright Bakery", "Menu design", "Quick call (not billed)", 0.5, "No", None),
       (2026, 8, 19, "Northwind Studio", "Website refresh", "Inner pages", 8, "Yes", "INV-004"),
       (2026, 8, 27, "Northwind Studio", "Website refresh", "Handover", 2, "Yes", "INV-004"),
       (2026, 9, 2, "Kestrel Labs", "Brand refresh", "Logo concepts", 5, "Yes", None),
       (2026, 9, 9, "Bright Bakery", "Social posts", "September posts", 3.5, "Yes", None),
       (2026, 9, 15, "Kestrel Labs", "Brand refresh", "Logo revisions", 3, "Yes", None),
       (2026, 9, 18, "Northwind Studio", "Maintenance", "Plugin updates", 1, "Yes", None)]

SET = "'Start Here'"; BIZ, CUR, DRATE, TAXR, TERMSR, YR = (SET + "!$B$%d" % r for r in (5, 6, 7, 8, 9, 10))
start = Sheet("Start Here"); start.cols = [(1, 26), (2, 30), (3, 60)]
start.put(1, 1, "Freelance Time Tracker & Invoice", style=S_TITLE)
start.put(1, 2, "Log hours by client, see what's unbilled, print invoices. Excel, Google Sheets and Numbers.", style=S_MUTED)
start.put(1, 4, "Settings", style=S_HEAD); start.put(2, 4, "Your value", style=S_HEAD); start.put(3, 4, "Notes", style=S_HEAD)
for i, (k, v, s, n) in enumerate([("Your name / business", "Your Name Design", S_INPUT, "Shown on the Dashboard and invoices"),
                                  ("Currency", "USD", S_INPUT, "Label only. Any currency works"),
                                  ("Default hourly rate", RATE, S_INPUT_MONEY, "Used when a client has no rate of its own"),
                                  ("Tax / VAT rate", TAX, S_INPUT_PCT, "Added to invoices. Leave at 0% if you don't charge it"),
                                  ("Payment terms (days)", TERMS, S_INPUT, "Invoice due date = invoice date + this"),
                                  ("Year", YEAR, S_INPUT, "Year shown on the Dashboard month table")]):
    start.put(1, 5 + i, k, style=S_BOLD); start.put(2, 5 + i, v, style=s); start.put(3, 5 + i, n, style=S_MUTED)
for i, t in enumerate(["How to use it",
        "1. Fill in the yellow cells above.",
        "2. Clients tab: add each client, with their own hourly rate if it differs from your default.",
        "3. Time Log tab: one row per piece of work. Date, client (dropdown), project, task, hours, billable Yes/No.",
        "4. When you bill, type the invoice number (e.g. INV-005) in the Invoice # column of those rows.",
        "5. Invoice tab: pick the client and type the invoice number. The lines, subtotal, tax, total and due date fill in.",
        "6. Dashboard: unbilled work, billed totals, hours and earnings by client and by month.",
        "7. The sample rows show how it works. Delete them when you start.",
        "",
        "Google Sheets: upload this file to Google Drive, then open it with Google Sheets.",
        "Excel / Numbers: just open the file. Only edit the yellow cells, Clients, Time Log and the Invoice header."]):
    start.put(1, 12 + i, t, style=S_HEAD if i == 0 else S_DEF)

C_LAST = 1 + N_CLI; L_LAST = 1 + N_LOG
def lg(c): return "'Time Log'!$%s$2:$%s$%d" % (c, c, L_LAST)
cli = Sheet("Clients"); cli.freeze = (1, 2); cli.cols = [(1, 26), (2, 13), (3, 13), (4, 32), (5, 11), (6, 13), (7, 13), (8, 13)]
for c, h in enumerate(["Client", "Own rate", "Rate used", "Contact / billing email", "Hours", "Billed", "Unbilled", "Effective rate"], 1):
    cli.put(c, 1, h, style=S_HEAD)
for i in range(N_CLI):
    r = 2 + i
    if i < len(CLIENTS):
        n, rt, em = CLIENTS[i]; cli.put(1, r, n, style=S_INPUT); cli.put(2, r, rt, style=S_INPUT_MONEY); cli.put(4, r, em)
    else:
        cli.put(1, r, style=S_INPUT); cli.put(2, r, style=S_INPUT_MONEY)
    cli.put(3, r, formula='IF(A%d="","",IF(B%d="",%s,B%d))' % (r, r, DRATE, r), style=S_MONEY)
    cli.put(5, r, formula='IF(A%d="","",SUMIFS(%s,%s,$A%d))' % (r, lg("E"), lg("B"), r), style=S_BOLD)
    cli.put(6, r, formula='IF(A%d="","",SUMIFS(%s,%s,$A%d,%s,"Billed"))' % (r, lg("H"), lg("B"), r, lg("J")), style=S_MONEY)
    cli.put(7, r, formula='IF(A%d="","",SUMIFS(%s,%s,$A%d,%s,"Unbilled"))' % (r, lg("H"), lg("B"), r, lg("J")), style=S_MONEY)
    cli.put(8, r, formula='IF(OR(A%d="",E%d=0),"",(F%d+G%d)/E%d)' % (r, r, r, r, r), style=S_MONEY)
cli.put(1, C_LAST + 2, "Leave 'Own rate' blank to use your default rate. Effective rate = billable value / all hours logged (including non-billable).", style=S_MUTED)

INV = "Invoice"; ICLI, INO, IDATE = "Invoice!$B$5", "Invoice!$B$6", "Invoice!$B$7"
log = Sheet("Time Log"); log.freeze = (1, 2)
log.cols = [(1, 12), (2, 22), (3, 20), (4, 30), (5, 8), (6, 10), (7, 11), (8, 12), (9, 11), (10, 11), (11, 8), (12, 8), (13, 10)]
for c, h in enumerate(["Date", "Client", "Project", "Task", "Hours", "Billable", "Rate", "Amount", "Invoice #", "Status",
                       "Month", "Year", "Inv. line"], 1):
    log.put(c, 1, h, style=S_HEAD)
for i in range(N_LOG):
    r = 2 + i
    if i < len(LOG):
        y, m, d, cl, pr, tk, h, b, inv = LOG[i]
        log.put(1, r, serial(y, m, d), style=S_DATE); log.put(2, r, cl); log.put(3, r, pr); log.put(4, r, tk); log.put(5, r, h)
        log.put(6, r, b); log.put(9, r, inv)
    else:
        log.put(1, r, style=S_DATE)
    log.put(7, r, formula='IF(B%d="","",IFERROR(INDEX(Clients!$C$2:$C$%d,MATCH(B%d,Clients!$A$2:$A$%d,0)),%s))' % (r, C_LAST, r, C_LAST, DRATE), style=S_MONEY)
    log.put(8, r, formula='IF(OR(B%d="",F%d<>"Yes"),0,E%d*G%d)' % (r, r, r, r), style=S_MONEY)
    log.put(10, r, formula='IF(B%d="","",IF(F%d<>"Yes","Non-billable",IF(I%d="","Unbilled","Billed")))' % (r, r, r), style=S_BOLD)
    log.put(11, r, formula='IF(A%d="","",MONTH(A%d))' % (r, r), style=S_MUTED)
    log.put(12, r, formula='IF(A%d="","",YEAR(A%d))' % (r, r), style=S_MUTED)
    log.put(13, r, formula='IF(AND(B%d<>"",I%d<>"",B%d=%s,I%d=%s,F%d="Yes"),ROW(),"")' % (r, r, r, ICLI, r, INO, r), style=S_MUTED)
log.dv += [("B2:B%d" % L_LAST, "ClientList"), ("F2:F%d" % L_LAST, '"Yes,No"')]
log.put(1, L_LAST + 2, "Rate comes from the Clients tab. Status is Unbilled until you type an invoice number. Month, Year and Inv. line are helpers; leave them.", style=S_MUTED)

iv = Sheet("Invoice"); iv.cols = [(1, 14), (2, 30), (3, 36), (4, 10), (5, 12), (6, 14)]
iv.put(1, 1, "INVOICE", style=S_TITLE)
iv.put(1, 2, formula=BIZ, style=S_BOLD)
iv.put(1, 3, "Pick the client and type the invoice number in the yellow cells. Lines come from the Time Log rows with that client and invoice #.", style=S_MUTED)
iv.put(1, 5, "Bill to", style=S_BOLD); iv.put(2, 5, CLIENTS[0][0], style=S_INPUT)
iv.put(1, 6, "Invoice #", style=S_BOLD); iv.put(2, 6, "INV-004", style=S_INPUT)
iv.put(1, 7, "Invoice date", style=S_BOLD); iv.put(2, 7, serial(2026, 8, 31), style=S_INPUT_DATE)
iv.put(1, 8, "Due date", style=S_BOLD); iv.put(2, 8, formula="B7+%s" % TERMSR, style=S_DATE)
iv.put(1, 9, "Contact", style=S_BOLD); iv.put(2, 9, formula='IFERROR(INDEX(Clients!$D$2:$D$%d,MATCH(B5,Clients!$A$2:$A$%d,0)),"")' % (C_LAST, C_LAST))
iv.dv.append(("B5", "ClientList"))
for c, h in enumerate(["Date", "Project", "Task", "Hours", "Rate", "Amount"], 1): iv.put(c, 11, h, style=S_HEAD)
for k in range(N_INV):
    r = 12 + k; idx = "SMALL(%s,%d)-1" % (lg("M"), k + 1)
    for c, src, st in [(1, "A", S_DATE), (2, "C", S_DEF), (3, "D", S_DEF), (4, "E", S_DEF), (5, "G", S_MONEY), (6, "H", S_MONEY)]:
        iv.put(c, r, formula='IFERROR(INDEX(%s,%s),"")' % (lg(src), idx), style=st)
T = 12 + N_INV
iv.put(5, T + 1, "Subtotal", style=S_BOLD); iv.put(6, T + 1, formula="SUM(F12:F%d)" % (T - 1), style=S_BMONEY)
iv.put(4, T + 2, formula=TAXR, style=S_PCT); iv.put(5, T + 2, "Tax", style=S_BOLD); iv.put(6, T + 2, formula="ROUND(F%d*%s,2)" % (T + 1, TAXR), style=S_MONEY)
iv.put(5, T + 3, formula='"Total "&%s' % CUR, style=S_BOLD); iv.put(6, T + 3, formula="F%d+F%d" % (T + 1, T + 2), style=S_BMONEY)
iv.put(4, T + 1, formula="SUM(D12:D%d)" % (T - 1), style=S_BOLD); iv.put(3, T + 1, "Total hours", style=S_BOLD)
iv.put(1, T + 5, "Payment details: add your bank / PayPal details here.", style=S_MUTED)
iv.put(1, T + 6, "To save as PDF: File > Print (or Download > PDF in Google Sheets) with this tab selected.", style=S_MUTED)

db = Sheet("Dashboard"); db.cols = [(1, 26), (2, 14), (3, 14), (4, 3), (5, 24), (6, 11), (7, 13), (8, 13)]
db.put(1, 1, formula='%s&" freelance dashboard"' % BIZ, style=S_TITLE)
db.put(1, 2, formula='"All amounts in "&%s&". Month table shows "&%s&"."' % (CUR, YR), style=S_MUTED)
db.put(1, 4, "Totals (all time)", style=S_HEAD); db.put(2, 4, "", style=S_HEAD)
TOT = [("Hours logged", "SUM(%s)" % lg("E"), S_BOLD),
       ("Billable hours", 'SUMIFS(%s,%s,"Yes")' % (lg("E"), lg("F")), S_BOLD),
       ("Billable share", 'IF(B5=0,"",B6/B5)', S_PCT),
       ("Billed (invoiced)", 'SUMIFS(%s,%s,"Billed")' % (lg("H"), lg("J")), S_BMONEY),
       ("Unbilled work", 'SUMIFS(%s,%s,"Unbilled")' % (lg("H"), lg("J")), S_BMONEY),
       ("Unbilled hours", 'SUMIFS(%s,%s,"Unbilled")' % (lg("E"), lg("J")), S_BOLD),
       ("Effective hourly rate", 'IF(B5=0,"",(B8+B9)/B5)', S_BMONEY)]
for i, (k, f, s) in enumerate(TOT):
    db.put(1, 5 + i, k, style=S_BOLD); db.put(2, 5 + i, formula=f, style=s)
db.put(1, 13, "Month", style=S_HEAD); db.put(2, 13, "Hours", style=S_HEAD); db.put(3, 13, "Billable value", style=S_HEAD)
for m in range(12):
    r = 14 + m
    db.put(1, r, datetime.date(2000, m + 1, 1).strftime("%B"), style=S_BOLD)
    db.put(2, r, formula="SUMIFS(%s,%s,%d,%s,%s)" % (lg("E"), lg("K"), m + 1, lg("L"), YR))
    db.put(3, r, formula="SUMIFS(%s,%s,%d,%s,%s)" % (lg("H"), lg("K"), m + 1, lg("L"), YR), style=S_MONEY)
db.put(1, 26, "Year total", style=S_BOLD); db.put(2, 26, formula="SUM(B14:B25)", style=S_BOLD); db.put(3, 26, formula="SUM(C14:C25)", style=S_BMONEY)
db.put(5, 4, "By client", style=S_HEAD)
for c, h in enumerate(["Hours", "Billed", "Unbilled"], 6): db.put(c, 4, h, style=S_HEAD)
for k in range(12):
    r = 5 + k; s = 2 + k
    db.put(5, r, formula='IF(Clients!A%d="","",Clients!A%d)' % (s, s))
    db.put(6, r, formula='IF(Clients!A%d="","",Clients!E%d)' % (s, s))
    db.put(7, r, formula='IF(Clients!A%d="","",Clients!F%d)' % (s, s), style=S_MONEY)
    db.put(8, r, formula='IF(Clients!A%d="","",Clients!G%d)' % (s, s), style=S_BAR_R)
db.put(5, 18, "First 12 clients. The Clients tab has totals for all of them.", style=S_MUTED)

SHEETS = [start, db, log, cli, iv]

def mirror():
    rate = {n: (rt or RATE) for n, rt, em in CLIENTS}
    rows = [(x, (x[6] * rate[x[3]]) if x[7] == "Yes" else 0) for x in LOG]
    hrs = sum(x[6] for x in LOG); bh = sum(x[6] for x in LOG if x[7] == "Yes")
    billed = sum(a for x, a in rows if x[7] == "Yes" and x[8]); unb = sum(a for x, a in rows if x[7] == "Yes" and not x[8])
    print("hours %.1f billable %.1f share %.1f%% billed %.2f unbilled %.2f unbilled_h %.1f eff %.2f" % (
        hrs, bh, bh / hrs * 100, billed, unb, sum(x[6] for x in LOG if x[7] == "Yes" and not x[8]), (billed + unb) / hrs))
    for n, rt, em in CLIENTS:
        print("  %-18s rate %6.2f hours %5.1f billed %8.2f unbilled %8.2f" % (n, rate[n], sum(x[6] for x in LOG if x[3] == n),
              sum(a for x, a in rows if x[3] == n and x[8]), sum(a for x, a in rows if x[3] == n and x[7] == "Yes" and not x[8])))
    for m in (7, 8, 9): print("  month %d hours %.1f value %.2f" % (m, sum(x[6] for x in LOG if x[1] == m), sum(a for x, a in rows if x[1] == m)))
    lines = [(x, a) for x, a in rows if x[3] == CLIENTS[0][0] and x[8] == "INV-004"]
    for x, a in lines: print("  INV-004 %d-%02d-%02d %s %.1f %.2f" % (x[0], x[1], x[2], x[5], x[6], a))
    print("  INV-004 hours %.1f subtotal %.2f" % (sum(x[6] for x, a in lines), sum(a for x, a in lines)))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Freelance-Time-Tracker-Invoice.xlsx", SHEETS,
          {"ClientList": "Clients!$A$2:$A$%d" % C_LAST}, "Freelance Time Tracker & Invoice")
    mirror()
