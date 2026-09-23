#!/usr/bin/env python3
"""Generate CG-MICROWAVE LG LMHM2237 compounding gate decisions PDF."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT = REPO_ROOT / "CG_MICROWAVE_LG_LMHM2237_COMPOUNDING_GATE_DECISIONS.pdf"


def main() -> None:
    c = canvas.Canvas(str(OUT), pagesize=letter)
    width, height = letter
    x = 54
    y = height - 54
    line_h = 14

    def draw(title: str, lines: list[str]) -> None:
        nonlocal y
        if y < 100:
            c.showPage()
            y = height - 54
        c.setFont("Helvetica-Bold", 12)
        c.drawString(x, y, title)
        y -= line_h
        c.setFont("Helvetica", 10)
        for line in lines:
            if y < 72:
                c.showPage()
                y = height - 54
                c.setFont("Helvetica", 10)
            c.drawString(x + 8, y, line)
            y -= line_h - 2
        y -= 6

    c.setFont("Helvetica-Bold", 16)
    c.drawString(x, y, "CG-MICROWAVE Compounding Gate Decisions")
    y -= 20
    c.setFont("Helvetica", 11)
    c.drawString(x, y, "LG LMHM2237 Sequence 1 — Approved")
    y -= line_h
    c.drawString(x, y, f"Date: {date.today().isoformat()}")
    y -= 18

    draw(
        "Gate Result",
        [
            "LG LMHM2237 COMPOUNDING: COMPLETE / AUDIT APPROVED",
            "Artifact: CG_MICROWAVE_LG_LMHM2237_COMPOUNDING_AUDIT_v1.json",
            "Verdict: GREEN / LG_COMPOUNDING_AUDIT_PASSED",
            "Samsung ME11 Sequence 2: UNBLOCKED / NEXT",
        ],
    )
    draw(
        "Human Approvals (All Satisfied)",
        [
            "1. Magnetron -> rf_cavity — Branch A precedence exception applied.",
            "2. HV cascade -> hv_generation — transformer/capacitor/diode/fuse.",
            "3. Door interlock + thermal protection — frozen functional boundaries.",
            "4. Samsung ME11 sequence 2 — authorized.",
        ],
    )
    draw(
        "Invariants Held",
        [
            "Canonical expansion: 0 | microwave.json mutation: 0",
            "Frozen hash: 3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d",
            "Procedures 12/12 | Measurements 12/12 | Branches 12/12 | Realizations 13",
            "Regression: 6/6",
        ],
    )
    draw(
        "Runtime Layering",
        [
            "LMHM2237 -> frozen microwave canonical -> LG manufacturer overlay",
            "Overlay: manufacturer_overlays/lg_microwave_otr.json",
        ],
    )
    draw(
        "Carry-Forward — Samsung ME11",
        [
            "Same magnetron -> rf_cavity precedence guard.",
            "Compound from Samsung ME11 normalization/manual evidence ONLY.",
            "Do NOT use LG success as proof of Samsung realizations.",
        ],
    )
    draw(
        "Immediate Next Actions",
        [
            "1. Execute Samsung ME11 compounding (sequence 2).",
            "2. Publish samsung_microwave_otr overlay from Samsung evidence.",
            "3. Samsung compounding audit for human gate.",
            "4. Keep microwave.json frozen; zero canonical expansion.",
        ],
    )

    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
