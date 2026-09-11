#!/usr/bin/env python3
"""Crop OEM diagram pages from W10410465 CCU top-load dryer tech sheet for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/WPL Top load Dryer Service Manual.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_ccu_tl_dryer"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w10410465-ccu-pinout-figure11.png",
        9,
        "CCU connectors & pinouts (Figure 11, TEST #1)",
    ),
    (
        "w10410465-motor-figure17-19.png",
        13,
        "Motor windings & belt switch (Figures 17–19, TEST #3)",
    ),
    (
        "w10410465-thermal-figure20.png",
        14,
        "Thermal components (Figures 20a/20b, TEST #4)",
    ),
    (
        "w10410465-strip-circuits-figure23.png",
        22,
        "Strip circuits — motor, heater, thermistors, myst valve (page 22)",
    ),
    (
        "w10410465-gas-valve-figure21.png",
        18,
        "Gas valve coil resistance (Figure 21, TEST #4d)",
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
