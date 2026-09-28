#!/usr/bin/env python3
"""CG-9 — Midea RSS SxS family-boundary discovery (read-only, no canonical mutation)."""

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
SEED_DIR = KNOWLEDGE / "procedures" / "seed" / "midea_rss"
OVERLAYS = KNOWLEDGE / "canonical" / "manufacturer_overlays"

MANUAL_ID = "MIDEA-RSS-FRIDGE"
PLATFORM_ID = "midea_rss"
FROZEN_ONTOLOGY_ID = "french_door_refrigerator"
FROZEN_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
OUT_JSON = CALIBRATION / "MIDEA_RSS_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
OUT_REPORT = CALIBRATION / "MIDEA_RSS_SXS_REFRIGERATOR_FAMILY_BOUNDARY_REPORT_v1.md"

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
            "midearssProcedureSeeds": 0,
            "totalProcedureSeedsOnPlatform": 0,
            "serviceModeBundles": 0,
            "proceduresWithMeasurementSteps": 0,
        }
    seeds = list(SEED_DIR.glob("midearss-*.json"))
    bundles = list((SEED_DIR / "bundles").glob("*.json")) if (SEED_DIR / "bundles").is_dir() else []
    measurement_procs = 0
    for path in seeds:
        doc = json.loads(path.read_text(encoding="utf-8"))
        if any(s.get("type") == "measurement" for s in doc.get("steps") or []):
            measurement_procs += 1
    return {
        "midearssProcedureSeeds": len(seeds),
        "totalProcedureSeedsOnPlatform": len(seeds),
        "serviceModeBundles": len(bundles),
        "proceduresWithMeasurementSteps": measurement_procs,
    }


def keep_function_evidence() -> list[dict[str, Any]]:
    return [
        {
            "concept": "control_board",
            "evidence": "§10.5 mandatory mode (LOCK + FRZ.TEMP 3 s) — forced compressor / ice-maker orchestration.",
            "procedureOrTest": ["midearss-mandatory-mode-entry"],
            "functionalRole": "Refrigeration control orchestration",
            "configurationEffect": "SxS mandatory-mode entry — not a different control function.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "user_interface",
            "evidence": "§10.8 E6 display↔main CN9 communication failure diagnostic.",
            "procedureOrTest": ["midearss-communication"],
            "functionalRole": "HMI / display surface",
            "configurationEffect": "Through-door dispenser UI on RSS26 — still HMI domain.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "door_switch",
            "evidence": (
                "E9 high-temp alarm flowchart references door switches but no standalone "
                "door-switch procedure seed on midea_rss."
            ),
            "procedureOrTest": [],
            "functionalRole": "Door authorization / fan interlock",
            "configurationEffect": "Dual vertical doors — same role as other SxS configs.",
            "disposition": "insufficient_procedure_evidence",
            "confidence": "medium",
        },
        {
            "concept": "evaporator_fan",
            "evidence": "No evaporator-fan procedure seed on midea_rss platform.",
            "procedureOrTest": [],
            "functionalRole": "Compartment evaporator airflow",
            "configurationEffect": "Single-evaporator SxS topology — deferred.",
            "disposition": "deferred_no_seed",
            "confidence": "medium",
        },
        {
            "concept": "air_damper",
            "evidence": "No damper / baffle procedure seed on NS-RSS26 extraction.",
            "procedureOrTest": [],
            "functionalRole": "Fresh-food airflow regulation",
            "configurationEffect": "Deferred until seed exists.",
            "disposition": "deferred_no_seed",
            "confidence": "medium",
        },
        {
            "concept": "defrost_heater",
            "evidence": "§6.3 / §8.6 freezer defrost heater 115 V 240 W (~55 Ω).",
            "procedureOrTest": ["midearss-fz-defrost-heater"],
            "functionalRole": "Defrost heat actuation",
            "configurationEffect": "Single freezer defrost heater on SxS — direct canonical mapping.",
            "disposition": "shared_function",
            "confidence": "high",
        },
    ]


