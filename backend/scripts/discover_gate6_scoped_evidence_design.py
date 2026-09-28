#!/usr/bin/env python3
"""Gate 6 read-only semantic design for scoped evidence (no seeds, no production changes)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
)

PROVEN_WITNESSES = [
    "w8178558-drain-pump",
    "w8178558-wash-heater",
    "w8178558-wash-ntc",
]

DESIGN_CASES = [
    "w8178558-door-lock",
    "w11169652-test-01-acu-power",
    "w8178558-inlet-valves",
    "w10864849-test-07-drain-recirc-pump",
    "w11416787-test-07-drain-recirc-pump",
    "w11633848-overfill-switch",
]

NEGATIVE_CONTROLS = [
    "lgotrmw-door-interlock",
    "samsungotrmw-door-interlock",
]

CONCEPTS_SHOULD_NOT_ADD = [
    "Canonical harness / wiring harness component nodes in the ontology graph",
    "Inferring loadInCircuit from connector names (DP2, J#, harness) without measurementContext",
    "Treating component_verified at CCU connector as equivalent to at_load verification",
    "Mapping pin-for-pin harness continuity (both ends disconnected) to path_open + loadInCircuit true",
    "Converting microwave interlock direct switch tests to external_path_fault",
    "New canonical float_switch / recirc_pump nodes solely to fix seed attribution errors",
    "Matcher or wizard ranking weights driven by scoped assertion fields",
    "Automatic topology inference from OEM prose or sourceExcerpt alone",
    "path_verified as a default outcome of checkpoint_yes harness steps",
    "Replacing legacy confirm/eliminate behavior for unscoped effects",
    "Single global repair resolver that ignores per-run evidence set in favor of last-writer confirm",
    "New EffectAssertion enum values in Gate 7 unless a Gate 6 follow-up explicitly approves them",
]

DESIGN_FINDINGS: dict[str, Any] = {
    "schemaVersion": "1.0.0",
    "gate": 6,
    "method": "gate6_read_only_design_v1",
    "provenWitnessesUnchanged": PROVEN_WITNESSES,
    "designPrinciplesPreserved": [
        "Canonical graph remains functional, not physical wiring topology",
        "No canonical harness nodes",
        "component_verified is not path_verified",
        "path_open requires explicit test configuration (measurementContext + frozen snapshot)",
        "Legacy unscoped evidence keeps existing behavior",
        "Path faults remain separate from component confirmation",
        "True component tests must not become path faults",
        "OEM narrative remains secondary to structured evidence",
        "Do not infer topology from terminology alone",
    ],
    "dimensionAnalysis": {},
    "proposedMinimumModel": {},
    "conceptInventory": [],
    "procedureExamples": {},
    "negativeControls": {},
    "backwardCompatibility": {},
    "gate7ImplementationBoundary": {},
    "conceptsShouldNotAdd": CONCEPTS_SHOULD_NOT_ADD,
    "noProposedProductionMutations": True,
}


def classify_concept(
    concept_id: str,
    tier: str,
    problem: str,
    why_current_fails: str,
    minimum_representation: str,
    gate4_interaction: str,
    avoids_topology_pollution: str,
    backward_compat: str,
    intelligence_ranking: str,
) -> dict[str, Any]:
    return {
        "conceptId": concept_id,
        "tier": tier,
        "problem": problem,
        "whyCurrentModelCannotRepresent": why_current_fails,
        "minimumProposedRepresentation": minimum_representation,
        "interactionWithGate4Semantics": gate4_interaction,
        "avoidsCanonicalTopologyPollution": avoids_topology_pollution,
        "backwardCompatibilityImpact": backward_compat,
        "intelligenceRankingImpact": intelligence_ranking,
    }


def build_concept_inventory() -> list[dict[str, Any]]:
    return [
        classify_concept(
            "loadInstanceKey",
            "REQUIRED",
            "Distinguish multiple electrical loads sharing one componentId (cold/hot inlet coils; drain vs recirc on one connector).",
            "Gate 4 pairs component_verified + path_open per componentId only; second coil overwrites or conflates evidence.",
            "Optional procedure-local string on DiagnosticEffect + ScopedEvidenceRecord + PathFaultRef: loadInstanceKey (e.g. cold_coil, hot_coil, drain_winding). Not a canonical id.",
            "Gate 4 witness unchanged when loadInstanceKey omitted (implicit default). Compound derivation groups by (componentId, loadInstanceKey).",
            "Stays on procedure evidence records; never added to canonical ontology.",
            "Omitted field = today’s single-load behavior.",
            "Downstream interpretation only; no matcher/ranking changes in Gate 7.",
        ),
        classify_concept(
            "evidenceSetDerivation",
            "REQUIRED",
            "ACU-first procedures prove load good after control/harness steps; causal conclusion must not require step order.",
            "deriveForComponent implicitly allows any-order component_verified + path_open in one run, but repair headline and inconclusive rules treat missing load-before-path in OEM flow as ambiguous; multi-step seeds need documented set semantics.",
            "Formalize: external_path_fault when ∃ loadInstance component_verified at_load AND ∃ path_open through_path with loadInCircuit=true for same (componentId, loadInstanceKey); ignore step order.",
            "Identical to proven Gate 4 logic, explicitly documented and tested for reversed OEM order.",
            "No change when only Gate 4 witnesses run.",
            "Evidence interpretation only.",
            "Downstream derivation only; no matcher/ranking.",
        ),
        classify_concept(
            "multiplePathRefsPerConclusion",
            "REQUIRED",
            "One run may open multiple connector pin pairs (VCH7 cold and hot; dual pumps on J4).",
            "pathRefs array exists but primary headline picks one conclusion; policy for multiple opens undefined.",
            "Keep single DiagnosticConclusion per (componentId, loadInstanceKey) with pathRefs[]; primary resolver ranks external_path_fault and merges disjunctive headline.",
            "Gate 4 single pathRef is pathRefs length 1.",
            "Additive.",
            "Presentation/repair headline only.",
            "Presentation/repair headline only; no ranking.",
        ),
        classify_concept(
            "physicalTestSetup",
            "REQUIRED",
            "Stateful/positional tests (float up/down, door open/closed, isolated harness) are not through_path Ω.",
            "path_open requires loadInCircuit true; harness both-ends-open and door-state checkpoints are misclassified if forced into path_open.",
            "Optional measurementContext.physicalTestSetup enum-like string: isolated_harness_pin_pin | positional_switch | direct_at_terminals | supply_voltage_segment. Gating rule: path_open only when setup is through_path_in_circuit.",
            "Gate 4 uses through_path + loadInCircuit true; new setups block path_open eligibility.",
            "Procedure metadata only.",
            "Additive optional field.",
            "No ranking change.",
        ),
        classify_concept(
            "evidenceSubjectKey",
            "REQUIRED",
            "Overfill procedure attributes float evidence to inlet_valve incorrectly; need repair target without new canonical node.",
            "Single componentId on procedure forces wrong anchor for float P6 4&6 tests.",
            "Optional evidenceSubjectKey on effect (procedure-local slug: fill_valve_coil, overfill_float). Maps to conclusion anchorComponentId + repairTargetHint, not ontology.",
            "Gate 4 effects omit subject key → anchorComponentId only.",
            "Not a canonical component.",
            "Additive optional field.",
            "Conclusion derivation only.",
        ),
        classify_concept(
            "repairTargetHint",
            "REQUIRED",
            "Distinguish replace component vs harness vs inspect circuit vs control output vs sub-load.",
            "Headline uses external_path_fault generically; OEM has replace harness, replace float, suspect CCU.",
            "Optional on DiagnosticConclusion: repairTargetHint (procedure-local enum strings). Repair UI unchanged in Gate 7 — headline text mapping only.",
            "Gate 4 path-first headline maps from external_path_fault + hint default inspect_external_circuit.",
            "Hints only on scoped runs.",
            "Hints only on scoped runs.",
            "Presentation layer only.",
        ),
        classify_concept(
            "compoundPrimaryResolution",
            "USEFUL_BUT_NOT_REQUIRED",
            "Multiple conclusions in one run (valve good, float bad; drain path + recirc path).",
            "resolvePrimaryDiagnosticConclusion picks one kind; disjunctive OEM not structured.",
            "Policy table: contradicted > component_failed > external_path_fault > inconclusive; optional disjunctiveHeadline when multiple external_path_fault instances.",
            "Gate 4 single-anchor runs unchanged.",
            "Additive.",
            "Presentation only.",
            "Presentation only.",
        ),
        classify_concept(
            "measurementModality",
            "USEFUL_BUT_NOT_REQUIRED",
            "ACU power test is voltage segmentation, not Ω path.",
            "supply confirm effects mix cord, RFI, harness; path_open inappropriate.",
            "measurementContext.modality: voltage | resistance on measurement steps; derivation branch supply_segment_fault (existing confirm) not external_path_fault.",
            "Gate 4 resistance witnesses ignore modality.",
            "Additive metadata.",
            "Additive metadata.",
            "No ranking.",
        ),
        classify_concept(
            "evidencePhaseAnnotation",
            "USEFUL_BUT_NOT_REQUIRED",
            "Tech UX: label control-first vs load-first in UI without affecting causality.",
            "None required for correctness if evidenceSetDerivation is REQUIRED.",
            "Optional step annotation control_first | load_first for presentation.",
            "No effect on Gate 4 derivation.",
            "Display only.",
            "Display only.",
            "None.",
        ),
        classify_concept(
            "separateCanonicalFloatNode",
            "NOT_NEEDED",
            "N/A — rejected approach.",
            "Would pollute ontology.",
            "Use evidenceSubjectKey instead.",
            "N/A",
            "N/A",
            "N/A",
            "N/A",
        ),
        classify_concept(
            "newAssertionPathWireOpen",
            "NOT_NEEDED",
            "Isolated harness could tempt new assertion; design uses repairTargetHint + legacy confirm or future checkpoint assertion vocabulary in later gate.",
            "path_open semantics tied to in-circuit through_path.",
            "physicalTestSetup=isolated_harness_pin_pin blocks path_open; separate checkpoint effect vocabulary deferred.",
            "Gate 4 unchanged.",
            "N/A",
            "N/A",
            "N/A",
        ),
    ]


def dimension_analysis() -> dict[str, Any]:
    return {
        "A_multipleLoadsInstances": {
            "finding": "REQUIRED loadInstanceKey (procedure-local) separate from canonical componentId.",
            "examples": {
                "w8178558-inlet-valves": "cold_coil VCH7 1&3 and hot_coil VCH7 5&7 share inlet_valve",
                "w10864849-test-07-drain-recirc-pump": "drain_winding vs recirc_winding on J4; fix mis-tagged effects",
            },
            "ontologyRule": "Never mint canonical cold_coil; key lives on evidence only.",
        },
        "B_multiplePathReferences": {
            "finding": "REQUIRED — extend policy for pathRefs[] already in Gate 4 type; one conclusion per loadInstanceKey.",
            "gate4Status": "pathRefs array exists; compound policy incomplete.",
        },
        "C_acuFirstControlFirst": {
            "finding": "REQUIRED evidenceSetDerivation — order-independent pairing within run.",
            "examples": {
                "w10864849-test-07-drain-recirc-pump": "J4 pass then later pump_terminal_ohms pass still supports path fault if harness fails",
                "w8178558-door-lock": "CCU Ω before harness — not Gate 4 path_open without isolated harness handling",
            },
        },
        "D_compoundConclusions": {
            "finding": "REQUIRED loadInstanceKey + multiplePathRefs + compoundPrimaryResolution (USEFUL tier).",
            "minimumStructure": {
                "unitOfDerivation": "(procedureId, componentId, loadInstanceKey?)",
                "output": "DiagnosticConclusion[]",
                "primary": "resolvePrimaryDiagnosticConclusion with explicit multi-fault rules",
            },
        },
        "E_independentComponentAnchors": {
            "finding": "REQUIRED evidenceSubjectKey + repairTargetHint for w11633848-overfill-switch.",
            "example": "P6 4&6 float tests → subject overfill_float; P6 7&9 → fill_valve_coil; anchorComponentId may remain inlet_valve for valve-only or split conclusions by subject.",
        },
        "F_statefulPositionalTests": {
            "finding": "REQUIRED physicalTestSetup metadata; microwave negatives must use direct_at_terminals / positional_switch — never path_open.",
            "negativeControls": NEGATIVE_CONTROLS,
        },
        "G_voltageSegmentation": {
            "finding": "USEFUL measurementModality; do not use path_open. Keep legacy supply confirm for segment faults.",
            "procedure": "w11169652-test-01-acu-power",
            "futureConclusionKind": "Defer new conclusion kind; use structured supply segment metadata + existing confirm semantics.",
        },
        "H_repairResolution": {
            "finding": "REQUIRED repairTargetHint on conclusions; optional disjunctive targets list (USEFUL).",
            "mappingExamples": {
                "external_path_fault": "inspect_external_circuit (default)",
                "isolated_harness_failure": "replace_isolated_harness",
                "component_failed_at_load": "replace_component",
                "control_output_failure": "verify_or_replace_control",
            },
            "repairUI": "Unchanged in Gate 7 — mapping layer only.",
        },
    }


def procedure_examples() -> dict[str, Any]:
    return {
        "w8178558-door-lock": {
            "role": "design_case",
            "futureEvidenceShape": [
                "CCU DL3 measurements: component_failed/verified with physicalTestSetup=direct_at_control_connector, NOT path_open",
                "harness_continuity_check: physicalTestSetup=isolated_harness_pin_pin + repairTargetHint=replace_isolated_harness",
                "live_test: repairTargetHint=verify_control_output on control_board",
            ],
            "mustNot": "path_open on harness_bad with loadInCircuit true",
        },
        "w11169652-test-01-acu-power": {
            "role": "design_case_ambiguous",
            "futureEvidenceShape": [
                "measurementModality=voltage on each segment",
                "Segment-specific repairTargetHint: cord, rfi_filter, harness_j2, acu",
                "No component_verified at_load; no external_path_fault",
            ],
        },
        "w8178558-inlet-valves": {
            "role": "design_case",
            "futureEvidenceShape": [
                "valve_at_component: component_verified at_load for loadInstanceKey cold_coil and hot_coil (or two passes)",
                "valve_cold_ccu open: path_open through_path loadInCircuit true testPointKey ... cold_coil",
                "valve_hot_ccu open: separate pathRef hot_coil",
                "Outcome: external_path_fault per coil or merged disjunctive headline",
            ],
        },
        "w10864849-test-07-drain-recirc-pump": {
            "role": "design_case",
            "futureEvidenceShape": [
                "loadInstanceKey drain_winding / recirc_winding",
                "evidenceSetDerivation: terminal pass + J4 open qualifies path fault regardless of step order",
                "harness ph_open: isolated harness hint, not path_open on drain_pump",
            ],
        },
        "w11416787-test-07-drain-recirc-pump": {
            "role": "design_case",
            "note": "Same as W10864849 with J15 connector",
            "futureEvidenceShape": "Identical compound rules to w10864849-test-07",
        },
        "w11633848-overfill-switch": {
            "role": "design_case",
            "futureEvidenceShape": [
                "overfill_valve_ohms: evidenceSubjectKey=fill_valve_coil, component_verified/failed at control",
                "float_down/up: evidenceSubjectKey=overfill_float, positional_switch setup",
                "float_up pass on measurement_open is positional success, not path_open",
                "Conclusions: separate subjects; repairTargetHint replace_float_switch vs replace_fill_valve",
            ],
        },
        "lgotrmw-door-interlock": {
            "role": "negative_control",
            "treatment": "Remain legacy unscoped OR scoped component_failed/verified at_load with physicalTestSetup=direct_at_terminals only; never path_open; never external_path_fault.",
        },
        "samsungotrmw-door-interlock": {
            "role": "negative_control",
            "treatment": "Same as LG microwave interlock.",
        },
    }


def backward_compat() -> dict[str, Any]:
    return {
        "gate4Witnesses": "Unchanged seeds and behavior when new optional fields omitted.",
        "legacyEffects": "Effects without assertion continue current confirm/eliminate and repair headline rules.",
        "derivation": "runHasScopedDiagnosticAssertions false → empty conclusions → legacy presentation.",
        "risk": "Mis-set loadInstanceKey on old seeds could split conclusions — Gate 7 must only add keys on migrated seeds.",
    }


def gate7_boundary() -> dict[str, Any]:
    return {
        "inScope": [
            "Types + derivation policy for optional metadata fields (loadInstanceKey, physicalTestSetup, evidenceSubjectKey, repairTargetHint)",
            "Unit tests for evidenceSetDerivation and compound pathRefs",
            "Single-seed pilot only after design sign-off (likely w8178558-inlet-valves cold coil first)",
        ],
        "outOfScope": [
            "New EffectAssertion enum values without explicit approval",
            "Canonical ontology or harness nodes",
            "Matcher, ranking, continuation, WizardProvider",
            "Repair UI component changes",
            "Corpus-wide seed migration",
            "door-lock isolated harness until checkpoint assertion vocabulary approved",
            "ACU power voltage conclusion kind",
            "Microwave interlock scoping",
        ],
        "recommendedPilotOrder": [
            "w8178558-inlet-valves (cold coil path only)",
            "w10864849-test-07-drain-recirc-pump (after loadInstanceKey + evidence set)",
            "w11633848-overfill-switch (after evidenceSubjectKey)",
            "w8178558-door-lock (after isolated harness semantics)",
            "w11169652-test-01-acu-power (supply modality — separate track)",
        ],
    }


def build_artifact() -> dict[str, Any]:
    artifact = dict(DESIGN_FINDINGS)
    artifact["generatedAt"] = datetime.now(timezone.utc).isoformat()
    artifact["dimensionAnalysis"] = dimension_analysis()
    artifact["proposedMinimumModel"] = {
        "summary": (
            "Extend procedure evidence metadata and derivation policy without new assertion types. "
            "Gate 4 assertions unchanged. Compound behavior via optional keys + set-based derivation."
        ),
        "optionalFieldsOnDiagnosticEffect": [
            "loadInstanceKey?: string",
            "evidenceSubjectKey?: string",
        ],
        "optionalFieldsOnProcedureMeasurementContext": [
            "physicalTestSetup?: string",
            "modality?: 'resistance' | 'voltage'",
        ],
        "optionalFieldsOnDiagnosticConclusion": [
            "loadInstanceKey?: string",
            "evidenceSubjectKey?: string",
            "repairTargetHint?: string",
        ],
        "derivationRules": [
            "external_path_fault: component_verified at_load + valid path_open for same (componentId, loadInstanceKey)",
            "path_open valid only if measurementContext.loadInCircuit===true and physicalTestSetup is not isolated_harness_pin_pin",
            "Do not derive external_path_fault for direct_at_terminals interlock tests",
            "Order of steps irrelevant for pairing (evidence set)",
        ],
    }
    artifact["conceptInventory"] = build_concept_inventory()
    artifact["conceptTierCounts"] = {
        tier: sum(1 for c in artifact["conceptInventory"] if c["tier"] == tier)
        for tier in (
            "REQUIRED",
            "USEFUL_BUT_NOT_REQUIRED",
            "NOT_NEEDED",
        )
    }
    artifact["procedureExamples"] = procedure_examples()
    artifact["negativeControls"] = {
        "procedureIds": NEGATIVE_CONTROLS,
        "rule": "Scoped or legacy component-level only; block path_open and external_path_fault derivation.",
    }
    artifact["backwardCompatibility"] = backward_compat()
    artifact["gate7ImplementationBoundary"] = gate7_boundary()
    return artifact


def main() -> None:
    artifact = build_artifact()
    audit = {
        "schemaVersion": "1.0.0",
        "generatedAt": artifact["generatedAt"],
        "artifact": "CG_SCOPED_EVIDENCE_GATE6_DESIGN_v1.json",
        "executiveSummary": {
            "requiredConcepts": artifact["conceptTierCounts"]["REQUIRED"],
            "usefulConcepts": artifact["conceptTierCounts"]["USEFUL_BUT_NOT_REQUIRED"],
            "notNeededConcepts": artifact["conceptTierCounts"]["NOT_NEEDED"],
            "designCases": len(DESIGN_CASES),
            "negativeControls": len(NEGATIVE_CONTROLS),
            "provenWitnessesFrozen": len(PROVEN_WITNESSES),
        },
        "readOnly": True,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "CG_SCOPED_EVIDENCE_GATE6_DESIGN_v1.json"
    audit_path = OUT_DIR / "CG_SCOPED_EVIDENCE_GATE6_DESIGN_AUDIT_v1.json"
    path.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    audit_path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(f"Wrote {path}")
    print(f"Wrote {audit_path}")
    print(json.dumps(audit["executiveSummary"], indent=2))


if __name__ == "__main__":
    main()
