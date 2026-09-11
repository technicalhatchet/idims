#!/usr/bin/env python3
"""Crop OEM diagram pages from W11416787 TL direct-drive washer manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/technical-manual-w11416787-revc wtw5100+.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_tl_dd_5100"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w11416787-dd-pinout.png",
        44,
        "Direct-drive ACU connectors & pinouts (§3-8)",
    ),
    (
        "w11416787-drive-area.png",
        56,
        "Drive area — BPM motor, shifter, pumps (TEST #3b)",
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
