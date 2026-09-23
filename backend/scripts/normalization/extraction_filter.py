from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .term_preprocessor import ExtractedTerm, extract_terms_from_procedure, preprocess_extracted_term


@dataclass
class ExtractionFilterStats:
    procedural_noise: int = 0
    structural_noise: int = 0
    invalid_extraction: int = 0
    samples: list[dict[str, Any]] = field(default_factory=list)

    def record(self, raw: str, reason: str, procedure_id: str | None, source: str) -> None:
        if reason == "PROCEDURAL_NOISE":
            self.procedural_noise += 1
        elif reason == "STRUCTURAL_TOKEN":
            self.structural_noise += 1
        else:
            self.invalid_extraction += 1

        if len(self.samples) < 40:
            self.samples.append(
                {
                    "rawTerm": raw,
                    "blockedReason": reason,
                    "procedureId": procedure_id,
                    "source": source,
                },
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "proceduralNoise": self.procedural_noise,
            "structuralNoise": self.structural_noise,
            "invalidExtraction": self.invalid_extraction,
            "totalFiltered": self.procedural_noise + self.structural_noise + self.invalid_extraction,
            "samples": self.samples,
        }


def collect_filtered_title_tokens(procedure: dict[str, Any], stats: ExtractionFilterStats) -> None:
    procedure_id = procedure.get("procedureId")
    title = str(procedure.get("title") or "").strip()
    if not title:
        return

    preprocessed = preprocess_extracted_term(title)
    if preprocessed.action != "filter":
        return

    stats.record(
        title,
        preprocessed.blocked_reason or "INVALID_EXTRACTION",
        procedure_id,
        "title",
    )


def collect_legacy_title_token_noise(procedure: dict[str, Any], stats: ExtractionFilterStats) -> None:
    """Count title tokens that naive extraction would have emitted but we now skip."""
    import re

    procedure_id = procedure.get("procedureId")
    title = str(procedure.get("title") or "")
    for token in re.findall(r"[A-Za-z][A-Za-z0-9 /-]{1,40}", title):
        stripped = token.strip()
        if len(stripped) < 2:
            continue
        preprocessed = preprocess_extracted_term(stripped)
        if preprocessed.action == "filter":
            stats.record(
                stripped,
                preprocessed.blocked_reason or "INVALID_EXTRACTION",
                procedure_id,
                "title_token",
            )


def build_extraction_filter_stats(procedures: list[dict[str, Any]]) -> ExtractionFilterStats:
    stats = ExtractionFilterStats()
    for procedure in procedures:
        collect_filtered_title_tokens(procedure, stats)
        collect_legacy_title_token_noise(procedure, stats)
        for extracted in extract_terms_from_procedure(procedure):
            if extracted.source != "componentId":
                continue
            preprocessed = preprocess_extracted_term(extracted.raw)
            if preprocessed.action == "filter":
                stats.record(
                    extracted.raw,
                    preprocessed.blocked_reason or "INVALID_EXTRACTION",
                    procedure.get("procedureId"),
                    extracted.source,
                )
    return stats
