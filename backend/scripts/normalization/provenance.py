from __future__ import annotations

from typing import Any


def provenance_ref(
    ref_type: str,
    **fields: Any,
) -> dict[str, Any]:
    return {"type": ref_type, **{k: v for k, v in fields.items() if v is not None}}


def build_provenance(
    manual_id: str,
    platform_id: str | None = None,
    procedure_id: str | None = None,
    pages: list[int] | None = None,
    extraction_doc: str | None = None,
    extra: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    sources: list[dict[str, Any]] = [
        provenance_ref("manual", manualId=manual_id, platformId=platform_id),
    ]
    if procedure_id:
        sources.append(
            provenance_ref(
                "procedure",
                procedureId=procedure_id,
                pages=pages or [],
            ),
        )
    if extraction_doc:
        sources.append(provenance_ref("extraction_doc", path=extraction_doc))
    if extra:
        sources.extend(extra)
    return {
        "manualId": manual_id,
        "platformId": platform_id,
        "procedureId": procedure_id,
        "pages": pages or [],
        "sources": sources,
    }