def conditional_function_evidence() -> list[dict[str, Any]]:
    return [
        {
            "concept": "temperature_sensor",
            "instanceScopes": ["freezer", "fresh_food", "ambient", "defrost"],
            "evidence": "E1 RC, E2 FZ, E7 ambient cabinet NTCs; E4/E5 defrost NTCs as platform layer.",
            "procedureOrTest": [
                "midearss-rc-temp-sensor",
                "midearss-fz-temp-sensor",
                "midearss-ambient-sensor",
                "midearss-rc-defrost-sensor",
                "midearss-fz-defrost-sensor",
            ],
            "roleAssessment": "same_functional_role",
            "disposition": "shared_function",
            "instanceSemantics": "B3839 NTC spec — defrost NTC is platform layer, not cabinet collapse.",
            "confidence": "high",
        },
        {
            "concept": "compressor",
            "evidence": "§11.2 VFD inverter fault LED — variable-frequency drive path.",
            "procedureOrTest": ["midearss-vfd-inverter"],
            "roleAssessment": "same_functional_role",
            "implementation": "vfd_mediated (distinct from Samsung inverter PBA and LG relay-drive)",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "condenser_fan",
            "evidence": "No condenser_fan procedure seed on midea_rss.",
            "procedureOrTest": [],
            "roleAssessment": "deferred",
            "disposition": "deferred_no_seed",
            "confidence": "medium",
        },
        {
            "concept": "ice_maker",
            "evidence": "§10.8 E0 ice maker fault + EE sensor circuit.",
            "procedureOrTest": ["midearss-ice-maker", "midearss-ice-maker-sensor"],
            "roleAssessment": "same_functional_role",
            "configurationEffect": "Optional in-door ice on RSS26.",
            "disposition": "shared_function",
            "confidence": "high",
        },
        {
            "concept": "water_dispenser",
            "evidence": "EH/EF/CA/EP codes in manual but no dispenser procedure seed.",
            "procedureOrTest": [],
            "roleAssessment": "deferred",
            "disposition": "deferred_not_on_manual",
            "confidence": "medium",
        },
    ]


def candidate_vocabulary() -> list[dict[str, Any]]:
    return [
        {"term": "main_control", "classification": "shared_function", "mapsTo": "control_board"},
        {"term": "display_panel", "classification": "shared_function", "mapsTo": "user_interface"},
        {"term": "cn9_communication", "classification": "implementation_specific", "mapsTo": "display_communication"},
        {"term": "vfd_inverter", "classification": "implementation_specific", "mapsTo": "compressor_controller"},
        {"term": "b3839_ntc", "classification": "implementation_specific", "mapsTo": "temperature_sensor"},
        {"term": "e4_defrost_ntc", "classification": "implementation_specific", "mapsTo": "defrost_sensor:fresh_food"},
        {"term": "e5_defrost_ntc", "classification": "implementation_specific", "mapsTo": "defrost_sensor:freezer"},
        {"term": "mandatory_mode", "classification": "shared_function", "mapsTo": "control_board"},
        {"term": "ice_maker_module", "classification": "configuration_specific", "mapsTo": "ice_maker"},
        {"term": "door_switch", "classification": "deferred", "mapsTo": "door_switch"},
        {"term": "linear_compressor", "classification": "rejected", "mapsTo": "lg_lrmvs platform only"},
        {"term": "inverter_pba", "classification": "rejected", "mapsTo": "samsung_sxs platform only"},
        {"term": "compressor_relay", "classification": "rejected", "mapsTo": "lg_sxs platform only"},
        {"term": "airflow_path", "classification": "shared_function", "note": "Decomposes to fan+damper — remains dead aggregate"},
        {"term": "defrost_system", "classification": "shared_function", "note": "Decomposes to heater+sensor — remains dead aggregate"},
    ]


