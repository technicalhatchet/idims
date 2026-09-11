#!/usr/bin/env python3
"""Crop OEM diagram pages from W10864849 service manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / (
    "backend/docs/manuals/"
    "w10864849-whirlpool-and-maytag-direct-drive-top-load-washer wtw9500.pdf"
)
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_tl_dd"
SCALE = 2.0

# PDF page numbers (1-based) aligned with extracted text PAGE markers.
FIGURES: list[tuple[str, int, str]] = [
    (
        "w10864849-acu-pinout-figure1.png",
        31,
        "Main control connectors & pinouts (§3-5)",
    ),
    (
        "w10864849-inlet-valves-strip.png",
        32,
        "Water inlet valves strip circuit (TEST #2)",
    ),
    (
        "w10864849-drive-system-figure1.png",
        33,
        "Drive system — motor & shifter area (TEST #3)",
    ),
    (
        "w10864849-thermistor-strip.png",
        37,
        "Temperature thermistor strip circuit (TEST #5)",
    ),
    (
        "w10864849-pumps-strip.png",
        39,
        "Drain & recirculation pumps strip circuit (TEST #7)",
    ),
    (
        "w10864849-lid-lock-schematic.png",
        40,
        "Lid lock schematic (TEST #8)",
    ),
    (
        "w10864849-heater-strip.png",
        41,
        "Heater element strip circuit (TEST #9)",
    ),
    (
        "w10864849-basket-light-strip.png",
        43,
        "Basket light strip circuit (TEST #11)",
    ),
    (
        "w10864849-rex-bulk-dispense.png",
        44,
        "Relay expansion board — bulk dispense (TEST #12)",
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
