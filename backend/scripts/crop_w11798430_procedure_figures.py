#!/usr/bin/env python3
"""Crop OEM diagram pages from W11798430 WED4100 ACU TL dryer manual (platform delta)."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/technical-manual-w11798430-revc wed4100.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_acu_tl_dryer"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w11798430-acu-pinout.png",
        55,
        "ACU connections — J4 thermistors, J7 motor (§ACU connections)",
    ),
    (
        "w11798430-motor-strip.png",
        63,
        "Motor strip circuit (TEST #3)",
    ),
    (
        "w11798430-heater-strip.png",
        67,
        "Heater strip circuits — electric & gas (TEST #4)",
    ),
    (
        "w11798430-thermistor-strip.png",
        70,
        "Thermistors strip circuit (TEST #4a)",
    ),
    (
        "w11798430-gas-valve.png",
        71,
        "Gas valve resistance (TEST #4d)",
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
