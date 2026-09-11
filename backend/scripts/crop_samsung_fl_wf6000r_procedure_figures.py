#!/usr/bin/env python3
"""Crop OEM diagram pages from Samsung WF6000R FL washer manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/samsung fl washer wf45t6000.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/samsung_fl_washer_wf6000r"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    (
        "samsungwf6000r-rear-motor.png",
        15,
        "Rear motor disassembly — winding checkpoint Blue-White-Red (§3-2)",
    ),
    (
        "samsungwf6000r-main-pcb.png",
        19,
        "Main PCB separation and connectors (§3-2)",
    ),
    (
        "samsungwf6000r-door-lock.png",
        21,
        "Frame front — door lock switch access (§3-2)",
    ),
    (
        "samsungwf6000r-valves-level-sensor.png",
        23,
        "Water supply valve and water level sensor (§3-2)",
    ),
    (
        "samsungwf6000r-heater-thermistor.png",
        27,
        "Heater and thermistor at tub bottom front (§3-2)",
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
