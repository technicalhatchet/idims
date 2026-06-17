"""Orbitron Bold (wght 700) registration for PDF section titles."""

from __future__ import annotations

import os

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from pdf.atomic_theme import FONT_BOLD

_FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
ORBITRON_BOLD_PATH = os.path.join(_FONT_DIR, "Orbitron-Bold.ttf")
ORBITRON_BOLD = "Orbitron-Bold"

_registered = False


def ensure_orbitron_fonts() -> None:
    global _registered
    if _registered:
        return
    if os.path.isfile(ORBITRON_BOLD_PATH):
        pdfmetrics.registerFont(TTFont(ORBITRON_BOLD, ORBITRON_BOLD_PATH))
    _registered = True


def title_display_font() -> str:
    """Orbitron Bold for ESTIMATE / SERVICES / PARTS; Helvetica-Bold fallback."""
    ensure_orbitron_fonts()
    if ORBITRON_BOLD in pdfmetrics.getRegisteredFontNames():
        return ORBITRON_BOLD
    return FONT_BOLD
