#!/usr/bin/env python3
"""Crop OEM diagram pages from W8178558 job aid for procedure UI assets."""

from __future__ import annotations

from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "backend/docs/manuals/jobaid-8178558-l-78 whirlpool fl washer 2013 era.pdf"
OUT_DIR = ROOT / "frontend/public/images/procedures/whirlpool_duet_sport"
SCALE = 2.0

# PDF page numbers (1-based) aligned with extracted text PAGE markers.
FIGURES: list[tuple[str, int, str]] = [
    (
        "w8178558-ccu-pinout-figure4-5.png",
        43,
        "CCU connector callouts (§4-5, manual p. 43)",
    ),
    (
        "w8178558-inlet-valves-vch7.png",
        71,
        "Inlet valve solenoids — VCH7 (§5-1)",
    ),
    (
        "w8178558-pressure-switch-pr6.png",
        72,
        "Pressure switch — PR6 (§5-2)",
    ),
    (
        "w8178558-dispenser-di6.png",
        74,
        "Detergent dispenser — DI6 (§5-4)",
    ),
    (
        "w8178558-door-dl3-ds2.png",
        75,
        "Door lock DL3 & door switch DS2 (§5-5)",
    ),
    (
        "w8178558-drain-pump-dp2.png",
        76,
        "Drain pump — DP2 (§5-6)",
    ),
    (
        "w8178558-heater-th2.png",
        77,
        "Wash heater HE2 & temp sensor TH2 (§5-7)",
    ),
    (
        "w8178558-motor-ms2-interlock.png",
        78,
        "Drive motor MS2 & interlock switch (§5-8)",
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
