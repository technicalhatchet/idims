#!/usr/bin/env python3
"""Crop OEM diagram pages from W11296289 SxS refrigerator manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/Service-Manual-W11296289-Side-X-Side-Refrigerator.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_sxs_w11296289"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w11296289-theseus-voltage-test-points.png",
        33,
        "THESEUS ACU voltage test points — P1–P11 (§3-3)",
    ),
    (
        "w11296289-wiring-diagram-a.png",
        34,
        "Wiring diagram A — THESEUS/MINOTAUR (WRS321/325)",
    ),
    (
        "w11296289-athena-voltage-test-points-b.png",
        35,
        "ATHENA ACU voltage test points — J2/JP1 diagram B (§3-5)",
    ),
    (
        "w11296289-athena-voltage-test-points-c.png",
        37,
        "ATHENA ACU voltage test points — diagram C (WRS312/315, WRSA15)",
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
