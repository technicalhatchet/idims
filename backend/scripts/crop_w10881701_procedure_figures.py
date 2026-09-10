#!/usr/bin/env python3
"""Crop OEM diagram pages from W10881701 steam dryer manual (CCU platform delta figures)."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/servicemanual-w10881701-l-91 wed9500.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_ccu_dryer"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w10881701-acu-pinout.png",
        29,
        "ACU connectors & pinouts — J14 thermistors (§3-7)",
    ),
    (
        "w10881701-motor-strip.png",
        33,
        "Motor windings & strip circuit (TEST #3)",
    ),
    (
        "w10881701-thermistor-strip.png",
        36,
        "Exhaust/inlet thermistor strip circuit (TEST #4a)",
    ),
    (
        "w10881701-gas-valve.png",
        38,
        "Gas valve coil resistance (TEST #4d)",
    ),
    (
        "w10881701-water-valve-strip.png",
        44,
        "Steam water valve strip circuit (TEST #9)",
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
