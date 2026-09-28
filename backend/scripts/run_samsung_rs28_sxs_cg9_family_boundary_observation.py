#!/usr/bin/env python3
"""CG-9 — Samsung RS28 SxS family-boundary discovery (read-only, no canonical mutation)."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANONICAL_FD = KNOWLEDGE / "canonical" / "french_door_refrigerator.json"
SEED_DIR = KNOWLEDGE / "procedures" / "seed" / "samsung_sxs"
OVERLAYS = KNOWLEDGE / "canonical" / "manufacturer_overlays"

MANUAL_ID = "SAMSUNG-RS28-SXS"
PLATFORM_ID = "samsung_sxs"
FROZEN_ONTOLOGY_ID = "french_door_refrigerator"
FROZEN_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
OUT_JSON = CALIBRATION / "SAMSUNG_RS28_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
OUT_REPORT = CALIBRATION / "SAMSUNG_RS28_SXS_REFRIGERATOR_FAMILY_BOUNDARY_REPORT_v1.md"

SUPPLEMENTARY_MANUALS = [
    {
        "manualId": "SAMSUNG-RS22T-SXS",
        "role": "model_routing_reuse",
        "note": "Reuses samsungrs28-* procedures — not primary evidence.",
    },
    {
        "manualId": "SAMSUNG-RF260B-FRIDGE",
        "role": "platform_sibling",
        "note": "Same samsung_sxs platform, CN30/CN76 map — topology variant only.",
    },
]

KEEP_FUNCTIONS = [
    "control_board",
    "user_interface",
    "door_switch",
    "evaporator_fan",
    "air_damper",
    "defrost_heater",
]

CONDITIONAL_FUNCTIONS = [
    "temperature_sensor",
    "compressor",
    "condenser_fan",
    "ice_maker",
    "water_dispenser",
]


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def count_procedures() -> dict[str, int]:
    if not SEED_DIR.is_dir():
        return {
            "rs28ProcedureSeeds": 0,
            "rf260bProcedureSeeds": 0,
            "totalProcedureSeedsOnPlatform": 0,
            "serviceModeBundles": 0,
            "proceduresWithMeasurementSteps": 0,
        }
    rs28 = list(SEED_DIR.glob("samsungrs28-*.json"))
    rf260 = list(SEED_DIR.glob("samsungrf260b-*.json"))
    bundles = list((SEED_DIR / "bundles").glob("*.json")) if (SEED_DIR / "bundles").is_dir() else []
    measurement_procs = 0
    for path in rs28 + rf260:
        doc = json.loads(path.read_text(encoding="utf-8"))
        if any(s.get("type") == "measurement" for s in doc.get("steps") or []):
            measurement_procs += 1
    return {
        "rs28ProcedureSeeds": len(rs28),
        "rf260bProcedureSeeds": len(rf260),
        "totalProcedureSeedsOnPlatform": len(rs28) + len(rf260),
        "serviceModeBundles": len(bundles),
        "proceduresWithMeasurementSteps": measurement_procs,
    }


def keep_function_evidence() -> list[dict[str, Any]]:
    return [
        {
            "concept": "control_board",
            "evidence": "Main PBA orchestrates engineer mode, self-diagnosis, force run/defrost, load status.",
            "procedureOrTest": [
                "samsungrs28-engineer-test-entry",
                "samsungrs28-self-diagnostic-entry",
                "samsungrs28-led-test-mode-entry",
            ],
            "functionalRole": "Refrigeration control orchestration",
            "configurationEffect": "SxS touch/LED panel entry paths — not a different control function.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "user_interface",
            "evidence": "41Er main↔display communication; demo/cooling-off display behavior.",
            "procedureOrTest": ["samsungrs28-panel-communication", "samsungrs28-led-test-mode-entry"],
            "functionalRole": "HMI / display surface",
            "configurationEffect": "Through-door dispenser UI may add 47Er path — still HMI domain.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "door_switch",
            "evidence": (
                "§5-4 door-alarm troubleshooting: F/R door sensing CN20 voltage (5 V open / 0 V closed) "
                "and reed switch Ω — no dedicated procedure seed yet."
            ),
            "procedureOrTest": ["manual §5-4 flowchart (svc manual p.99)"],
            "functionalRole": "Door authorization / alarm / fan interlock",
            "configurationEffect": "Dual vertical doors (F-door + R-door) vs french-door quadrants — same role.",
            "disposition": "shared_function",
            "confidence": "medium",
        },
        {
            "concept": "evaporator_fan",
            "evidence": "F-FAN feedback 22E; RS28 uses F+C fan pair (RF260B adds FF fan).",
            "procedureOrTest": [
                "samsungrs28-f-fan",
                "samsungrs28-c-fan",
                "samsungrf260b-fz-fan",
                "samsungrf260b-ff-fan",
            ],
            "functionalRole": "Compartment evaporator airflow",
            "configurationEffect": "RS28 two-fan topology vs RF260B three-fan — instance overlay, not new function.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "air_damper",
            "evidence": "R-room damper heater CN40 (48 Ω / 7–12 V); RD weak-FF routing.",
            "procedureOrTest": ["samsungrs28-damper-heater"],
            "functionalRole": "Fresh-food airflow regulation",
            "configurationEffect": "True-taste / R-room naming — same damper function as french-door flex paths.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "defrost_heater",
            "evidence": "F-DEF heater 63 Ω; RF260B adds separate FF defrost heater.",
            "procedureOrTest": [
                "samsungrs28-f-defrost-heater",
                "samsungrf260b-fz-defrost-heater",
                "samsungrf260b-ff-defrost-heater",
            ],
            "functionalRole": "Defrost heat actuation",
            "configurationEffect": "Single vs dual heater instances by model — compartment-scoped overlay.",
            "disposition": "shared_function",
            "confidence": "high",
        },
    ]


def conditional_function_evidence() -> list[dict[str, Any]]:
    return [
        {
            "concept": "temperature_sensor",
            "instanceScopes": ["freezer", "fresh_food", "ambient", "defrost", "pantry", "humidity"],
            "evidence": "F/R cabinet NTCs, F-DEF NTC, ambient, pantry (RF260B), humidity 14E.",
            "procedureOrTest": [
                "samsungrs28-f-sensor",
                "samsungrs28-r-sensor",
                "samsungrs28-f-def-sensor",
                "samsungrs28-ambient-sensor",
                "samsungrf260b-pantry-sensor",
                "samsungrs28-humidity-sensor",
            ],
            "roleAssessment": "same_functional_role",
            "disposition": "shared_function",
            "instanceSemantics": "Must preserve compartment scopes — do not collapse to one sensor.",
            "confidence": "high",
        },
        {
            "concept": "compressor",
            "evidence": "Inverter PBA 44Er/84C; force-run paths; IPM voltage checks.",
            "procedureOrTest": ["samsungrs28-inverter-communication"],
            "roleAssessment": "same_functional_role",
            "implementation": "inverter_pba_mediated (matches RF23BB bespoke, not relay Jazz)",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "condenser_fan",
            "evidence": "C-FAN 22C in §4-2 checklist — weak-FF complaint routing ties C-fan to fresh-food path.",
            "procedureOrTest": ["samsungrs28-c-fan"],
            "roleAssessment": "unresolved_implementation_ambiguity",
            "disposition": "needs_second_manual",
            "note": (
                "Procedure seed tags condenser_fan but manual routing suggests evaporator/convert path "
                "— same ambiguity class as Samsung RF23BB 22C. Not evidence for new canonical role."
            ),
            "confidence": "low",
        },
        {
            "concept": "ice_maker",
            "evidence": "In-door ice maker on RS28; ice pipe 33E; ice maker sensor/function procedures.",
            "procedureOrTest": [
                "samsungrs28-ice-maker-sensor",
                "samsungrs28-ice-maker-function",
                "samsungrs28-ice-pipe-heater",
            ],
            "roleAssessment": "same_functional_role",
            "configurationEffect": "In-door vs freezer-bin ice — optional feature placement only.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "water_dispenser",
            "evidence": "47Er dispenser panel comm; through-door dispense troubleshooting §5.",
            "procedureOrTest": ["samsungrs28-dispenser-communication"],
            "roleAssessment": "same_functional_role",
            "configurationEffect": "SxS external dispenser standard — stronger than french-door Jazz gap.",
            "disposition": "shared_function",
            "confidence": "high",
        },
    ]


def candidate_vocabulary() -> list[dict[str, Any]]:
    return [
        {"term": "main_pba", "classification": "shared_function", "mapsTo": "control_board"},
        {"term": "display_panel", "classification": "shared_function", "mapsTo": "user_interface"},
        {"term": "reed_door_switch", "classification": "shared_function", "mapsTo": "door_switch"},
        {"term": "f_fan", "classification": "shared_function", "mapsTo": "evaporator_fan"},
        {"term": "c_fan", "classification": "configuration_specific", "note": "Topology label — role ambiguous vs condenser_fan"},
        {"term": "damper_heater", "classification": "shared_function", "mapsTo": "air_damper"},
        {"term": "f_def_heater", "classification": "shared_function", "mapsTo": "defrost_heater"},
        {"term": "inverter_board", "classification": "implementation_specific", "mapsTo": "compressor_controller"},
        {"term": "io_expander", "classification": "implementation_specific", "mapsTo": "platform_comm_path"},
        {"term": "dispenser_panel", "classification": "implementation_specific", "mapsTo": "water_dispenser"},
        {"term": "in_door_ice_maker", "classification": "configuration_specific", "mapsTo": "ice_maker"},
        {"term": "pantry_sensor", "classification": "configuration_specific", "mapsTo": "temperature_sensor:pantry"},
        {"term": "humidity_sensor", "classification": "deferred", "mapsTo": "humidity_control"},
        {"term": "airflow_path", "classification": "shared_function", "note": "Decomposes to fan+damper — remains dead aggregate"},
        {"term": "defrost_system", "classification": "shared_function", "note": "Decomposes to heater+sensor — remains dead aggregate"},
        {"term": "dispenser_panel_as_hmi", "classification": "possible_new_canonical_function", "verdict": "rejected_pending_review", "note": "47Er is comm path for dispenser feature — not separate from user_interface canonically"},
    ]


def architectural_differences() -> list[dict[str, Any]]:
    return [
        {
            "area": "compartment_layout",
            "sxSEvidence": "Vertical F|Fz split doors (RS28) vs french-door quadrants",
            "functionalImpact": False,
            "layer": "configuration",
        },
        {
            "area": "fan_topology",
            "sxSEvidence": "RS28: F-fan + C-fan only; RF260B: FZ + FF + C fans",
            "functionalImpact": False,
            "layer": "configuration_instance_overlay",
        },
        {
            "area": "ice_placement",
            "sxSEvidence": "In-door ice on RS28 fridge door",
            "functionalImpact": False,
            "layer": "configuration_optional_feature",
        },
        {
            "area": "compressor_drive",
            "sxSEvidence": "Inverter PBA 44Er/84C — same class as RF23BB bespoke",
            "functionalImpact": False,
            "layer": "implementation",
        },
        {
            "area": "comm_architecture",
            "sxSEvidence": "IO expander 46Er, WiFi 52Er, dispenser 47Er — extra harness nodes",
            "functionalImpact": False,
            "layer": "implementation",
        },
        {
            "area": "door_sensing",
            "sxSEvidence": "Reed switches with CN20 F/R door voltage flowchart §5-4",
            "functionalImpact": False,
            "layer": "implementation",
        },
        {
            "area": "c_fan_role",
            "sxSEvidence": "22C tagged condenser_fan in seed but weak-FF routing",
            "functionalImpact": "unresolved",
            "layer": "needs_second_manual",
        },
    ]


def boundary_hypotheses() -> dict[str, Any]:
    return {
        "hypothesisA_shareFrenchDoorOntology": {
            "statement": "Side-by-side shares existing french_door_refrigerator functional ontology.",
            "status": "supported",
            "supportingEvidence": [
                "All six KEEP functions independently evidenced on RS28/SxS manual.",
                "Five conditional concepts map with same instance-semantics discipline.",
                "Removed aggregates (defrost_system, cooling_system, airflow_path) decompose identically.",
            ],
            "contradictoryEvidence": [
                "Ontology id/name says french_door — lexical mismatch with SxS configuration.",
            ],
            "conceptsThatWouldDiffer": [],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "SxS manual exposes a diagnostic functional role not expressible in frozen KEEP+conditional contract.",
        },
        "hypothesisB_broaderRefrigeratorOntology": {
            "statement": "French-door and side-by-side belong to a broader refrigerator ontology; current freeze is configuration-scoped naming.",
            "status": "supported",
            "supportingEvidence": [
                "Frozen ontology designPrinciples already model generic refrigeration behavior.",
                "SxS adds no new canonical functional nodes — only configuration/instance overlays.",
                "CG-8 compounding absorbed Jazz/inverter/linear without ontology mutation.",
            ],
            "contradictoryEvidence": [
                "CG-7 freeze artifact is explicitly french_door_refrigerator — organizational debt only.",
            ],
            "conceptsThatWouldDiffer": ["ontology_id", "variant_label"],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "A second non-Samsung SxS manual requires functional nodes outside frozen contract.",
        },
        "hypothesisC_distinctSideBySideOntology": {
            "statement": "Side-by-side requires a distinct canonical functional ontology.",
            "status": "contradicted",
            "supportingEvidence": [
                "SxS-specific harness nodes (IO expander, dispenser panel) are implementation vocabulary.",
            ],
            "contradictoryEvidence": [
                "No independent diagnostic functional role found that french_door contract cannot express.",
                "Physical side-by-side layout does not change control/cooling/defrost/airflow diagnostic model.",
            ],
            "conceptsThatWouldDiffer": [],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "Would require at least one KEEP/conditional concept unique to SxS — not observed.",
        },
        "hypothesisD_insufficientEvidence": {
            "statement": "Evidence insufficient to decide family boundary.",
            "status": "partially_unresolved",
            "supportingEvidence": [
                "Only Samsung SxS studied — no Whirlpool/Maytag/LG SxS triangulation yet.",
                "C-FAN vs condenser_fan role ambiguous on Samsung SxS.",
            ],
            "contradictoryEvidence": [
                "Strong single-manual functional alignment across all KEEP roles.",
                "Platform samsung_sxs already shares procedure patterns with french-door Samsung bespoke.",
            ],
            "conceptsThatWouldDiffer": [],
            "conceptsThatRemainShared": [],
            "falsification": "Non-Samsung SxS manual breaks functional alignment for ≥2 KEEP roles.",
            "nextManualRequirements": [
                "Whirlpool/Maytag W11296289 side-by-side (in corpus)",
                "Second Samsung SxS variant only if C-fan role remains ambiguous",
            ],
        },
    }


def build_observation() -> dict[str, Any]:
    fd = json.loads(CANONICAL_FD.read_text(encoding="utf-8"))
    proc_counts = count_procedures()
    overlay_hashes = {
        name: sha256_file(OVERLAYS / name)
        for name in [
            "whirlpool_jazz_french_door.json",
            "samsung_fridge_bespoke.json",
            "lg_lrmvs.json",
        ]
    }
    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg9_refrigerator_family_boundary_observation",
        "phase": "CG-9",
        "status": "discovery_only",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "canonicalExpansion": 0,
        "canonicalMutation": 0,
        "freezeReopened": False,
        "discoveryCorpusInheritance": 0,
        "sourceMetadata": {
            "primaryManualId": MANUAL_ID,
            "primaryPdf": "backend/docs/manuals/samsung rs28 sxs.pdf",
            "primaryExtractedText": "backend/docs/manuals/samsung rs28 sxs-extracted.txt",
            "supplementarySvcManual": "backend/docs/manuals/samsung-refrigerator-sxs-svc manual.pdf",
            "supplementaryExtractedText": "backend/docs/manuals/samsung-refrigerator-sxs-svc manual-extracted.txt",
            "extractionDoc": "frontend/components/diagnostics/knowledge/pattern-catalog/SAMSUNG_RS28_FRIDGE_EXTRACTION.md",
            "platformId": PLATFORM_ID,
            "manufacturer": "Samsung",
            "configuration": "side_by_side",
            "smokeModel": "RS28A500ASR",
            "procedureSeedDir": str(SEED_DIR.relative_to(ROOT)).replace("\\", "/"),
            "procedureCounts": proc_counts,
            "supplementaryManuals": SUPPLEMENTARY_MANUALS,
            "manualSelectionRationale": (
                "SAMSUNG-RS28-SXS is the richest SxS anchor: 17 RS28 procedure seeds + shared RF260B "
                "variants on samsung_sxs, full §4-2 self-diagnostic checklist, and cross-linked svc "
                "manual for door-switch flowcharts. RS22T reuses RS28 seeds; RF260B is platform sibling only."
            ),
        },
        "frozenOntologyReference": {
            "id": FROZEN_ONTOLOGY_ID,
            "revision": "rev1",
            "hash": FROZEN_HASH,
            "hashVerifiedAtGeneration": sha256_file(CANONICAL_FD) == FROZEN_HASH,
            "components": [c["id"] for c in fd["components"]],
            "conditionalConcepts": [c["id"] for c in fd.get("conditionalConcepts", [])],
        },
        "isolationGuards": {
            "cg7DiscoveryCorpusUsedAsInheritance": False,
            "cg8FrenchDoorOverlaysUsedAsEvidence": False,
            "priorOverlayHashesObserved": overlay_hashes,
            "sideBySideCanonicalOntologyCreated": False,
            "manufacturerOverlayPublished": False,
        },
        "candidateConceptVocabulary": candidate_vocabulary(),
        "sixKeepFunctionEvidence": keep_function_evidence(),
        "fiveConditionalFunctionEvidence": conditional_function_evidence(),
        "architecturalDifferences": architectural_differences(),
        "familyBoundaryHypotheses": boundary_hypotheses(),
        "possibleNewCanonicalFunctions": [
            {
                "proposedId": "dispenser_panel",
                "verdict": "rejected_at_discovery",
                "reason": "47Er dispenser comm implements water_dispenser/HMI path — not a new canonical function.",
                "inComponentsArray": False,
            }
        ],
        "unresolvedConcepts": [
            {
                "concept": "condenser_fan",
                "reason": "C-FAN 22C role ambiguous on Samsung SxS — evaporator-path vs condenser-path.",
            },
            {
                "concept": "humidity_control",
                "reason": "14E procedure exists but CG-7 deferred — single-manufacturer on SxS.",
            },
        ],
        "proposedNextManualRequirements": [
            {
                "manualId": "W11296289",
                "corpusPath": "backend/docs/manuals/Service-Manual-W11296289-Side-X-Side-Refrigerator.pdf",
                "purpose": "Non-Samsung SxS triangulation — falsify Hypothesis C/D.",
            },
            {
                "manualId": "SAMSUNG-RF260B-FRIDGE",
                "purpose": "Platform sibling — confirm fan/heater instance topology only.",
            },
        ],
        "recommendedNextStep": (
            "Run CG-9 R2 with Whirlpool W11296289 SxS before any canonical family decision. "
            "If R2 confirms functional alignment, treat french_door_refrigerator as operationally "
            "shared refrigerator functional ontology (Hypothesis A+B) and defer ontology rename to a "
            "future human re-freeze gate — do NOT create side_by_side_refrigerator.json from one Samsung manual."
        ),
    }


def build_report(obs: dict[str, Any]) -> str:
    hyps = obs["familyBoundaryHypotheses"]
    lines = [
        "# CG-9 — Samsung RS28 SxS Family Boundary Discovery Report",
        "",
        f"**Generated:** {obs['generatedAt']}",
        f"**Phase:** discovery only — canonical expansion = {obs['canonicalExpansion']}, freeze reopened = {obs['freezeReopened']}",
        "",
        "## Manual studied",
        "",
        f"- **Primary:** `{obs['sourceMetadata']['primaryManualId']}` ({obs['sourceMetadata']['smokeModel']})",
        f"- **Platform:** `{obs['sourceMetadata']['platformId']}`",
        f"- **Procedures:** {obs['sourceMetadata']['procedureCounts']['totalProcedureSeedsOnPlatform']} seeds "
        f"({obs['sourceMetadata']['procedureCounts']['proceduresWithMeasurementSteps']} with measurement steps)",
        "",
        obs["sourceMetadata"]["manualSelectionRationale"],
        "",
        "## Six KEEP functions (SxS independent evidence)",
        "",
        "| Concept | Disposition | Confidence |",
        "|---------|-------------|------------|",
    ]
    for row in obs["sixKeepFunctionEvidence"]:
        lines.append(f"| {row['concept']} | {row['disposition']} | {row['confidence']} |")
    lines.extend(
        [
            "",
            "## Five conditional concepts",
            "",
            "| Concept | Assessment | Disposition |",
            "|---------|------------|-------------|",
        ]
    )
    for row in obs["fiveConditionalFunctionEvidence"]:
        lines.append(
            f"| {row['concept']} | {row.get('roleAssessment', row.get('disposition'))} | {row['disposition']} |"
        )
    lines.extend(
        [
            "",
            "## Family-boundary hypotheses (evidence status only)",
            "",
        ]
    )
    for key, h in hyps.items():
        lines.append(f"### {key}")
        lines.append(f"- **Status:** {h['status']}")
        lines.append(f"- {h['statement']}")
        lines.append("")
    lines.extend(
        [
            "## Recommended next step",
            "",
            obs["recommendedNextStep"],
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    print("==> CG-9 Samsung RS28 SxS family-boundary discovery (read-only)")
    obs = build_observation()
    OUT_JSON.write_text(json.dumps(obs, indent=2), encoding="utf-8")
    OUT_REPORT.write_text(build_report(obs), encoding="utf-8")
    print(f"canonical hash verified: {obs['frozenOntologyReference']['hashVerifiedAtGeneration']}")
    print(f"KEEP shared: {sum(1 for r in obs['sixKeepFunctionEvidence'] if r['disposition']=='shared_function')}/6")
    print(f"artifact: {OUT_JSON}")
    print(f"report:   {OUT_REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
