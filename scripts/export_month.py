"""Export one month's dashboard-data JSON from an FP&A workbook.

Usage:
    python scripts/export_month.py "path/to/(NEW) June 2026 Department HC & Opex Template.xlsx"

Reads the workbook's `Dashboard JSON` sheet — cells A2 (+A3 if present) contain the
already-assembled dashboard-data.json (Excel splits it across cells because of the
32k-char cell limit). Also reads `Dashboard Config` A2 for the layout config.

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
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/export_month.py <path-to-workbook.xlsx>")
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.exists():
        sys.exit(f"File not found: {src}")

    wb = load_workbook_unlocked(src)

    data_raw = read_sheet_cell_concat(wb, "Dashboard JSON")
    data = json.loads(data_raw)

    if "meta" not in data or "reportMonth" not in data["meta"]:
        sys.exit("Dashboard JSON is missing meta.reportMonth")

    month_key = month_key_from_report_month(data["meta"]["reportMonth"])

    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    data_path = SAMPLE_DIR / f"dashboard-data-{month_key}.json"
    data_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"wrote {data_path.relative_to(REPO_ROOT)} "
          f"({len(data.get('departments', []))} depts, "
          f"{len(data.get('leaders', []))} leaders)")

    # Extract config too — the workbook is the source of truth for layout.
    try:
        cfg_raw = read_sheet_cell_concat(wb, "Dashboard Config")
        cfg = json.loads(cfg_raw)
        cfg_path = SAMPLE_DIR / "dashboard-config.json"
        cfg_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
        print(f"wrote {cfg_path.relative_to(REPO_ROOT)} "
              f"({len(cfg.get('dashboards', []))} dashboards)")
    except (KeyError, ValueError) as e:
        print(f"skipped config (workbook may not carry it): {e}")

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
