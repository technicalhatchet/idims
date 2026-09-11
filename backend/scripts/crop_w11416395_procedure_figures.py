#!/usr/bin/env python3
"""Crop OEM diagram pages from W11416395 MVW6200 washer manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/service-manual-w11416395-revb mvw6200.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_mvw6200"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w11416395-acu-pinout.png",
        24,
        "Main control connectors & pinouts (§3-3)",
    ),
    (
        "w11416395-psc-bottom-view.png",
        29,
        "PSC drive area — motor, shifter, drain pump (TEST #3)",
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
