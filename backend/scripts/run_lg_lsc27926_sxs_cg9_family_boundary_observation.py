#!/usr/bin/env python3
"""CG-9 — LG LSC27926 SxS family-boundary discovery (read-only, no canonical mutation)."""

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
SEED_DIR = KNOWLEDGE / "procedures" / "seed" / "lg_sxs"
OVERLAYS = KNOWLEDGE / "canonical" / "manufacturer_overlays"

MANUAL_ID = "LG-LSC27926-SXS"
PLATFORM_ID = "lg_sxs"
FROZEN_ONTOLOGY_ID = "french_door_refrigerator"
FROZEN_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
OUT_JSON = CALIBRATION / "LG_LSC27926_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
OUT_REPORT = CALIBRATION / "LG_LSC27926_SXS_REFRIGERATOR_FAMILY_BOUNDARY_REPORT_v1.md"

R2_ARTIFACT = CALIBRATION / "CG9_SXS_REFRIGERATOR_FAMILY_BOUNDARY_R2_TRIANGULATION_v1.json"

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
            "lgsxsProcedureSeeds": 0,
            "totalProcedureSeedsOnPlatform": 0,
            "serviceModeBundles": 0,
            "proceduresWithMeasurementSteps": 0,
        }
    seeds = list(SEED_DIR.glob("lgsxs-*.json"))
    bundles = list((SEED_DIR / "bundles").glob("*.json")) if (SEED_DIR / "bundles").is_dir() else []
    measurement_procs = 0
    for path in seeds:
        doc = json.loads(path.read_text(encoding="utf-8"))
        if any(s.get("type") == "measurement" for s in doc.get("steps") or []):
            measurement_procs += 1
    return {
        "lgsxsProcedureSeeds": len(seeds),
        "totalProcedureSeedsOnPlatform": len(seeds),
        "serviceModeBundles": len(bundles),
        "proceduresWithMeasurementSteps": measurement_procs,
    }


def keep_function_evidence() -> list[dict[str, Any]]:
    return [
        {
            "concept": "control_board",
            "evidence": "Main PCB MICOM test-mode orchestration — Test 1 all loads, Test 2 defrost.",
            "procedureOrTest": ["lgsxs-test-mode-entry"],
            "functionalRole": "Refrigeration control orchestration",
            "configurationEffect": "SxS test-button entry — not a different control function.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "user_interface",
            "evidence": "§2-16 LCD/LED graphics check; §1-11 main↔display MICOM communication.",
            "procedureOrTest": ["lgsxs-lcd-check", "lgsxs-display-communication"],
            "functionalRole": "HMI / display surface",
            "configurationEffect": "Through-door dispenser UI on LSC27926** — still HMI domain.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "door_switch",
            "evidence": (
                "§1-4 door switches A/B/C/D in parallel; Test 1 fan stops on door open — "
                "dedicated procedure seed with independent diagnostic path."
            ),
            "procedureOrTest": ["lgsxs-door-switch"],
            "functionalRole": "Door authorization / fan interlock",
            "configurationEffect": "Dual vertical doors (F + R) — same role as other SxS configs.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "evaporator_fan",
            "evidence": "F-FAN BLDC freezer evaporator fan in Test 1 high RPM.",
            "procedureOrTest": ["lgsxs-fz-fan"],
            "functionalRole": "Compartment evaporator airflow",
            "configurationEffect": "Single F-FAN SxS topology — instance overlay, not new function.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "air_damper",
            "evidence": "Stepping motor baffle Test 1 open / Test 2 closed; OptiChill damper.",
            "procedureOrTest": ["lgsxs-damper"],
            "functionalRole": "Fresh-food airflow regulation",
            "configurationEffect": "OptiChill adds LG-specific instance — same damper function.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "defrost_heater",
            "evidence": "Test 2 forces defrost heater ON; troubleshooting flowchart CON2 voltage.",
            "procedureOrTest": ["lgsxs-defrost-heater"],
            "functionalRole": "Defrost heat actuation",
            "configurationEffect": "Single defrost heater on SxS — direct canonical mapping.",
            "disposition": "shared_function",
            "confidence": "high",
        },
    ]


