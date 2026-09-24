"""Explicit-rule CSV preview; stdin -> JSON, no files modified, no network."""
import csv
import io
import json
import sys


def preview(text):
    rows = list(csv.reader(io.StringIO(text), strict=True))
    if not rows or rows[0] != ['record_id', 'label', 'status']:
        raise ValueError('Expected header: record_id,label,status')
    out, issues, seen = [], [], set()
    for n, row in enumerate(rows[1:], 2):
        if len(row) != 3:
            issues.append({'row': n, 'reason': 'column_count'}); continue
        key, label, status = row
        # Identifiers are opaque text; never convert or strip leading zeroes.
        if not key or key != key.strip():
            issues.append({'row': n, 'reason': 'invalid_id'}); continue
        if key in seen:
            issues.append({'row': n, 'reason': 'duplicate_id'}); continue
        seen.add(key)
        clean_label, clean_status = label.strip(), status.strip().lower()
        if clean_status not in {'open', 'closed'}:
            issues.append({'row': n, 'reason': 'unknown_status'}); continue
        if any(v.lstrip().startswith(('=', '+', '-', '@')) for v in row):
            issues.append({'row': n, 'reason': 'spreadsheet_formula_prefix'}); continue
        out.append({'record_id': key, 'label': clean_label, 'status': clean_status})
    return {'accepted': out, 'issues': issues, 'input_rows': len(rows)-1,
            'note': 'Preview only. Issues require review; nothing silently fixed or deleted.'}

if __name__ == '__main__':
    try:
        print(json.dumps(preview(sys.stdin.read()), ensure_ascii=False, indent=2))
    except (ValueError, csv.Error) as exc:
        print(json.dumps({'error': str(exc)}, ensure_ascii=False)); sys.exit(1)
