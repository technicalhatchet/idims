"""Reusable billing / status badges for services and parts tables."""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.platypus import Flowable

from pdf.atomic_theme import (
    CYAN,
    CYAN_HEX,
    FONT_BOLD,
    GREEN,
    GREEN_HEX,
    ORANGE,
    ORANGE_HEX,
    WHITE,
    safe_text,
)

BADGE_STATUSES = (
    "Recommended",
    "Required",
    "Approved",
    "Declined",
    "Installed",
    "Pending",
    "Paid",
)

_BADGE_COLORS = {
    "recommended": ("cyan", CYAN),
    "required": ("orange", ORANGE),
    "approved": ("green", GREEN),
    "declined": ("orange", ORANGE),
    "installed": ("green", GREEN),
    "pending": ("cyan", CYAN),
    "paid": ("green", GREEN),
}


def badge_palette(status: str, section: str = "services"):
    key = safe_text(status, "pending").lower()
    if key in _BADGE_COLORS:
        name, color = _BADGE_COLORS[key]
        return name, color
    return ("cyan" if section == "services" else "orange", CYAN if section == "services" else ORANGE)


class BadgeFlowable(Flowable):
    """Rounded-rect status badge drawn as vector art."""

    def __init__(self, status: str, section: str = "services", width: float = 72, height: float = 16):
        Flowable.__init__(self)
        self.status = safe_text(status, "Pending")
        self.section = section
        self.badge_width = width
        self.badge_height = height
        self.width = width
        self.height = height + 4

    def wrap(self, availWidth, availHeight):
        self.width = min(self.badge_width, availWidth)
        return self.width, self.height

    def draw(self):
        canvas = self.canv
        _, accent = badge_palette(self.status, self.section)
        x = (self.width - self.badge_width) / 2
        y = 2
        w = self.badge_width
        h = self.badge_height
        r = 4

        canvas.saveState()
        glow = colors.Color(accent.red, accent.green, accent.blue, alpha=0.25)
        canvas.setFillColor(glow)
        canvas.roundRect(x - 1, y - 1, w + 2, h + 2, r + 1, stroke=0, fill=1)

        canvas.setFillColor(colors.Color(0, 0, 0, alpha=0.35))
        canvas.roundRect(x, y, w, h, r, stroke=0, fill=1)
        canvas.setStrokeColor(accent)
        canvas.setLineWidth(1)
        canvas.roundRect(x, y, w, h, r, stroke=1, fill=0)

        canvas.setFont(FONT_BOLD, 6.5)
        canvas.setFillColor(WHITE)
        label = self.status.upper() if len(self.status) <= 12 else self.status[:11].upper() + "…"
        tw = canvas.stringWidth(label, FONT_BOLD, 6.5)
        canvas.drawString(x + (w - tw) / 2, y + h / 2 - 2.5, label)
        canvas.restoreState()


def badge_cell(status: str, section: str = "services") -> BadgeFlowable:
    return BadgeFlowable(status, section=section)


def draw_badge(canvas, x: float, y: float, status: str, section: str = "services", width: float = 72, height: float = 16):
    """Draw a badge at absolute canvas coordinates (``y`` = bottom)."""
    badge = BadgeFlowable(status, section=section, width=width, height=height)
    badge.canv = canvas
    badge.wrap(width, height + 4)
    badge.drawOn(canvas, x, y)
