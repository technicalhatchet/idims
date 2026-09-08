#!/usr/bin/env python3
"""Crop OEM diagram pages from W11169652 service manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/service-manual-w11169652-reva-27in-front-load-washers.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_fl_dd"
SCALE = 2.0

# PDF page numbers (1-based) aligned with extracted text PAGE markers.
FIGURES: list[tuple[str, int, str]] = [
    (
        "w11169652-rfi-filter-figure1.png",
        44,
        "RFI filter — line in/out (Figure 1, manual p. 3-6)",
    ),
    (
        "w11169652-acu-pinout-figure2.png",
        45,
        "ACU connectors & pinouts (Figure 2, manual p. 3-7)",
    ),
    (
        "w11169652-motor-j6-location.png",
        48,
        "Motor harness connector J6 on ACU (Figure 1, TEST #3)",
    ),
    (
        "w11169652-drum-light-j16-location.png",
        50,
        "Drum light connector J16 on ACU (Figure 1, TEST #5)",
    ),
    (
        "w11169652-inlet-valves-strip.png",
        52,
        "Inlet water valve strip circuit — J8 (TEST #6)",
    ),
    (
        "w11169652-water-level-j14.png",
        53,
        "Water level sensor / APS — J14 (TEST #7)",
    ),
    (
        "w11169652-wash-heater-j3-location.png",
        54,
        "Wash heater & NTC — J3 / J15 area (TEST #9–10)",
    ),
    (
        "w11169652-dosing-pump-strip.png",
        58,
        "Detergent dosing pump strip circuit — J10 (TEST #11B)",
    ),
    (
        "w11169652-bulk-level-strip.png",
        59,
        "Bulk dispenser level sensing — J17 (TEST #12B)",
    ),
    (
        "w11169652-vent-fan-j12-strip.png",
        60,
        "Vent fan motor strip circuit — J12 (TEST #13)",
    ),
    (
        "w11169652-baffle-j9-location.png",
        61,
        "Vent baffle solenoid — J9 (Figure 2, TEST #14)",
    ),
    (
        "w11169652-dry-heater-j4-location.png",
        62,
        "Dry heating element — J4 (Figure 2, TEST #15)",
    ),
    (
        "w11169652-dry-ntc-j13-location.png",
        63,
        "Dry temperature sensor NTC — J13 (Figure 1, TEST #16)",
    ),
]


def main() -> None:
    if not PDF.exists():
        raise SystemExit(f"Manual PDF not found: {PDF}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    matrix = fitz.Matrix(SCALE, SCALE)

    for filename, page_num, _caption in FIGURES:
        if page_num < 1 or page_num > doc.page_count:
            raise SystemExit(f"Page {page_num} out of range for {filename}")
        page = doc[page_num - 1]
        pix = page.get_pixmap(matrix=matrix)
        target = OUT_DIR / filename
        pix.save(str(target))
        print(f"Wrote {target.name} ({pix.width}x{pix.height}) from PDF p.{page_num}")

    doc.close()
    print(f"Done — {len(FIGURES)} figures in {OUT_DIR}")


if __name__ == "__main__":
    main()
