#!/usr/bin/env python3
"""Crop OEM diagram pages from W10901168 Bella French door manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/service-manual-w10901168-bella.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_bella_french_door"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w10901168-orion-board-pinout.png",
        12,
        "Orion board connectors & 115 VAC distribution (FIGURE 5, §2-4)",
    ),
    (
        "w10901168-gf2-board-connectors.png",
        14,
        "GF2 high-voltage board connectors (§2-6)",
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
