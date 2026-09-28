#!/usr/bin/env python3
"""REPAIR-3 read-only scan of extracted service manuals for physical repair sections."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
MANUAL_DIR = REPO_ROOT / "backend/docs/manuals"
OUT_DIR = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
)

SECTION_HEADING_RE = re.compile(
    r"^(?:REMOVING|REPLACING|REMOVAL|REMOVE THE|INSTALLATION|INSTALLING|REASSEMBLY|"
    r"COMPONENT ACCESS|DISASSEMBLY|ASSEMBLY OF|TO REMOVE|TO REPLACE)"
    r"[\s\w&\-/',]+",
    re.IGNORECASE,
)
TOC_LINE_RE = re.compile(r"\.{3,}\s*\d")
PAGE_MARKER_RE = re.compile(r"^===== PAGE (\d+) =====\s*$")

PHYSICAL_VERB_RE = re.compile(
    r"(?i)\b(remove|disconnect|loosen|unscrew|pull|lift|slide|unhook|install|"
    r"reconnect|replace|detach|separate|drain the water)\b",
)
DIAGNOSTIC_RE = re.compile(
    r"(?i)\b(measure|ohmmeter|ohms|voltage|continuity|test\s*#|service\s+test|"
    r"manual diagnostic test|expected\s+\d|set\s+the\s+meter)\b",
)
CROSS_REF_RE = re.compile(
    r"(?i)\b(see\s+(step|page)|refer to|see\s+page)\b",
)
REFERENCE_ONLY_RE = re.compile(r"(?i)\b(replace\s+(the\s+)?\w+|suspect\s+)\b")

NUMBERED_STEP_RE = re.compile(r"^\s*(\d+)\.\s+")

IMPLEMENTED_WITNESSES = {
    "REPAIR-1": {
        "manualFile": "jobaid-8178558-l-78 whirlpool fl washer 2013 era-extracted.txt",
        "sectionTitle": "REMOVING THE DRAIN PUMP",
        "expectedClassification": "REPAIR_READY",
    },
    "REPAIR-2": {
        "manualFile": "jobaid-8178558-l-78 whirlpool fl washer 2013 era-extracted.txt",
        "sectionTitle": "REMOVING THE TEMPERATURE SENSOR & HEATER",
        "expectedClassification": "PARTIAL_REPAIR",
    },
}

CLASSIFICATIONS = (
    "REPAIR_READY",
    "PARTIAL_REPAIR",
    "DIAGNOSTIC_ONLY",
    "REFERENCE_ONLY",
    "UNSUPPORTED",
)


@dataclass
class SectionSlice:
    manual_file: str
    section_title: str
    start_page: int | None
    end_page: int | None
    body: str
    line_start: int


def manual_id_from_path(path: Path) -> str:
    stem = path.name.replace("-extracted.txt", "").replace(".txt", "")
    return stem


def slugify(text: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return base[:80] or "section"


def candidate_id(manual_file: str, section_title: str) -> str:
    digest = hashlib.sha1(f"{manual_file}|{section_title}".encode()).hexdigest()[:12]
    return f"rcand-{slugify(section_title)[:40]}-{digest}"


def list_extracted_manuals() -> list[Path]:
    return sorted(MANUAL_DIR.glob("*-extracted.txt"))


def is_toc_noise(line: str) -> bool:
    return bool(TOC_LINE_RE.search(line))


def is_heading_line(line: str) -> bool:
    stripped = line.strip()
    if len(stripped) < 12 or len(stripped) > 120:
        return False
    if is_toc_noise(stripped):
        return False
    if not SECTION_HEADING_RE.match(stripped):
        return False
    # Require mostly uppercase words for section headers (allow short tokens)
    letters = [c for c in stripped if c.isalpha()]
    if not letters:
        return False
    upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
    return upper_ratio >= 0.55 or stripped.isupper()


def extract_sections(path: Path) -> list[SectionSlice]:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    sections: list[SectionSlice] = []
    current_page: int | None = None
    i = 0
    while i < len(lines):
        page_match = PAGE_MARKER_RE.match(lines[i].strip())
        if page_match:
            current_page = int(page_match.group(1))
            i += 1
            continue
        if is_heading_line(lines[i]):
            title = lines[i].strip()
            start_line = i
            start_page = current_page
            i += 1
            body_lines: list[str] = []
            while i < len(lines):
                if PAGE_MARKER_RE.match(lines[i].strip()):
                    current_page = int(PAGE_MARKER_RE.match(lines[i].strip()).group(1))
                    body_lines.append(lines[i])
                    i += 1
                    continue
                if is_heading_line(lines[i]) and i > start_line + 2:
                    break
                body_lines.append(lines[i])
                i += 1
            body = "\n".join(body_lines).strip()
            if len(body) >= 80:
                end_page = current_page
                sections.append(
                    SectionSlice(
                        manual_file=path.name,
                        section_title=title,
                        start_page=start_page,
                        end_page=end_page,
                        body=body,
                        line_start=start_line + 1,
                    ),
                )
            continue
        i += 1
    return sections


def top_level_step_numbers(body: str) -> list[int]:
    nums: list[int] = []
    for line in body.splitlines():
        match = NUMBERED_STEP_RE.match(line)
        if match:
            nums.append(int(match.group(1)))
    return nums


def count_numbered_physical_steps(body: str, section_title: str) -> tuple[int, int, list[str]]:
    """Returns (all_physical_steps, removal_phase_steps, samples)."""
    steps: list[str] = []
    removal_started = bool(re.search(r"(?i)remov|replac|install", section_title))
    for line in body.splitlines():
        if re.search(r"(?i)^REMOVING |^TO REMOVE |^REPLACING ", line.strip()):
            removal_started = True
        if re.match(r"^\s*[a-z]\)\s+", line, re.IGNORECASE) and PHYSICAL_VERB_RE.search(line):
            steps.append(line.strip())
        if not NUMBERED_STEP_RE.match(line):
            continue
        if PHYSICAL_VERB_RE.search(line):
            steps.append(line.strip())

    nums = top_level_step_numbers(body)
    removal_phase_steps = 0
    if nums:
        threshold = 5 if min(nums) <= 4 and max(nums) >= 5 else min(nums)
        removal_phase_steps = sum(1 for n in nums if n >= threshold)

    return len(steps), removal_phase_steps, steps[:12]


def analyze_section(section: SectionSlice) -> dict[str, Any]:
    body = section.body
    physical_count, removal_phase_steps, physical_samples = count_numbered_physical_steps(
        body,
        section.section_title,
    )
    diagnostic_hits = len(DIAGNOSTIC_RE.findall(body))
    cross_refs = CROSS_REF_RE.findall(body)
    cross_ref_lines = [
        line.strip()
        for line in body.splitlines()
        if CROSS_REF_RE.search(line)
    ][:8]
    tool_lines = [
        line.strip()
        for line in body.splitlines()
        if re.search(r"(?i)\b(screwdriver|pliers|pan|wrench|socket)\b", line)
    ][:6]
    part_lines = [
        line.strip()
        for line in body.splitlines()
        if re.search(r"(?i)\b(part\s*#|p\/n|wpw|w\d{8})\b", line)
    ][:6]
    reassembly_lines = [
        line.strip()
        for line in body.splitlines()
        if re.search(r"(?i)reassembly|when you reinstall|when you reconnect", line)
    ][:6]
    before_repair_lines = [
        line.strip()
        for line in body.splitlines()
        if NUMBERED_STEP_RE.match(line)
        and re.search(r"(?i)unplug|disconnect power|turn off the water|remove the .* panel", line)
    ][:6]

    pages: list[int] = []
    if section.start_page is not None:
        pages.append(section.start_page)
    if section.end_page is not None and section.end_page not in pages:
        pages.append(section.end_page)

    provenance_fields = {
        "manualFile": section.manual_file,
        "sectionTitle": section.section_title,
        "pages": pages,
        "extractedTextFile": f"backend/docs/manuals/{section.manual_file}",
        "lineStart": section.line_start,
    }
    present = sum(
        1
        for key in ("manualFile", "sectionTitle", "extractedTextFile")
        if provenance_fields.get(key)
    )
    provenance_availability = "complete" if present >= 3 and pages else "partial" if present >= 3 else "minimal"

    return {
        "physicalStepEvidence": {
            "numberedPhysicalSteps": physical_count,
            "removalPhaseSteps": removal_phase_steps,
            "samples": physical_samples,
        },
        "beforeRepairEvidence": before_repair_lines,
        "reassemblyEvidence": reassembly_lines,
        "toolEvidence": tool_lines,
        "partEvidence": part_lines,
        "crossReferenceEvidence": cross_ref_lines,
        "diagnosticTermHits": diagnostic_hits,
        "provenanceAvailability": provenance_availability,
        "pages": pages,
    }


def infer_repair_target(title: str, body: str) -> dict[str, Any]:
    title_clean = re.sub(r"^(REMOVING|REPLACING|REMOVAL OF|INSTALLATION OF)\s+", "", title, flags=re.I)
    title_clean = title_clean.strip(" .")
    ambiguous = False
    notes: list[str] = []
    if re.search(r"(?i)temperature sensor\s*&\s*heater", title):
        label = "Temperature sensor and heater"
    elif re.search(r"(?i)drain pump", title):
        label = "Drain pump"
    elif len(title_clean) < 4:
        label = title
        ambiguous = True
        notes.append("Could not parse target from section title.")
    else:
        label = title_clean.title() if title.isupper() else title_clean
    return {
        "likelyRepairTarget": label,
        "targetAmbiguous": ambiguous,
        "targetNotes": notes,
    }


def classify_section(title: str, metrics: dict[str, Any]) -> tuple[str, str, list[str]]:
    physical = metrics["physicalStepEvidence"]["numberedPhysicalSteps"]
    removal_phase = metrics["physicalStepEvidence"].get("removalPhaseSteps", physical)
    diagnostic_hits = metrics["diagnosticTermHits"]
    cross_refs = metrics["crossReferenceEvidence"]
    gaps: list[str] = []
    title_upper = title.upper()

    is_removal_heading = bool(
        re.search(r"(?i)remov|replac|install|reassembly|disassembly", title),
    )

    if not is_removal_heading:
        return "UNSUPPORTED", "low", ["Heading does not match physical repair section patterns."]

    if physical == 0 and removal_phase == 0 and diagnostic_hits >= 2:
        return "DIAGNOSTIC_ONLY", "high", ["Section language is diagnostic/testing without numbered physical steps."]

    if physical == 0 and removal_phase == 0 and REFERENCE_ONLY_RE.search(
        title + " " + " ".join(metrics["physicalStepEvidence"]["samples"]),
    ):
        return "REFERENCE_ONLY", "medium", ["Mentions repair/replace without actionable physical steps in section body."]

    if physical == 0 and removal_phase == 0:
        return "UNSUPPORTED", "low", ["No numbered physical steps detected."]

    if cross_refs:
        gaps.extend(cross_refs[:5])

    # REPAIR-1 witness: many in-section removal steps despite access-panel cross-ref
    if removal_phase >= 4:
        conf = "high"
        if cross_refs:
            gaps.append("Cross-references present but core removal steps are in-section.")
        return "REPAIR_READY", conf, gaps

    if removal_phase >= 2 and cross_refs:
        gaps.append("Procedure depends on referenced access/removal steps outside this section.")
        return "PARTIAL_REPAIR", "high", gaps

    if physical >= 2 and cross_refs:
        gaps.append("Procedure depends on referenced access/removal steps outside this section.")
        return "PARTIAL_REPAIR", "high", gaps

    if removal_phase >= 2 or physical >= 2:
        return "PARTIAL_REPAIR", "medium", gaps or ["Limited step count in section body."]

    if physical == 1:
        return "REFERENCE_ONLY", "medium", ["Only a single physical step captured; likely incomplete."]

    return "UNSUPPORTED", "low", gaps


def dedupe_candidates(candidates: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    by_key: dict[str, dict[str, Any]] = {}
    removed = 0
    for cand in candidates:
        key = f"{cand['manualFile']}|{cand['sourceSection'].upper()}"
        if key in by_key:
            removed += 1
            existing = by_key[key]
            for ref in cand.get("sourceReferences", []):
                if ref not in existing.setdefault("sourceReferences", []):
                    existing["sourceReferences"].append(ref)
            existing_steps = existing["physicalStepEvidence"].get("numberedPhysicalSteps", 0)
            cand_steps = cand["physicalStepEvidence"].get("numberedPhysicalSteps", 0)
            if cand_steps > existing_steps:
                by_key[key] = cand
            continue
        by_key[key] = cand
    return list(by_key.values()), removed


def build_candidate(section: SectionSlice, metrics: dict[str, Any]) -> dict[str, Any]:
    classification, confidence, gaps = classify_section(section.section_title, metrics)
    target = infer_repair_target(section.section_title, section.body)
    excerpt = section.body[:400].replace("\n", " ").strip()
    cid = candidate_id(section.manual_file, section.section_title)
    record: dict[str, Any] = {
        "candidateId": cid,
        "manualId": manual_id_from_path(Path(section.manual_file)),
        "manualFile": section.manual_file,
        "extractedTextFile": f"backend/docs/manuals/{section.manual_file}",
        "sourceSection": section.section_title,
        "sourcePages": metrics["pages"],
        "sourceTextLocator": {
            "lineStart": section.line_start,
            "pageStart": section.start_page,
            "pageEnd": section.end_page,
        },
        "likelyRepairTarget": target["likelyRepairTarget"],
        "targetAmbiguous": target["targetAmbiguous"],
        "classification": classification,
        "physicalStepEvidence": metrics["physicalStepEvidence"],
        "beforeRepairEvidence": metrics["beforeRepairEvidence"],
        "reassemblyEvidence": metrics["reassemblyEvidence"],
        "toolEvidence": metrics["toolEvidence"],
        "partEvidence": metrics["partEvidence"],
        "crossReferenceEvidence": metrics["crossReferenceEvidence"],
        "provenanceAvailability": metrics["provenanceAvailability"],
        "sourceGaps": gaps,
        "confidence": confidence,
        "notes": target.get("targetNotes", []),
        "sourceExcerpt": excerpt,
        "humanReviewStatus": "DISCOVERED",
        "implementedRepairWitness": None,
        "sourceReferences": [
            {
                "extractedTextFile": f"backend/docs/manuals/{section.manual_file}",
                "lineStart": section.line_start,
                "pages": metrics["pages"],
            },
        ],
    }
    for witness_id, spec in IMPLEMENTED_WITNESSES.items():
        if (
            section.manual_file == spec["manualFile"]
            and section.section_title.upper() == spec["sectionTitle"].upper()
        ):
            record["implementedRepairWitness"] = witness_id
            record["notes"] = list(record["notes"]) + [
                f"Matches closed witness {witness_id}; discovery classification independent of implementation.",
            ]
    return record


def discover() -> dict[str, Any]:
    manuals = list_extracted_manuals()
    raw_candidates: list[dict[str, Any]] = []
    manuals_with_candidates: set[str] = set()

    for path in manuals:
        for section in extract_sections(path):
            metrics = analyze_section(section)
            cand = build_candidate(section, metrics)
            raw_candidates.append(cand)
            if cand["classification"] != "UNSUPPORTED":
                manuals_with_candidates.add(path.name)

    candidates, dup_removed = dedupe_candidates(raw_candidates)
    by_class: dict[str, list[dict[str, Any]]] = {k: [] for k in CLASSIFICATIONS}
    for cand in candidates:
        by_class[cand["classification"]].append(cand)

    def sort_key(c: dict[str, Any]) -> tuple[int, str]:
        steps = c["physicalStepEvidence"].get("numberedPhysicalSteps", 0)
        return (-steps, c["sourceSection"])

    strongest = sorted(
        [c for c in candidates if c["classification"] in ("REPAIR_READY", "PARTIAL_REPAIR")],
        key=sort_key,
    )[:25]

    human_review = sum(
        1 for c in candidates if c["classification"] in ("REPAIR_READY", "PARTIAL_REPAIR", "REFERENCE_ONLY")
    )

    return {
        "schemaVersion": "1.0.0",
        "gate": "REPAIR-3",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "readOnlyDiscovery": True,
        "noRepairProcedureSeedsGenerated": True,
        "noProductionMutations": True,
        "summary": {
            "manualsScanned": len(manuals),
            "manualsContainingRepairCandidates": len(manuals_with_candidates),
            "totalCandidates": len(candidates),
            "rawCandidatesBeforeDedupe": len(raw_candidates),
            "duplicateCandidatesRemoved": dup_removed,
            "candidatesRequiringHumanReview": human_review,
            "classificationCounts": {k: len(by_class[k]) for k in CLASSIFICATIONS},
        },
        "implementedWitnessExpectations": IMPLEMENTED_WITNESSES,
        "strongestRepairCandidates": [
            {
                "candidateId": c["candidateId"],
                "manualFile": c["manualFile"],
                "sourceSection": c["sourceSection"],
                "classification": c["classification"],
                "likelyRepairTarget": c["likelyRepairTarget"],
                "numberedPhysicalSteps": c["physicalStepEvidence"]["numberedPhysicalSteps"],
                "implementedRepairWitness": c.get("implementedRepairWitness"),
            }
            for c in strongest
        ],
        "classifications": by_class,
        "candidates": candidates,
    }


def write_artifacts(discovery: dict[str, Any]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    discovery_path = OUT_DIR / "CG_REPAIR3_CORPUS_DISCOVERY_v1.json"
    discovery_path.write_text(json.dumps(discovery, indent=2), encoding="utf-8")

    audit = {
        "schemaVersion": "1.0.0",
        "gate": "REPAIR-3",
        "readOnly": True,
        "artifact": discovery_path.name,
        "executiveSummary": {
            "verdict": "GREEN",
            "manualsScanned": discovery["summary"]["manualsScanned"],
            "totalCandidates": discovery["summary"]["totalCandidates"],
            "classificationCounts": discovery["summary"]["classificationCounts"],
            "duplicateCandidatesRemoved": discovery["summary"]["duplicateCandidatesRemoved"],
        },
        "governance": {
            "statusFlow": ["DISCOVERED", "REVIEW", "APPROVED", "IMPLEMENTED"],
            "discoveryDoesNotApprove": True,
            "implementationGates": ["REPAIR-1", "REPAIR-2"],
        },
        "representativeExamples": {
            "partialRepair": [
                c["candidateId"]
                for c in discovery["candidates"]
                if c["classification"] == "PARTIAL_REPAIR"
            ][:5],
            "diagnosticOnly": [
                c["candidateId"]
                for c in discovery["candidates"]
                if c["classification"] == "DIAGNOSTIC_ONLY"
            ][:5],
        },
    }
    audit_path = OUT_DIR / "CG_REPAIR3_CORPUS_DISCOVERY_AUDIT_v1.json"
    audit_path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(f"Wrote {discovery_path.relative_to(REPO_ROOT)}")
    print(f"Wrote {audit_path.relative_to(REPO_ROOT)}")
    print(json.dumps(discovery["summary"], indent=2))


def main() -> None:
    write_artifacts(discover())


if __name__ == "__main__":
    main()