def architectural_differences() -> list[dict[str, Any]]:
    return [
        {
            "area": "compartment_layout",
            "sxSEvidence": "Vertical F|R split doors (NS-RSS26) vs french-door quadrants",
            "functionalImpact": False,
            "layer": "configuration",
        },
        {
            "area": "compressor_drive",
            "sxSEvidence": "VFD inverter board §11.2 — NOT LRMVS linear or LG relay-drive",
            "functionalImpact": False,
            "layer": "implementation",
        },
        {
            "area": "ntc_topology",
            "sxSEvidence": "B3839 ~2.0 kΩ @ 25°C — distinct from generic 5–16 kΩ Whirlpool/LG specs",
            "functionalImpact": False,
            "layer": "implementation",
        },
        {
            "area": "comm_architecture",
            "sxSEvidence": "CN9 main control ↔ display panel harness (E6)",
            "functionalImpact": False,
            "layer": "implementation",
        },
        {
            "area": "door_sensing",
            "sxSEvidence": "Referenced in E9 flowchart but no standalone door-switch seed",
            "functionalImpact": False,
            "layer": "deferred",
        },
        {
            "area": "ice_placement",
            "sxSEvidence": "E0/EE in-door ice maker on RSS26",
            "functionalImpact": False,
            "layer": "configuration_optional_feature",
        },
    ]


