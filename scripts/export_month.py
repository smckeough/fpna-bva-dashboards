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
# leader's BvA tab. Layout (constant across leaders, verified against workbook):
#   label row:            'Software BvA Summary' text
#   label+1 (period row): 'Current Month <Mon>-<YY> v Budget', 'QTD ...', 'YTD ...'
#   label+2 (header row): Vendor | Department | Actual | Budget | ... (repeats for each period)
#
# The period row lets us disambiguate the three 'Actual'/'Budget' pairs that
# would otherwise collide in a naive column-name lookup.


def _num(v):
    return float(v) if isinstance(v, (int, float)) else None


def _snapshot_rows(ws, up_to_row: int = 260) -> list[list]:
    """Materialize a rectangle of the sheet into memory once. openpyxl's
    read_only mode makes iter_rows fast (streaming) but ws.cell(r,c) slow —
    each call restarts iteration from the top. Cache once, then random-access."""
    rows: list[list] = []
    for row in ws.iter_rows(min_row=1, max_row=up_to_row, values_only=True):
        rows.append(list(row))
    return rows


def _find_first_label_row(snap: list[list], label: str, max_col: int = 12) -> int | None:
    """1-based row index of the first row whose col-1..max_col contain `label`."""
    for r, row in enumerate(snap, start=1):
        for v in row[:max_col]:
            if isinstance(v, str) and v.strip() == label:
                return r
    return None


def _period_columns(snap: list[list], label_row: int) -> dict[str, int]:
    """Locate 1-based start column of each period block. Row(s) below the
    'Software BvA Summary' label carry period headers like 'Current Month
    <Mon>-<YY> v Budget', 'QTD ...', 'YTD ...'. Each block's Actual sits at the
    period column and Budget one column over."""
    ranges: dict[str, int] = {}
    for r in range(label_row, min(label_row + 4, len(snap) + 1)):
        row = snap[r - 1]
        for c_idx, v in enumerate(row, start=1):
            if not isinstance(v, str):
                continue
            s = v.strip().lower()
            if "current month" in s and "mtd" not in ranges:
                ranges["mtd"] = c_idx
            elif s.startswith("qtd") and "qtd" not in ranges:
                ranges["qtd"] = c_idx
            elif s.startswith("ytd") and "ytd" not in ranges:
                ranges["ytd"] = c_idx
        if ranges:
            break
    return ranges


def _cell(snap: list[list], r: int, c: int):
    """1-based access into the row cache. Returns None past end of row/sheet."""
    if r < 1 or r > len(snap):
        return None
    row = snap[r - 1]
    if c < 1 or c > len(row):
        return None
    return row[c - 1]


def _window_from_cols(snap, r: int, actual_col: int, budget_col: int) -> dict:
    a = _num(_cell(snap, r, actual_col))
    b = _num(_cell(snap, r, budget_col))
    var_pct = ((a - b) / b) if (a is not None and b not in (None, 0)) else None
    return {"actual": a, "budget": b, "varPct": var_pct}


def _extract_monthly_series(snap: list[list], label: str) -> dict[str, list[dict]]:
    """Read a 12-month table ('Monthly Actuals Software Summary' or
    'Monthly Budget Software Summary'). Returns {vendor_name: [{month, value}]}.
    Month strings are YYYY-MM."""
    label_row = _find_first_label_row(snap, label)
    if label_row is None:
        return {}
    header_row = None
    vendor_col = None
    date_cols: list[tuple[int, str]] = []
    for r in range(label_row, min(label_row + 6, len(snap) + 1)):
        row = snap[r - 1]
        if not any(isinstance(v, str) and v.strip() == "Vendor" for v in row):
            continue
        header_row = r
        for c_idx, v in enumerate(row, start=1):
            if isinstance(v, str) and v.strip() == "Vendor":
                vendor_col = c_idx
            if hasattr(v, "year"):
                date_cols.append((c_idx, f"{v.year:04d}-{v.month:02d}"))
        break
    if header_row is None or vendor_col is None or not date_cols:
        return {}

    out: dict[str, list[dict]] = {}
    for r in range(header_row + 1, min(header_row + 100, len(snap) + 1)):
        name = _cell(snap, r, vendor_col)
        if name is None or (isinstance(name, str) and not name.strip()):
            break
        name_s = str(name).strip()
        out[name_s] = [
            {"month": m, "value": _num(_cell(snap, r, c))} for c, m in date_cols
        ]
        if name_s == "Total":
            break
    return out


def extract_software_vendors(ws) -> list[dict] | None:
    # Snapshot the top of the sheet in one pass. Every subsequent lookup is a
    # cheap Python list indexing operation.
    snap = _snapshot_rows(ws, up_to_row=260)

    label_row = _find_first_label_row(snap, "Software BvA Summary")
    if label_row is None:
        return None

    periods = _period_columns(snap, label_row)
    if "mtd" not in periods:
        return None

    header_row = None
    vendor_col = dept_col = lastmo_col = None
    for r in range(label_row, min(label_row + 6, len(snap) + 1)):
        row = snap[r - 1]
        if not any(isinstance(v, str) and v.strip() == "Vendor" for v in row):
            continue
        header_row = r
        for c_idx, v in enumerate(row, start=1):
            if not isinstance(v, str):
                continue
            key = v.strip()
            if key == "Vendor" and vendor_col is None:
                vendor_col = c_idx
            elif key == "Department" and dept_col is None:
                dept_col = c_idx
            elif key == "LastMo Actual" and lastmo_col is None:
                lastmo_col = c_idx
        break
    if header_row is None or vendor_col is None:
        return None

    monthly_actual = _extract_monthly_series(snap, "Monthly Actuals Software Summary")
    monthly_budget = _extract_monthly_series(snap, "Monthly Budget Software Summary")

    vendors: list[dict] = []
    for r in range(header_row + 1, min(header_row + 100, len(snap) + 1)):
        name = _cell(snap, r, vendor_col)
        if name is None or (isinstance(name, str) and not name.strip()):
            break
        name_s = str(name).strip()

        mtd = _window_from_cols(snap, r, periods["mtd"], periods["mtd"] + 1)
        qtd = _window_from_cols(snap, r, periods["qtd"], periods["qtd"] + 1) if "qtd" in periods else None
        ytd = _window_from_cols(snap, r, periods["ytd"], periods["ytd"] + 1) if "ytd" in periods else None

        if (
            mtd["actual"] is None
            and mtd["budget"] is None
            and name_s not in {"Total", "All Other"}
        ):
            continue

        lm = _num(_cell(snap, r, lastmo_col)) if lastmo_col else None
        mom_delta = (mtd["actual"] - lm) if (mtd["actual"] is not None and lm is not None) else None
        mom_pct = (mom_delta / lm) if (mom_delta is not None and lm not in (None, 0)) else None

        dept = _cell(snap, r, dept_col) if dept_col else None
        row_out = {
            "name": name_s,
            "department": str(dept).strip() if isinstance(dept, str) else None,
            "isTotal": name_s == "Total",
            "isOther": name_s == "All Other",
            "mtd": mtd,
            "qtd": qtd,
            "ytd": ytd,
            "lastMonthActual": lm,
            "mom": {"delta": mom_delta, "pct": mom_pct},
            "monthlyActual": monthly_actual.get(name_s),
            "monthlyBudget": monthly_budget.get(name_s),
        }
        vendors.append(row_out)
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