def conditional_function_evidence() -> list[dict[str, Any]]:
    return [
        {
            "concept": "temperature_sensor",
            "instanceScopes": ["freezer", "fresh_food", "ambient", "defrost"],
            "evidence": "CON7 freezer, CON8 cold storage 1&2, ambient Better1, defrost NTC.",
            "procedureOrTest": [
                "lgsxs-freezer-sensor",
                "lgsxs-fresh-food-sensor",
                "lgsxs-ambient-sensor",
                "lgsxs-defrost-sensor",
            ],
            "roleAssessment": "same_functional_role",
            "disposition": "shared_function",
            "instanceSemantics": "Must preserve compartment scopes — defrost NTC is platform layer.",
            "confidence": "high",
        },
        {
            "concept": "compressor",
            "evidence": "RY2 conventional relay drive in Test 1 — not LRMVS linear inverter.",
            "procedureOrTest": ["lgsxs-compressor"],
            "roleAssessment": "same_functional_role",
            "implementation": "relay_drive_conventional (matches Whirlpool EM3Y60 class, not Samsung inverter)",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "condenser_fan",
            "evidence": "C-FAN BLDC runs with compressor in Test 1 — explicit procedure evidence.",
            "procedureOrTest": ["lgsxs-condenser-fan"],
            "roleAssessment": "same_functional_role",
            "disposition": "shared_function",
            "note": (
                "Unlike Samsung RS28 C-fan ambiguity, LG C-FAN is explicitly condenser-path "
                "in Test 1 load table."
            ),
            "confidence": "high",
        },
        {
            "concept": "ice_maker",
            "evidence": "§3 in-door ice maker electrical on LSC27926** models.",
            "procedureOrTest": ["lgsxs-ice-maker"],
            "roleAssessment": "same_functional_role",
            "configurationEffect": "In-door ice on fridge door — optional feature placement only.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "water_dispenser",
            "evidence": "§2-18 water/ice dispenser valves RY4/RY5/RY7/RY12.",
            "procedureOrTest": ["lgsxs-water-dispenser"],
            "roleAssessment": "same_functional_role",
            "configurationEffect": "SxS external dispenser standard on LSC27926**.",
            "disposition": "shared_function",
            "confidence": "high",
        },
    ]


def candidate_vocabulary() -> list[dict[str, Any]]:
    return [
        {"term": "main_micom", "classification": "shared_function", "mapsTo": "control_board"},
        {"term": "display_micom", "classification": "shared_function", "mapsTo": "user_interface"},
        {"term": "door_switch_abcd", "classification": "shared_function", "mapsTo": "door_switch"},
        {"term": "f_fan", "classification": "shared_function", "mapsTo": "evaporator_fan"},
        {"term": "c_fan", "classification": "shared_function", "mapsTo": "condenser_fan"},
        {"term": "stepping_damper", "classification": "shared_function", "mapsTo": "air_damper"},
        {"term": "optichill_damper", "classification": "configuration_specific", "mapsTo": "air_damper:optichill"},
        {"term": "compressor_relay_ry2", "classification": "implementation_specific", "mapsTo": "compressor_controller"},
        {"term": "defrost_sensor", "classification": "implementation_specific", "mapsTo": "defrost_sensor"},
        {"term": "bldc_fan_drive", "classification": "implementation_specific", "mapsTo": "fan_controller"},
        {"term": "in_door_ice_maker", "classification": "configuration_specific", "mapsTo": "ice_maker"},
        {"term": "water_tank_sensor", "classification": "deferred", "mapsTo": "water_dispenser"},
        {"term": "r2_sensor", "classification": "deferred", "mapsTo": "temperature_sensor"},
        {"term": "humidity_sensor", "classification": "deferred", "mapsTo": "humidity_control"},
        {"term": "linear_compressor", "classification": "rejected", "mapsTo": "lg_lrmvs platform only"},
        {"term": "airflow_path", "classification": "shared_function", "note": "Decomposes to fan+damper — remains dead aggregate"},
        {"term": "defrost_system", "classification": "shared_function", "note": "Decomposes to heater+sensor — remains dead aggregate"},
    ]


