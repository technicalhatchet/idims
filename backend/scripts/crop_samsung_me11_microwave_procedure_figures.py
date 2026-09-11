#!/usr/bin/env python3
"""Crop OEM diagram pages from Samsung ME11 OTR manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/Samsung ME11A7510DSAA.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/samsung_microwave_otr"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    ("samsung-me11-disassembly-hv.png", 12, "HV transformer / capacitor access (§3-2)"),
    ("samsung-me11-disassembly-door.png", 16, "Door assembly disassembly (§3-5)"),
    ("samsung-me11-interlock-switch.png", 24, "Interlock switch adjustment (§4-6)"),
    ("samsung-me11-pcb-sub-module.png", 38, "Sub module PCB layout (§6-1)"),
    ("samsung-me11-pcb-sub-connectors.png", 39, "Sub module connector pinouts (§6-1)"),
    ("samsung-me11-pcb-main.png", 40, "Main PBA layout (§6-2)"),
    ("samsung-me11-pcb-main-connectors.png", 41, "Main PBA connector pinouts (§6-2)"),
    ("samsung-me11-wiring-1.png", 42, "Wiring diagram sheet 1 (§7-1)"),
    ("samsung-me11-wiring-2.png", 43, "Wiring diagram sheet 2 (§7-1)"),
    ("samsung-me11-wiring-3.png", 44, "Wiring diagram sheet 3 (§7-1)"),
    ("samsung-me11-wiring-4.png", 45, "Wiring diagram sheet 4 (§7-1)"),
    ("samsung-me11-wiring-5.png", 46, "Wiring diagram sheet 5 (§7-1)"),
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
