#!/usr/bin/env python3
"""Crop OEM diagram pages from W11819775 ACU inverter French door manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/technical-manual-w11819775-revb 2026 frenchdoor.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_acu_fd_inverter"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w11819775-acu-connector-pinout.png",
        92,
        "ACU connector pinouts (CONTROL BOARD / CONNECTORS & PINOUTS, p.92)",
    ),
    (
        "w11819775-voltage-chart-a.png",
        52,
        "ACU voltage chart — CN20/CN12/CN7/CN18 (p.52)",
    ),
    (
        "w11819775-voltage-chart-b.png",
        53,
        "ACU voltage chart — CN6/CN13/CN10 thermistors & loads (p.53)",
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
