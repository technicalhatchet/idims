#!/usr/bin/env python3
"""Crop OEM diagram pages from W8178559 job aid for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/jobaid-8178559-l-79 whirlpool fl dryer 2013 era.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_duet_sport_dryer"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w8178559-mce-pinout-figure17.png",
        88,
        "MCE connectors & pinouts (Figure 17)",
    ),
    (
        "w8178559-motor-figure7-9.png",
        81,
        "Motor & belt switch — Figures 7–9 (TEST #2)",
    ),
    (
        "w8178559-heater-figure11.png",
        82,
        "Thermal components — Figure 11 (TEST #3)",
    ),
    (
        "w8178559-exhaust-thermistor-3a.png",
        83,
        "Exhaust thermistor — TEST #3a",
    ),
    (
        "w8178559-gas-valve-3d.png",
        84,
        "Gas valve coils — TEST #3b–3d",
    ),
    (
        "w8178559-moisture-figure12.png",
        86,
        "Moisture sensor — Figure 12 (TEST #4)",
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
