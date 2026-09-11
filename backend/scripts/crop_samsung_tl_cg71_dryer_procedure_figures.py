#!/usr/bin/env python3
"""Crop OEM diagram pages from Samsung TL CG71 dryer manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/samsung tl dryer new style.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/samsung_tl_dryer_cg71"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    ("samsungtlcg71d-main-pcb.png", 12, "Main PCB assembly (§2-8 p.12)"),
    ("samsungtlcg71d-sub-pcb.png", 13, "Sub PCB assembly (§2-9 p.13)"),
    ("samsungtlcg71d-door-switch.png", 17, "Frame front and door switch housing (§3-2 p.17)"),
    ("samsungtlcg71d-moisture-sensor.png", 18, "Moisture sensor access (§3-2 p.18)"),
    ("samsungtlcg71d-motor.png", 20, "Motor and blower assembly (§3-2 p.20)"),
    ("samsungtlcg71d-burner.png", 21, "Gas burner assembly (§3-2 p.21)"),
    ("samsungtlcg71d-heater-thermistor.png", 22, "Thermistor, sensors, and heater (§3-2 p.22)"),
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
