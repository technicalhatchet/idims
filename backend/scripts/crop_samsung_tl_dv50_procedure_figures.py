#!/usr/bin/env python3
"""Crop OEM diagram pages from Samsung generic TL dryer manual for DV50 procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/samsung-dryer-electric-gas.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/samsung_tl_dryer_dv50"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    ("samsungtldv50-control-pcb.png", 11, "Control panel and Cover PCB access (§3-2 p.11)"),
    ("samsungtldv50-door-switch.png", 13, "Frame front and door switch housing (§3-2 p.13)"),
    ("samsungtldv50-motor.png", 16, "Motor and blower assembly (§3-2 p.16)"),
    ("samsungtldv50-burner.png", 17, "Gas burner assembly (§3-2 p.17)"),
    ("samsungtldv50-heater-thermistor.png", 18, "Thermistor, sensors, and heater (§3-2 p.18)"),
    ("samsungtldv50-component-test-heat.png", 25, "Thermistor, heater, door switch tests (§4-4 p.25)"),
    ("samsungtldv50-component-test-motor.png", 26, "Motor, belt switch, flame sensor tests (§4-4 p.26)"),
    ("samsungtldv50-component-test-gas.png", 27, "Gas valve and igniter tests (§4-4 p.27)"),
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
