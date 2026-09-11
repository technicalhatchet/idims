#!/usr/bin/env python3
"""Crop OEM diagram pages from W11428632 Multimedia Enhanced PSC washer manual."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/technical-manual-w11428632-revC.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_tl_psc_washer"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w11428632-connector-pinout.png",
        27,
        "ACU connector pinouts (Figure 4–5, §3-3)",
    ),
    (
        "w11428632-acu-strip-circuits.png",
        32,
        "Main control strip circuits (Figure 7) & PSC bottom view (Figure 8)",
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
