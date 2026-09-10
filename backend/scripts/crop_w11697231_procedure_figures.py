#!/usr/bin/env python3
"""Crop OEM diagram pages from W11697231 WTW4950 PSC washer manual (whirlpool_tl_dd delta)."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/technical-manual-w11697231-reva wtw4950.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_tl_dd"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w11697231-acu-pinout.png",
        30,
        "Main control connectors & pinouts (TEST #1)",
    ),
    (
        "w11697231-shifter-strip.png",
        32,
        "Shifter assembly strip circuit (TEST #3a)",
    ),
    (
        "w11697231-motor-strip.png",
        33,
        "PSC motor strip circuit (TEST #3b)",
    ),
    (
        "w11697231-drain-pump-strip.png",
        35,
        "Drain pump strip circuit (TEST #7)",
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