def architectural_differences() -> list[dict[str, Any]]:
    return [
        {
            "area": "compartment_layout",
            "sxSEvidence": "Vertical F|R split doors (LSC27926) vs french-door quadrants",
            "functionalImpact": False,
            "layer": "configuration",
        },
        {
            "area": "compressor_drive",
            "sxSEvidence": "Conventional RY2 relay — NOT LRMVS linear inverter",
            "functionalImpact": False,
            "layer": "implementation",
        },
        {
            "area": "fan_topology",
            "sxSEvidence": "BLDC F-FAN (evap) + C-FAN (condenser) in Test 1",
            "functionalImpact": False,
            "layer": "configuration_instance_overlay",
        },
        {
            "area": "damper_topology",
            "sxSEvidence": "Stepping baffle + OptiChill stepping damper",
            "functionalImpact": False,
            "layer": "configuration_instance_overlay",
        },
        {
            "area": "comm_architecture",
            "sxSEvidence": "4-wire main MICOM ↔ display MICOM harness",
            "functionalImpact": False,
            "layer": "implementation",
        },
        {
            "area": "door_sensing",
            "sxSEvidence": "Switches A/B/C/D parallel with Test 1 fan-stop evidence",
            "functionalImpact": False,
            "layer": "implementation",
        },
        {
            "area": "ice_placement",
            "sxSEvidence": "In-door ice maker on LSC27926** fridge door",
            "functionalImpact": False,
            "layer": "configuration_optional_feature",
        },
    ]


