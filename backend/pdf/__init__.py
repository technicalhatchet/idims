"""Atomic Repair cyberpunk PDF templates (experimental — separate from pdf_service)."""

__all__ = ["build_estimate_pdf", "build_invoice_pdf", "set_pdf_variant"]


def build_estimate_pdf(*args, **kwargs):
    from pdf.estimate_template import build_estimate_pdf as _build

    return _build(*args, **kwargs)


def build_invoice_pdf(*args, **kwargs):
    from pdf.invoice_template import build_invoice_pdf as _build

    return _build(*args, **kwargs)


def set_pdf_variant(*args, **kwargs):
    from pdf.atomic_theme import set_pdf_variant as _set

    return _set(*args, **kwargs)