def boundary_hypotheses() -> dict[str, Any]:
    return {
        "hypothesisA_shareFrenchDoorOntology": {
            "statement": "Midea RSS SxS shares existing french_door_refrigerator functional ontology.",
            "status": "supported",
            "supportingEvidence": [
                "Three KEEP functions independently evidenced (control_board, user_interface, defrost_heater).",
                "Compressor and NTC scopes map with same instance-semantics discipline.",
                "Removed aggregates decompose identically.",
                "CG-9 R2 triangulation with Samsung + Whirlpool + LG SxS already supported family boundary.",
            ],
            "contradictoryEvidence": [
                "door_switch, evaporator_fan, air_damper lack procedure seeds — abstention required.",
            ],
            "conceptsThatWouldDiffer": [],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "NS-RSS26 exposes a diagnostic functional role not expressible in frozen KEEP+conditional contract.",
        },
        "hypothesisB_broaderRefrigeratorOntology": {
            "statement": "French-door and side-by-side belong to a broader refrigerator ontology; current freeze is configuration-scoped naming.",
            "status": "supported",
            "supportingEvidence": [
                "Frozen ontology designPrinciples already model generic refrigeration behavior.",
                "NS-RSS26 adds no new canonical functional nodes — only configuration/instance overlays.",
            ],
            "contradictoryEvidence": [
                "CG-7 freeze artifact is explicitly french_door_refrigerator — organizational debt only.",
            ],
            "conceptsThatWouldDiffer": ["ontology_id", "variant_label"],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "NS-RSS26 requires functional nodes outside frozen contract.",
        },
        "hypothesisC_distinctSideBySideOntology": {
            "statement": "Midea RSS SxS requires a distinct canonical functional ontology.",
            "status": "contradicted",
            "supportingEvidence": [
                "VFD inverter and B3839 NTC are implementation vocabulary.",
            ],
            "contradictoryEvidence": [
                "No independent diagnostic functional role found that french_door contract cannot express.",
                "VFD compressor aligns with conditionalConcept pattern used by Samsung SxS.",
            ],
            "conceptsThatWouldDiffer": [],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "Would require at least one KEEP/conditional concept unique to Midea RSS — not observed.",
        },
        "hypothesisD_insufficientEvidence": {
            "statement": "Evidence insufficient to decide family boundary for Midea RSS SxS.",
            "status": "contradicted",
            "supportingEvidence": [],
            "contradictoryEvidence": [
                "CG-9 R2 already triangulated three prior SxS platforms.",
                "NS-RSS26 E-family + VFD seeds provide strong single-manual alignment.",
            ],
            "conceptsThatWouldDiffer": [],
            "conceptsThatRemainShared": KEEP_FUNCTIONS + CONDITIONAL_FUNCTIONS,
            "falsification": "NS-RSS26 breaks functional alignment for ≥2 KEEP roles — not observed for evidenced roles.",
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
            "lg_sxs.json",
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
            "primaryPdf": "backend/docs/manuals/NS-RSS26SS Service Manual.pdf",
            "primaryExtractedText": "backend/docs/manuals/NS-RSS26SS Service Manual-extracted.txt",
            "extractionDoc": (
                "frontend/components/diagnostics/knowledge/pattern-catalog/"
                "MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md"
            ),
            "platformId": PLATFORM_ID,
            "manufacturer": "Midea/Insignia",
            "configuration": "side_by_side",
            "smokeModel": "NS-RSS26SS",
            "procedureSeedDir": str(SEED_DIR.relative_to(ROOT)).replace("\\", "/"),
            "procedureCounts": proc_counts,
            "manualSelectionRationale": (
                "MIDEA-RSS-FRIDGE is the Midea/Insignia SxS anchor: 11 midearss-* procedure seeds + "
                "mandatory-mode bundle, VFD compressor (distinct from lg_lrmvs linear and lg_sxs relay), "
                "B3839 NTC E-family, and E6 CN9 display communication."
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
            "priorSxsOverlayNotImported": True,
        },
        "candidateConceptVocabulary": candidate_vocabulary(),
        "sixKeepFunctionEvidence": keep_function_evidence(),
        "fiveConditionalFunctionEvidence": conditional_function_evidence(),
        "architecturalDifferences": architectural_differences(),
        "familyBoundaryHypotheses": boundary_hypotheses(),
        "possibleNewCanonicalFunctions": [
            {
                "proposedId": "vfd_inverter_board",
                "verdict": "rejected_at_discovery",
                "reason": "VFD is Midea-specific compressor_controller instance — not a new canonical function.",
                "inComponentsArray": False,
            },
            {
                "proposedId": "b3839_ntc",
                "verdict": "rejected_at_discovery",
                "reason": "B3839 NTC spec is platform thermistor vocabulary — not separate canonical.",
                "inComponentsArray": False,
            },
        ],
        "unresolvedConcepts": [
            {
                "concept": "door_switch",
                "reason": "E9 flowchart references doors — no standalone procedure seed.",
            },
            {
                "concept": "evaporator_fan",
                "reason": "No evap-fan procedure seed on midea_rss.",
            },
            {
                "concept": "water_dispenser",
                "reason": "EH/EF/CA/EP codes — no dispenser procedure seed.",
            },
        ],
        "proposedNextManualRequirements": [],
        "recommendedNextStep": (
            "Proceed to CG-9.5 WP4 production compounding for NS-RSS26 SxS. "
            "CG-9 R2 triangulation already closed family boundary — this observation confirms "
            "Midea RSS aligns with frozen refrigerator contract without canonical expansion. "
            "Do NOT import Samsung/Whirlpool/LG SxS overlay vocabulary."
        ),
    }


def build_report(obs: dict[str, Any]) -> str:
    hyps = obs["familyBoundaryHypotheses"]
    lines = [
        "# CG-9 — Midea RSS SxS Family Boundary Discovery Report",
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
    print("==> CG-9 Midea RSS SxS family-boundary discovery (read-only)")
    obs = build_observation()
    OUT_JSON.write_text(json.dumps(obs, indent=2), encoding="utf-8")
    OUT_REPORT.write_text(build_report(obs), encoding="utf-8")
    print(f"canonical hash verified: {obs['frozenOntologyReference']['hashVerifiedAtGeneration']}")
    print(
        f"KEEP shared: "
        f"{sum(1 for r in obs['sixKeepFunctionEvidence'] if r['disposition']=='shared_function')}/6"
    )
    print(f"artifact: {OUT_JSON}")
    print(f"report:   {OUT_REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
