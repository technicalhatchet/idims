#!/usr/bin/env python3
"""Crop OEM diagram pages from W11416805 ACU top-load dryer manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/technical-manual-w11416805-revb wed5100 wgd5100.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_acu_tl_dryer"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "w11416805-acu-pinout.png",
        25,
        "ACU connectors & pinouts (§3-3)",
    ),
    (
        "w11416805-motor-figure9.png",
        28,
        "Motor main/start winding measure points (TEST #3)",
    ),
    (
        "w11416805-thermal-electric.png",
        29,
        "Thermal components — electric dryer (TEST #4)",
    ),
    (
        "w11416805-thermal-gas.png",
        30,
        "Thermal components — gas dryer (TEST #4)",
    ),
    (
        "w11416805-gas-valve.png",
        32,
        "Gas valve coil resistance (TEST #4d)",
    ),
    (
        "w11416805-strip-circuits.png",
        38,
        "Strip circuits — motor, heater, moisture (§3-16)",
    ),
    (
        "w11416805-water-valve-strip.png",
        39,
        "Steam water valve strip circuit",
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
