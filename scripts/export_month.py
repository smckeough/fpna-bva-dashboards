"""Export one month's dashboard-data JSON from an FP&A workbook.

Usage:
    python scripts/export_month.py "path/to/(NEW) June 2026 Department HC & Opex Template.xlsx"
    python scripts/export_month.py "path/to/workbook.xlsx" --refresh-config

Reads the workbook's `Dashboard JSON` sheet — cells A2 (+A3 if present) contain the
already-assembled dashboard-data.json (Excel splits it across cells because of the
32k-char cell limit).

With --refresh-config, ALSO overwrites sample-data/dashboard-config.json from the
workbook's `Dashboard Config` sheet. Off by default so hand edits to the layout
(section types, children maps, dashboards list) survive re-running the export.

Also scans each `BvA <Leader>` tab for the 'Software BvA Summary' section and
attaches that vendor list to the corresponding leader record as `software.vendors`.
This isn't in the workbook's Dashboard JSON output — the leader tabs are the only
source of the current-month vendor detail.

Writes:
    sample-data/dashboard-data-<YYYY-MM>.json          — that month's numbers
    sample-data/dashboard-data-index.json              — list of months + default
    sample-data/dashboard-config.json                  — latest layout

The month key (YYYY-MM) is derived from meta.reportMonth in the JSON so file
names match the numbers regardless of what the workbook file is named.

Requires openpyxl (`pip install --user openpyxl`).
"""
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl not installed. Run: pip install --user openpyxl")


REPO_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_DIR = REPO_ROOT / "sample-data"

MONTH_NAMES = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}


def month_key_from_report_month(report_month: str) -> str:
    """Turn 'June 2026' or '2026-06' etc. into '2026-06'."""
    rm = str(report_month).strip()
    m = re.match(r"^(\d{4})[-/](\d{1,2})", rm)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"
    m = re.match(r"^([A-Za-z]+)\s+(\d{4})$", rm)
    if m:
        month = MONTH_NAMES.get(m.group(1).lower())
        if month:
            return f"{m.group(2)}-{month:02d}"
    raise ValueError(f"Could not parse reportMonth: {report_month!r}")


def read_sheet_cell_concat(wb, sheet_name: str, col: int = 1) -> str:
    """Concatenate every non-empty cell in `col` after row 1 (row 1 is the
    'this is the JSON blob' comment). Excel splits long values across rows
    because of the 32,767 char per-cell limit."""
    if sheet_name not in wb.sheetnames:
        raise KeyError(f"Sheet {sheet_name!r} not found in workbook")
    ws = wb[sheet_name]
    parts = []
    for r in range(2, ws.max_row + 1):
        v = ws.cell(row=r, column=col).value
        if v is not None:
            parts.append(str(v))
    if not parts:
        raise ValueError(f"{sheet_name!r} col {col} row 2+ is empty")
    return "".join(parts)


# The Software BvA Summary section lives at slightly different rows in every
# leader's BvA tab. Scan the first ~250 rows for the label, then walk down until
# 'Total'. The header row contains 'Vendor' / 'Department' — use it to locate
# the Actual and Budget columns rather than hardcoding column indices.
def extract_software_vendors(ws) -> list[dict] | None:
    label_row = None
    for r in range(1, min(ws.max_row, 260) + 1):
        for c in range(1, min(ws.max_column, 12) + 1):
            v = ws.cell(row=r, column=c).value
            if isinstance(v, str) and v.strip() == "Software BvA Summary":
                label_row = r
                break
        if label_row:
            break
    if label_row is None:
        return None

    # Header row is usually 2 rows below the label (label -> year -> header).
    # The row contains 'Actual' and 'Budget' multiple times because the section
    # has MTD / QTD / YTD sub-sections side by side — first-wins so we lock onto
    # the leftmost (MTD) columns and don't accidentally read YTD.
    header_row = None
    col_map: dict[str, int] = {}
    for r in range(label_row, label_row + 6):
        row = [ws.cell(row=r, column=c).value for c in range(1, ws.max_column + 1)]
        if any(isinstance(v, str) and v.strip() == "Vendor" for v in row):
            header_row = r
            for i, v in enumerate(row, start=1):
                if isinstance(v, str):
                    key = v.strip()
                    if key and key not in col_map:
                        col_map[key] = i
            break
    if header_row is None:
        return None
    vendor_col = col_map.get("Vendor")
    dept_col = col_map.get("Department")
    actual_col = col_map.get("Actual")
    budget_col = col_map.get("Budget")
    lastmo_col = col_map.get("LastMo Actual")
    if not (vendor_col and actual_col and budget_col):
        return None

    vendors: list[dict] = []
    for r in range(header_row + 1, header_row + 100):
        name = ws.cell(row=r, column=vendor_col).value
        if name is None or (isinstance(name, str) and not name.strip()):
            # blank line — stop
            break
        name_s = str(name).strip()
        actual = ws.cell(row=r, column=actual_col).value
        budget = ws.cell(row=r, column=budget_col).value
        dept = ws.cell(row=r, column=dept_col).value if dept_col else None
        lastmo = ws.cell(row=r, column=lastmo_col).value if lastmo_col else None
        # Skip rows where both Actual and Budget are None (usually spacer rows).
        if actual is None and budget is None and name_s not in {"Total", "All Other"}:
            continue

        def num(v):
            return float(v) if isinstance(v, (int, float)) else None

        a = num(actual)
        b = num(budget)
        lm = num(lastmo)
        var_pct = ((a - b) / b) if (a is not None and b not in (None, 0)) else None
        mom_delta = (a - lm) if (a is not None and lm is not None) else None
        mom_pct = (mom_delta / lm) if (mom_delta is not None and lm not in (None, 0)) else None

        row = {
            "name": name_s,
            "department": str(dept).strip() if isinstance(dept, str) else None,
            "isTotal": name_s == "Total",
            "isOther": name_s == "All Other",
            "mtd": {"actual": a, "budget": b, "varPct": var_pct},
            "lastMonthActual": lm,
            "mom": {"delta": mom_delta, "pct": mom_pct},
        }
        vendors.append(row)
        if name_s == "Total":
            break

    return vendors or None


