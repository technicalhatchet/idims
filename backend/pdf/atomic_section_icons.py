"""Hex badge icons for SERVICES / PARTS section headings (SVG assets)."""

from __future__ import annotations

import os

from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg

_ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")
SERVICES_ICON_SVG = os.path.join(_ASSETS_DIR, "services-section-icon.svg")
PARTS_ICON_SVG = os.path.join(_ASSETS_DIR, "parts-section-icon.svg")

SECTION_ICON_SIZE = 22
SECTION_ICON_LEFT = 0
SECTION_ICON_TEXT_GAP = 7
SECTION_TITLE_FONT_SIZE = 10
SECTION_ICON_BOTTOM_PAD = 1
SECTION_LABEL_TABLE_GAP = 2
# Tight band: badge sits on the bottom edge so the heading hugs the table below.
SECTION_LABEL_HEIGHT = SECTION_ICON_SIZE + SECTION_ICON_BOTTOM_PAD - 1

_svg_cache: dict = {}


def _load_drawing(path: str):
    mtime = os.path.getmtime(path) if os.path.isfile(path) else 0
    cached = _svg_cache.get(path)
    if cached and cached[0] == mtime:
        return cached[1]
    _svg_cache[path] = (mtime, svg2rlg(path))
    return _svg_cache[path][1]


def clear_svg_cache() -> None:
    _svg_cache.clear()


def draw_section_icon(canvas, x: float, y: float, kind: str, size: float = SECTION_ICON_SIZE):
    """Draw section badge SVG with bottom-left anchor at (x, y)."""
    svg_path = SERVICES_ICON_SVG if kind in ("services", "cyan") else PARTS_ICON_SVG
    drawing = _load_drawing(svg_path)
    if drawing is None:
        return

    dw = max(float(drawing.width or 64), 1.0)
    dh = max(float(drawing.height or 64), 1.0)
    scale = size / max(dw, dh)

    canvas.saveState()
    canvas.translate(x, y)
    canvas.scale(scale, scale)
    renderPDF.draw(drawing, canvas, 0, 0)
    canvas.restoreState()


def draw_section_icon_badge(canvas, cx: float, cy: float, accent, kind: str, radius: float = 11):
    """Centered icon — ``cx``/``cy`` are the badge center in canvas coords."""
    del accent, radius
    x = cx - SECTION_ICON_SIZE / 2
    y = cy - SECTION_ICON_SIZE / 2
    draw_section_icon(canvas, x, y, kind, SECTION_ICON_SIZE)


def section_title_text_x() -> float:
    """Left inset for section title text beside the icon badge."""
    return SECTION_ICON_LEFT + SECTION_ICON_SIZE + SECTION_ICON_TEXT_GAP


def section_icon_cy() -> float:
    """Vertical center for the section badge — bottom-aligned in the label band."""
    return SECTION_LABEL_HEIGHT - SECTION_ICON_SIZE / 2 - SECTION_ICON_BOTTOM_PAD


def section_title_baseline() -> float:
    """Text baseline aligned with the cap-height center of the icon badge."""
    return section_icon_cy() - SECTION_TITLE_FONT_SIZE * 0.36
