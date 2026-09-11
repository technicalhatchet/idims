#!/usr/bin/env python3
"""Crop component-access diagram pages from W11737351 Maytag 27\" FL dryer access manual."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / (
    "backend/docs/manuals/"
    "technical-manual-w11737351-reva access manual fl dryers.pdf"
)
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_fl_dryer_access"
SCALE = 2.0

# PDF pages 5–19: all illustrated component-access sections (p.20+ is notes/back matter).
FIGURES: list[tuple[str, int, str]] = [
    ("w11737351-access-overview.png", 5, "Component access overview"),
    ("w11737351-access-safety.png", 6, "Safety"),
    ("w11737351-access-model-label.png", 7, "Model/serial label and tech sheet location"),
    ("w11737351-access-top-console.png", 8, "Removing top panel and console/HMI"),
    ("w11737351-access-door.png", 9, "Removing the door"),
    ("w11737351-access-acu.png", 10, "Removing the ACU"),
    ("w11737351-access-front-panel.png", 11, "Removing front panel and door switch"),
    ("w11737351-access-drum-light-moisture.png", 12, "Drum light and moisture sensor"),
    ("w11737351-access-belt-drum-rollers.png", 13, "Belt, drum, and rollers"),
    ("w11737351-access-drive-motor.png", 14, "Drive motor; thermal fuse and outlet thermistor"),
    ("w11737351-access-heater-electric.png", 15, "Heater, hi-limit, and thermal cutoff (electric)"),
    ("w11737351-access-gas-ignitor-flame.png", 16, "Ignitor, flame sensor, gas hi-limit (gas)"),
    ("w11737351-access-gas-valve-coils.png", 17, "Gas burner assembly coils"),
    ("w11737351-access-rear-panel.png", 18, "Rear panel"),
    ("w11737351-access-water-valve.png", 19, "Water valve (steam models)"),
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