def load_workbook_unlocked(xlsx_path: Path):
    """openpyxl can't open files locked by Excel (e.g., open in OneDrive). If the
    direct open fails with PermissionError, copy to a temp file and retry."""
    try:
        return openpyxl.load_workbook(xlsx_path, data_only=True, read_only=True)
    except PermissionError:
        tmp = Path(tempfile.mkdtemp()) / xlsx_path.name
        shutil.copy2(xlsx_path, tmp)
        return openpyxl.load_workbook(tmp, data_only=True, read_only=True)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if len(args) != 1:
        sys.exit(
            "Usage: python scripts/export_month.py <path-to-workbook.xlsx> "
            "[--refresh-config]"
        )
    refresh_config = "--refresh-config" in flags
    src = Path(args[0]).expanduser().resolve()
    if not src.exists():
        sys.exit(f"File not found: {src}")

    wb = load_workbook_unlocked(src)

    data_raw = read_sheet_cell_concat(wb, "Dashboard JSON")
    data = json.loads(data_raw)

    if "meta" not in data or "reportMonth" not in data["meta"]:
        sys.exit("Dashboard JSON is missing meta.reportMonth")

    month_key = month_key_from_report_month(data["meta"]["reportMonth"])

    # Attach Software BvA Summary vendor rows to each leader. Each leader's tab
    # is named 'BvA <Name>' — same convention the workbook uses. Missing sheets
    # or missing sections are logged, not fatal.
    for leader in data.get("leaders", []):
        name = leader.get("name")
        # sourceTab exists in the JSON already (e.g. "BvA Armaan"); fall back to
        # the standard convention if not.
        sheet_name = leader.get("sourceTab") or f"BvA {name}"
        if sheet_name not in wb.sheetnames:
            print(f"  software: skipped {name} (no sheet {sheet_name!r})")
            continue
        vendors = extract_software_vendors(wb[sheet_name])
        if not vendors:
            print(f"  software: no 'Software BvA Summary' found in {sheet_name}")
            continue
        leader["software"] = {"vendors": vendors}
        # Count excludes the Total row for the log line
        real_vendors = [v for v in vendors if not v.get("isTotal")]
        print(f"  software: {name} — {len(real_vendors)} vendors + total")

    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    data_path = SAMPLE_DIR / f"dashboard-data-{month_key}.json"
    data_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"wrote {data_path.relative_to(REPO_ROOT)} "
          f"({len(data.get('departments', []))} depts, "
          f"{len(data.get('leaders', []))} leaders)")

    # Layout config: only refresh from the workbook on explicit request. Otherwise
    # leave the checked-in dashboard-config.json alone so hand-edited templates,
    # children maps, and dashboard lists survive a data re-export.
    if refresh_config:
        try:
            cfg_raw = read_sheet_cell_concat(wb, "Dashboard Config")
            cfg = json.loads(cfg_raw)
            cfg_path = SAMPLE_DIR / "dashboard-config.json"
            cfg_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
            print(f"wrote {cfg_path.relative_to(REPO_ROOT)} "
                  f"({len(cfg.get('dashboards', []))} dashboards)")
        except (KeyError, ValueError) as e:
            print(f"skipped config (workbook may not carry it): {e}")
    else:
        print("config: skipped (pass --refresh-config to overwrite from workbook)")

    # Rebuild the index from every dashboard-data-*.json on disk. Newest first.
    index_path = SAMPLE_DIR / "dashboard-data-index.json"
    months = []
    for p in sorted(SAMPLE_DIR.glob("dashboard-data-*.json"), reverse=True):
        if p.name == "dashboard-data-index.json":
            continue
        key = p.stem.removeprefix("dashboard-data-")
        try:
            payload = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        months.append({
            "key": key,
            "label": payload.get("meta", {}).get("reportMonth", key),
            "source": payload.get("meta", {}).get("source"),
        })

    index = {
        "months": months,
        "default": months[0]["key"] if months else None,
    }
    index_path.write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"wrote {index_path.relative_to(REPO_ROOT)} "
          f"(months: {', '.join(m['key'] for m in months)}; default {index['default']})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
