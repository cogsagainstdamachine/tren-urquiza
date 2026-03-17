#!/usr/bin/env python3
"""
update_schedule.py
------------------
Reads departure times from tren-urquiza-horarios.xlsx and updates
the schedule data arrays in index.html.

Usage:
    python update_schedule.py
    python update_schedule.py --xlsx path/to/horarios.xlsx --html path/to/index.html

The script reads the origin station row from each of the 8 sheets,
extracts departure times, and replaces the DL / DLC / TM_LM / TM_LC
blocks in index.html.

Sheet → variable mapping:
    LM_Semana   → DL.weekday   (Lemos → Lacroze, weekday)
    LM_Sabado   → DL.saturday
    LM_Domingo  → DL.sunday
    LM_Feriado  → DL.holiday
    LC_Semana   → DLC.weekday  (Lacroze → Lemos, weekday)
    LC_Sabado   → DLC.saturday
    LC_Domingo  → DLC.sunday
    LC_Feriado  → DLC.holiday

Travel times (TM_LM, TM_LC) are stored as comments in index.html
and are NOT read from the spreadsheet — update them manually if the
schedule changes travel times between stations.
"""

import re
import sys
import argparse
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl is required. Install with: pip install openpyxl")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

# Row number of the origin station in each sheet (1-indexed)
ORIGIN_ROWS = {
    'LM_Semana':  5,   # General Lemos = station index 0, Excel row 5
    'LM_Sabado':  5,
    'LM_Domingo': 5,
    'LM_Feriado': 5,
    'LC_Semana':  5,  # Federico Lacroze = station index 22, Excel row 27
    'LC_Sabado':  5,
    'LC_Domingo': 5,
    'LC_Feriado': 5,
}

# Maps sheet name → JS variable key path
SHEET_TO_JS = {
    'LM_Semana':  ('DL',  'weekday'),
    'LM_Sabado':  ('DL',  'saturday'),
    'LM_Domingo': ('DL',  'sunday'),
    'LM_Feriado': ('DL',  'holiday'),
    'LC_Semana':  ('DLC', 'weekday'),
    'LC_Sabado':  ('DLC', 'saturday'),
    'LC_Domingo': ('DLC', 'sunday'),
    'LC_Feriado': ('DLC', 'holiday'),
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def read_departures(xlsx_path):
    """Read all departure time arrays from the xlsx origin rows."""
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    result = {}

    for sheet_name, origin_row in ORIGIN_ROWS.items():
        if sheet_name not in wb.sheetnames:
            print(f"WARNING: Sheet '{sheet_name}' not found in xlsx, skipping.")
            continue
        ws = wb[sheet_name]
        times = []
        col = 2  # departures start at column B
        while True:
            val = ws.cell(row=origin_row, column=col).value
            if val is None:
                break
            # Normalise to HH:MM string
            val = str(val).strip()
            if re.match(r'^\d{1,2}:\d{2}$', val):
                h, m = val.split(':')
                times.append(f"{int(h):02d}:{int(m):02d}")
            col += 1

        if not times:
            print(f"WARNING: No times found in sheet '{sheet_name}' row {origin_row}")
        else:
            result[sheet_name] = times
            print(f"  {sheet_name}: {len(times)} departures  "
                  f"({times[0]} → {times[-1]})")

    return result


def format_js_array(times, indent=4):
    """Format a list of time strings as a compact JS array literal."""
    lines = []
    chunk = []
    for t in times:
        chunk.append(f'"{t}"')
        if len(chunk) == 8:
            lines.append(' ' * indent + ','.join(chunk))
            chunk = []
    if chunk:
        lines.append(' ' * indent + ','.join(chunk))
    return '[\n' + ',\n'.join(lines) + '\n  ]'


def build_js_block(departures_by_sheet):
    """Build the full DL and DLC JS object strings."""

    def build_obj(var_name, days):
        parts = []
        for day in ['weekday', 'saturday', 'sunday', 'holiday']:
            key = next(
                (s for s, (v, d) in SHEET_TO_JS.items() if v == var_name and d == day),
                None
            )
            times = departures_by_sheet.get(key, [])
            parts.append(f'  {day}:{format_js_array(times)}')
        return f'const {var_name} = {{\n' + ',\n'.join(parts) + '\n};'

    dl_block  = build_obj('DL',  departures_by_sheet)
    dlc_block = '// Departures from Federico Lacroze (\u2192 Lemos)\n' + \
                build_obj('DLC', departures_by_sheet)
    return dl_block, dlc_block


def update_html(html_path, dl_block, dlc_block):
    """Replace DL and DLC blocks in index.html."""
    html = html_path.read_text(encoding='utf-8')

    # Match existing DL block
    dl_pattern = re.compile(
        r'const DL = \{.*?\};',
        re.DOTALL
    )
    dlc_pattern = re.compile(
        r'// Departures from Federico Lacroze.*?const DLC = \{.*?\};',
        re.DOTALL
    )

    if not dl_pattern.search(html):
        print("ERROR: Could not find 'const DL = {...}' in index.html")
        sys.exit(1)
    if not dlc_pattern.search(html):
        print("ERROR: Could not find 'const DLC = {...}' in index.html")
        sys.exit(1)

    html = dl_pattern.sub(dl_block, html, count=1)
    html = dlc_pattern.sub(dlc_block, html, count=1)

    html_path.write_text(html, encoding='utf-8')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Sync schedule from xlsx to index.html')
    parser.add_argument('--xlsx', default='tren-urquiza-horarios.xlsx',
                        help='Path to the Excel timetable file')
    parser.add_argument('--html', default='index.html',
                        help='Path to index.html')
    parser.add_argument('--dry-run', action='store_true',
                        help='Print changes without writing to index.html')
    args = parser.parse_args()

    xlsx_path = Path(args.xlsx)
    html_path = Path(args.html)

    if not xlsx_path.exists():
        print(f"ERROR: Excel file not found: {xlsx_path}")
        sys.exit(1)
    if not html_path.exists():
        print(f"ERROR: HTML file not found: {html_path}")
        sys.exit(1)

    print(f"\nReading departure times from: {xlsx_path}")
    departures = read_departures(xlsx_path)

    dl_block, dlc_block = build_js_block(departures)

    if args.dry_run:
        print("\n── DL block ──────────────────────────────────────────")
        print(dl_block[:500] + "...")
        print("\n── DLC block ─────────────────────────────────────────")
        print(dlc_block[:500] + "...")
        print("\n[Dry run — index.html not modified]")
        return

    print(f"\nUpdating: {html_path}")
    update_html(html_path, dl_block, dlc_block)
    print("✓ Done — index.html updated successfully.")
    print("\nNext steps:")
    print("  git add index.html tren-urquiza-horarios.xlsx")
    print("  git commit -m 'Update schedule'")
    print("  git push")


if __name__ == '__main__':
    main()