def boundary_hypotheses() -> dict[str, Any]:
    return {
        "hypothesisA_shareFrenchDoorOntology": {
            "statement": "LG SxS shares existing french_door_refrigerator functional ontology.",
            "status": "supported",
            "supportingEvidence": [
                "All six KEEP functions independently evidenced on LSC27926 manual.",
                "Five conditional concepts map with same instance-semantics discipline.",
                "Removed aggregates (defrost_system, cooling_system, airflow_path) decompose identically.",
                "CG-9 R2 triangulation with Samsung + Whirlpool SxS already supported family boundary.",
            ],
            "contradictoryEvidence": [
                "Ontology id/name says french_door — lexical mismatch with SxS configuration.",
            ],
            "conceptsThatWouldDiffer": [],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "LSC27926 exposes a diagnostic functional role not expressible in frozen KEEP+conditional contract.",
        },
        "hypothesisB_broaderRefrigeratorOntology": {
            "statement": "French-door and side-by-side belong to a broader refrigerator ontology; current freeze is configuration-scoped naming.",
            "status": "supported",
            "supportingEvidence": [
                "Frozen ontology designPrinciples already model generic refrigeration behavior.",
                "LSC27926 adds no new canonical functional nodes — only configuration/instance overlays.",
                "CG-9 R2 triangulation across Samsung + Whirlpool SxS confirmed no ontology mutation needed.",
            ],
            "contradictoryEvidence": [
                "CG-7 freeze artifact is explicitly french_door_refrigerator — organizational debt only.",
            ],
            "conceptsThatWouldDiffer": ["ontology_id", "variant_label"],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "LSC27926 requires functional nodes outside frozen contract.",
        },
        "hypothesisC_distinctSideBySideOntology": {
            "statement": "LG SxS requires a distinct canonical functional ontology.",
            "status": "contradicted",
            "supportingEvidence": [
                "OptiChill damper and MICOM comm are implementation vocabulary.",
            ],
            "contradictoryEvidence": [
                "No independent diagnostic functional role found that french_door contract cannot express.",
                "Conventional relay compressor aligns with Whirlpool SxS class, not a new function.",
            ],
            "conceptsThatWouldDiffer": [],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "Would require at least one KEEP/conditional concept unique to LG SxS — not observed.",
        },
        "hypothesisD_insufficientEvidence": {
            "statement": "Evidence insufficient to decide family boundary for LG SxS.",
            "status": "contradicted",
            "supportingEvidence": [],
            "contradictoryEvidence": [
                "CG-9 R2 already triangulated Samsung + Whirlpool SxS.",
                "LSC27926 strengthens relay-drive + dedicated door-switch evidence.",
                "Strong single-manual functional alignment across all KEEP roles.",
            ],
            "conceptsThatWouldDiffer": [],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "LSC27926 breaks functional alignment for ≥2 KEEP roles — not observed.",
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
            "samsung_sxs.json",
            "whirlpool_sxs_w11296289.json",
        ]
        if (OVERLAYS / name).is_file()
    }
    r2_ref = None
    if R2_ARTIFACT.is_file():
        r2_ref = {
            "artifact": R2_ARTIFACT.name,
            "verdict": json.loads(R2_ARTIFACT.read_text(encoding="utf-8")).get("triangulationVerdict"),
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
            "primaryPdf": "backend/docs/manuals/LGSxS.pdf",
            "primaryExtractedText": "backend/docs/manuals/LGSxS-extracted.txt",
            "extractionDoc": "frontend/components/diagnostics/knowledge/pattern-catalog/LG_LSC27926_SXS_EXTRACTION.md",
            "platformId": PLATFORM_ID,
            "manufacturer": "LG",
            "configuration": "side_by_side",
            "smokeModel": "LSC27926ST",
            "procedureSeedDir": str(SEED_DIR.relative_to(ROOT)).replace("\\", "/"),
            "procedureCounts": proc_counts,
            "manualSelectionRationale": (
                "LG-LSC27926-SXS is the LG SxS anchor: 14 lgsxs-* procedure seeds + test-mode bundle, "
                "conventional relay compressor (distinct from lg_lrmvs linear), BLDC F/C fans, "
                "OptiChill damper, and dedicated door-switch procedure with Test 1 fan-stop evidence."
            ),
            "cg9R2TriangulationReference": r2_ref,
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
            "cg9R2TriangulationUsedAsAutoApproval": False,
            "priorOverlayHashesObserved": overlay_hashes,
            "sideBySideCanonicalOntologyCreated": False,
            "manufacturerOverlayPublished": False,
            "lrmvsLinearOverlayNotImported": True,
        },
        "candidateConceptVocabulary": candidate_vocabulary(),
        "sixKeepFunctionEvidence": keep_function_evidence(),
        "fiveConditionalFunctionEvidence": conditional_function_evidence(),
        "architecturalDifferences": architectural_differences(),
        "familyBoundaryHypotheses": boundary_hypotheses(),
        "possibleNewCanonicalFunctions": [
            {
                "proposedId": "optichill_damper",
                "verdict": "rejected_at_discovery",
                "reason": "OptiChill is LG-specific air_damper instance — not a new canonical function.",
                "inComponentsArray": False,
            },
            {
                "proposedId": "display_micom",
                "verdict": "rejected_at_discovery",
                "reason": "Display MICOM comm implements user_interface/HMI path — not separate canonical.",
                "inComponentsArray": False,
            },
        ],
        "unresolvedConcepts": [
            {
                "concept": "humidity_control",
                "reason": "No humidity sensor on LSC27926 — CG-7 deferred.",
            },
            {
                "concept": "r2_sensor",
                "reason": "LCD check reveals R2 fault but no standalone procedure seed.",
            },
            {
                "concept": "water_tank_sensor",
                "reason": "LCD check reveals water-tank fault but no procedure seed.",
            },
        ],
        "proposedNextManualRequirements": [],
        "recommendedNextStep": (
            "Proceed to CG-9.5 WP3 production compounding for LSC27926 SxS. "
            "CG-9 R2 triangulation already closed family boundary — this observation confirms "
            "LG SxS aligns with frozen refrigerator contract without canonical expansion. "
            "Do NOT import lg_lrmvs linear-compressor vocabulary."
        ),
    }


def build_report(obs: dict[str, Any]) -> str:
    hyps = obs["familyBoundaryHypotheses"]
    lines = [
        "# CG-9 — LG LSC27926 SxS Family Boundary Discovery Report",
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
    print("==> CG-9 LG LSC27926 SxS family-boundary discovery (read-only)")
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
