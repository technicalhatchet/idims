#!/usr/bin/env python3
"""Crop OEM diagram pages from Samsung TL CG71 washer manual for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/samsung tl new style.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/samsung_tl_washer_cg71"
SCALE = 2.0

FIGURES: list[tuple[str, int, str]] = [
    ("samsungtlcg71-main-pcb.png", 16, "Sub and Main PCB — control panel (§3-1 p.16)"),
    ("samsungtlcg71-water-valve.png", 17, "Water valve housing and door assembly (§3-1 p.17)"),
    ("samsungtlcg71-door-switch.png", 18, "Top cover / door switch access (§3-1 p.18)"),
    ("samsungtlcg71-pressure-switch.png", 19, "Door switch check and pressure switch (§3-1 p.19)"),
    ("samsungtlcg71-drain-pump.png", 20, "Drain pump and thermistor (§3-1 p.20)"),
    ("samsungtlcg71-motor-clutch.png", 22, "DDM motor and clutch disassembly (§3-1 p.22)"),
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
