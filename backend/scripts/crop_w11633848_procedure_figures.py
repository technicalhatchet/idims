#!/usr/bin/env python3
"""Crop OEM diagram pages from W11633848 dishwasher manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / (
    "backend/docs/manuals/"
    "technical-manual-w11633848-revb amana and whirlpool dishwasher.pdf"
)
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_dishwasher_acu"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w11633848-door-switch-strip.png",
        41,
        "Door switch strip circuit (§3-7)",
    ),
    (
        "w11633848-fill-valve-strip.png",
        42,
        "Fill valve strip circuit (§3-8)",
    ),
    (
        "w11633848-heater-strip.png",
        44,
        "Heater strip circuit (§3-10)",
    ),
    (
        "w11633848-owi-strip.png",
        45,
        "OWI / water sensing strip circuit (§3-11)",
    ),
    (
        "w11633848-overfill-strip.png",
        46,
        "Overfill float switch strip circuit (§3-12)",
    ),
    (
        "w11633848-wash-motor-strip.png",
        49,
        "Wash motor strip circuit (§3-15)",
    ),
    (
        "w11633848-drain-motor-strip.png",
        50,
        "Drain motor strip circuit (§3-16)",
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
