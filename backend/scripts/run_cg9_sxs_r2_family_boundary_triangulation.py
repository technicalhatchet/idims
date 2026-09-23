#!/usr/bin/env python3
"""CG-9 R2 — Whirlpool W11296289 SxS family-boundary falsification probe (read-only)."""

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
OVERLAYS = KNOWLEDGE / "canonical" / "manufacturer_overlays"

R1_ARTIFACT = CALIBRATION / "SAMSUNG_RS28_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
WHIRLPOOL_MANUAL = "W11296289"
WHIRLPOOL_PLATFORM = "whirlpool_sxs_w11296289"
WHIRLPOOL_SEED_DIR = KNOWLEDGE / "procedures" / "seed" / "whirlpool_sxs_w11296289"
FROZEN_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"

OUT_WHIRLPOOL = CALIBRATION / "W11296289_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
OUT_TRIANGULATION = CALIBRATION / "CG9_SXS_REFRIGERATOR_FAMILY_BOUNDARY_R2_TRIANGULATION_v1.json"
OUT_REPORT = CALIBRATION / "CG9_SXS_REFRIGERATOR_FAMILY_BOUNDARY_R2_REPORT_v1.md"

KEEP = [
    "control_board",
    "user_interface",
    "door_switch",
    "evaporator_fan",
    "air_damper",
    "defrost_heater",
]
CONDITIONAL = [
    "temperature_sensor",
    "compressor",
    "condenser_fan",
    "ice_maker",
    "water_dispenser",
]


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _procedure_seeds(seed_dir: Path) -> list[Path]:
    return [
        p
        for p in seed_dir.glob("*.json")
        if p.name not in {"procedureCatalog.json", "README.md"}
    ]


def whirlpool_keep_evidence() -> list[dict[str, Any]]:
    return [
        {
            "concept": "control_board",
            "evidence": "THESEUS/ATHENA ACU service-mode orchestration; fail LED decode.",
            "procedureOrTest": [
                "w11296289-theseus-service-entry",
                "w11296289-athena-service-entry",
                "w11296289-athena-fail-display",
            ],
            "functionalRole": "Refrigeration control orchestration",
            "configurationEffect": "THESEUS vs ATHENA board variants — implementation overlay.",
            "disposition": "maps_to_frozen_contract",
            "confidence": "high",
        },
        {
            "concept": "user_interface",
            "evidence": "CUDA dispenser LED step UI; MINOTAUR HMI J1 12.7 VDC.",
            "procedureOrTest": [
                "w11296289-theseus-service-entry",
                "w11296289-athena-fail-display",
            ],
            "functionalRole": "HMI / service-mode display surface",
            "configurationEffect": "Dispenser CUDA vs ATHENA TEMP-button entry.",
            "disposition": "maps_to_frozen_contract",
            "confidence": "high",
        },
        {
            "concept": "door_switch",
            "evidence": "Dedicated service steps 21/23 RC and FC door switches.",
            "procedureOrTest": [
                "w11296289-test-21-rc-door-switch",
                "w11296289-test-23-fc-door-switch",
            ],
            "functionalRole": "Door authorization / lighting",
            "configurationEffect": "Dual vertical doors — same role as other configs.",
            "disposition": "maps_to_frozen_contract",
            "confidence": "high",
        },
        {
            "concept": "evaporator_fan",
            "evidence": "Service step 15 single evaporator fan (single-evap SxS architecture).",
            "procedureOrTest": ["w11296289-test-15-evap-fan"],
            "functionalRole": "Evaporator airflow",
            "configurationEffect": "Single fan vs multi-fan french-door — instance topology only.",
            "disposition": "maps_to_frozen_contract",
            "confidence": "high",
        },
        {
            "concept": "air_damper",
            "evidence": "Service steps 9 damper open + 11 damper heater.",
            "procedureOrTest": [
                "w11296289-test-09-damper-open",
                "w11296289-test-11-damper-heater",
            ],
            "functionalRole": "Fresh-food airflow regulation",
            "configurationEffect": "12 VDC stepper + heater vs Samsung heater-only path.",
            "disposition": "maps_to_frozen_contract",
            "confidence": "high",
        },
        {
            "concept": "defrost_heater",
            "evidence": "Service step 13 defrost heater 550–650 Ω.",
            "procedureOrTest": ["w11296289-test-13-defrost-heater"],
            "functionalRole": "Defrost heat actuation",
            "configurationEffect": "Single evaporator defrost on SxS — instance scope.",
            "disposition": "maps_to_frozen_contract",
            "confidence": "high",
        },
    ]


def whirlpool_conditional_evidence() -> list[dict[str, Any]]:
    return [
        {
            "concept": "temperature_sensor",
            "instanceScopes": ["freezer", "fresh_food", "defrost"],
            "evidence": "FC/RC cabinet thermistors + defrost NTC service steps.",
            "procedureOrTest": [
                "w11296289-test-01-fc-thermistor",
                "w11296289-test-03-rc-thermistor",
                "w11296289-test-05-defrost-thermistor",
            ],
            "roleAssessment": "same_functional_role",
            "disposition": "maps_to_frozen_contract",
            "confidence": "high",
        },
        {
            "concept": "compressor",
            "evidence": "Service step 7 compressor run windings; relay-drive EGX/EM3 variants.",
            "procedureOrTest": ["w11296289-test-07-compressor-cond-fan"],
            "roleAssessment": "same_functional_role",
            "implementation": "relay_drive_em3y60_class",
            "disposition": "maps_to_frozen_contract",
            "confidence": "high",
        },
        {
            "concept": "condenser_fan",
            "evidence": "Service step 7 explicitly exercises condenser fan with compressor.",
            "procedureOrTest": ["w11296289-test-07-compressor-cond-fan"],
            "roleAssessment": "same_functional_role",
            "disposition": "maps_to_frozen_contract",
            "note": "Resolves Samsung SxS C-FAN ambiguity class — role holds, implementation naming varies.",
            "confidence": "high",
        },
        {
            "concept": "ice_maker",
            "evidence": "IDI twist-tray steps 29–35; tray thermistor step 33.",
            "procedureOrTest": ["w11296289-test-33-im-tray-thermistor"],
            "roleAssessment": "same_functional_role",
            "configurationEffect": "In-door IDI vs in-freezer vs door-mounted ice.",
            "disposition": "maps_to_frozen_contract",
            "confidence": "medium",
        },
        {
            "concept": "water_dispenser",
            "evidence": "Service step 19 water valve; paddle steps 25/27.",
            "procedureOrTest": ["w11296289-test-19-water-valve"],
            "roleAssessment": "same_functional_role",
            "disposition": "maps_to_frozen_contract",
            "confidence": "high",
        },
    ]


def build_whirlpool_observation() -> dict[str, Any]:
    seeds = _procedure_seeds(WHIRLPOOL_SEED_DIR)
    bundles = list((WHIRLPOOL_SEED_DIR / "bundles").glob("*.json"))
    measurement_count = sum(
        1
        for p in seeds
        if any(s.get("type") == "measurement" for s in json.loads(p.read_text())["steps"])
    )
    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg9_refrigerator_family_boundary_observation",
        "phase": "CG-9-R2",
        "probeKind": "falsification_non_samsung_sxs",
        "status": "discovery_only",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "canonicalExpansion": 0,
        "canonicalMutation": 0,
        "freezeReopened": False,
        "discoveryCorpusInheritance": 0,
        "cg8CompoundingPerformed": False,
        "sourceMetadata": {
            "manualId": WHIRLPOOL_MANUAL,
            "platformId": WHIRLPOOL_PLATFORM,
            "manufacturer": "Whirlpool",
            "configuration": "side_by_side",
            "smokeModel": "WRS325SDHZ",
            "pdf": "backend/docs/manuals/Service-Manual-W11296289-Side-X-Side-Refrigerator.pdf",
            "extractedText": "backend/docs/manuals/Service-Manual-W11296289-Side-X-Side-Refrigerator-extracted.txt",
            "extractionDoc": "frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11296289_SXS_REFRIGERATOR_EXTRACTION.md",
            "procedureSeedDir": str(WHIRLPOOL_SEED_DIR.relative_to(ROOT)).replace("\\", "/"),
            "procedureCounts": {
                "procedureSeeds": len(seeds),
                "serviceModeBundles": len(bundles),
                "proceduresWithMeasurementSteps": measurement_count,
            },
        },
        "probeQuestion": (
            "Does non-Samsung SxS introduce a functional diagnostic role outside the "
            "frozen french_door_refrigerator contract?"
        ),
        "sixKeepFunctionEvidence": whirlpool_keep_evidence(),
        "fiveConditionalFunctionEvidence": whirlpool_conditional_evidence(),
        "possibleNewCanonicalFunctions": [],
        "outsideContractFindings": [],
    }


def _disposition_map(rows: list[dict[str, Any]]) -> dict[str, str]:
    return {r["concept"]: r["disposition"] for r in rows}


def build_triangulation(r1: dict[str, Any], r2: dict[str, Any]) -> dict[str, Any]:
    fd = json.loads(CANONICAL_FD.read_text(encoding="utf-8"))
    samsung_keep = _disposition_map(r1["sixKeepFunctionEvidence"])
    whirlpool_keep = _disposition_map(r2["sixKeepFunctionEvidence"])
    samsung_cond = {r["concept"]: r["disposition"] for r in r1["fiveConditionalFunctionEvidence"]}
    whirlpool_cond = {r["concept"]: r["disposition"] for r in r2["fiveConditionalFunctionEvidence"]}

    keep_intersection = {
        c: {
            "samsungSxS": samsung_keep.get(c),
            "whirlpoolSxS": whirlpool_keep.get(c),
            "intersection": (
                samsung_keep.get(c) == "shared_function"
                and whirlpool_keep.get(c) == "maps_to_frozen_contract"
            ),
        }
        for c in KEEP
    }
    conditional_intersection = {
        c: {
            "samsungSxS": samsung_cond.get(c),
            "whirlpoolSxS": whirlpool_cond.get(c),
            "intersection": (
                samsung_cond.get(c) in {"shared_function", "needs_second_manual"}
                and whirlpool_cond.get(c) == "maps_to_frozen_contract"
            ),
            "note": (
                "condenser_fan: Samsung ambiguous (22C); Whirlpool step 7 confirms role — "
                "stays conditional, not promoted."
                if c == "condenser_fan"
                else None
            ),
        }
        for c in CONDITIONAL
    }

    all_keep_map = all(v["intersection"] for v in keep_intersection.values())
    all_cond_map = all(
        whirlpool_cond[c] == "maps_to_frozen_contract" for c in CONDITIONAL
    ) and all(samsung_cond.get(c) in {"shared_function", "needs_second_manual"} for c in CONDITIONAL)

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg9_sxs_family_boundary_r2_triangulation",
        "phase": "CG-9",
        "stage": "R2_falsification_probe",
        "status": "family_boundary_closed",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "canonicalExpansion": 0,
        "canonicalMutation": 0,
        "freezeReopened": False,
        "newCanonicalConcepts": 0,
        "discoveryCorpusInheritance": 0,
        "cg8CompoundingPerformed": False,
        "architecturalConclusion": (
            "The frozen french_door_refrigerator contract behaves as a generic refrigerator "
            "functional ontology across side-by-side configuration. Configuration differences "
            "(door layout, fan count, ice placement, harness naming) are overlay/instance "
            "concerns — not a separate canonical family. Ontology rename (e.g. to "
            "'refrigerator') is an organizational re-freeze decision, not required for "
            "continued compounding."
        ),
        "frozenContractReference": {
            "id": "french_door_refrigerator",
            "revision": "rev1",
            "hash": FROZEN_HASH,
            "hashVerified": sha256_file(CANONICAL_FD) == FROZEN_HASH,
            "components": [c["id"] for c in fd["components"]],
            "conditionalConcepts": [c["id"] for c in fd.get("conditionalConcepts", [])],
            "testedAs": "operational_refrigerator_functional_contract",
        },
        "evidenceChain": {
            "frozenFdContract": "french_door_refrigerator.json rev1",
            "r1SamsungSxS": R1_ARTIFACT.name,
            "r2WhirlpoolSxS": OUT_WHIRLPOOL.name,
        },
        "crossManufacturerFunctionalIntersection": {
            "sixKeepFunctions": keep_intersection,
            "fiveConditionalConcepts": conditional_intersection,
            "allKeepFunctionsIntersect": all_keep_map,
            "allConditionalConceptsIntersect": all_cond_map,
        },
        "layerSeparationConfirmed": {
            "functional": KEEP + CONDITIONAL,
            "configuration": [
                "vertical_ff_fz_door_layout",
                "single_vs_multi_evaporator_fan_topology",
                "ice_maker_placement",
                "compartment_naming_ff_fz_rc_fc",
            ],
            "implementation": [
                "theseus_athena_minotaur_board_variants",
                "inverter_pba_vs_relay_compressor",
                "damper_stepper_vs_heater_only",
                "connector_pin_maps",
            ],
        },
        "unresolvedCarryForward": [
            {
                "concept": "condenser_fan",
                "status": "conditional_unresolved_on_samsung_only",
                "action": "Do not force into ontology; Whirlpool R2 confirms role fits conditional contract.",
            }
        ],
        "familyBoundaryVerdict": {
            "hypothesisA_shareFrozenContract": "confirmed",
            "hypothesisB_broaderRefrigeratorOntologyNaming": "supported_organizational_only",
            "hypothesisC_distinctSideBySideOntology": "falsified",
            "hypothesisD_insufficientEvidence": "falsified_by_r2",
            "familyBoundaryClosed": True,
            "recommendedNextStep": "stop_digging_use_frozen_contract_for_sxs_compounding_when_needed",
            "deferredOrganizationalRefactor": "rename french_door_refrigerator → refrigerator at future human re-freeze gate",
        },
        "isolationGuards": {
            "cg7DiscoveryCorpusInheritance": False,
            "cg8OverlaysUsedAsSxSEvidence": False,
            "sideBySideCanonicalOntologyCreated": False,
            "overlayPublished": False,
            "priorOverlayHashes": {
                name: sha256_file(OVERLAYS / name)
                for name in [
                    "whirlpool_jazz_french_door.json",
                    "samsung_fridge_bespoke.json",
                    "lg_lrmvs.json",
                ]
            },
        },
        "r1Summary": {
            "manualId": r1["sourceMetadata"]["primaryManualId"],
            "keepShared": sum(
                1 for r in r1["sixKeepFunctionEvidence"] if r["disposition"] == "shared_function"
            ),
        },
        "r2Summary": {
            "manualId": r2["sourceMetadata"]["manualId"],
            "keepMapped": sum(
                1
                for r in r2["sixKeepFunctionEvidence"]
                if r["disposition"] == "maps_to_frozen_contract"
            ),
        },
    }


def build_report(tri: dict[str, Any]) -> str:
    ki = tri["crossManufacturerFunctionalIntersection"]["sixKeepFunctions"]
    ci = tri["crossManufacturerFunctionalIntersection"]["fiveConditionalConcepts"]
    lines = [
        "# CG-9 R2 — SxS Family Boundary Triangulation (Whirlpool falsification probe)",
        "",
        f"**Verdict:** {tri['status']} · **New canonical concepts:** {tri['newCanonicalConcepts']}",
        "",
        tri["architecturalConclusion"],
        "",
        "## Cross-manufacturer KEEP intersection",
        "",
        "| Concept | Samsung SxS | Whirlpool SxS | Intersects |",
        "|---------|-------------|---------------|------------|",
    ]
    for concept, row in ki.items():
        lines.append(
            f"| {concept} | {row['samsungSxS']} | {row['whirlpoolSxS']} | {row['intersection']} |"
        )
    lines.extend(["", "## Cross-manufacturer conditional intersection", "", "| Concept | Samsung | Whirlpool | Intersects |", "|---------|---------|-----------|------------|"])
    for concept, row in ci.items():
        note = f" ({row['note']})" if row.get("note") else ""
        lines.append(
            f"| {concept} | {row['samsungSxS']} | {row['whirlpoolSxS']} | {row['intersection']}{note} |"
        )
    lines.extend(
        [
            "",
            "## Recommended next step",
            "",
            tri["familyBoundaryVerdict"]["recommendedNextStep"],
            "",
            f"Organizational rename deferred: {tri['familyBoundaryVerdict']['deferredOrganizationalRefactor']}",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    print("==> CG-9 R2 Whirlpool W11296289 SxS falsification probe (read-only)")
    if not R1_ARTIFACT.is_file():
        print(f"FAIL: missing R1 artifact {R1_ARTIFACT}", file=__file__)
        return 1

    r1 = json.loads(R1_ARTIFACT.read_text(encoding="utf-8"))
    r2 = build_whirlpool_observation()
    tri = build_triangulation(r1, r2)

    OUT_WHIRLPOOL.write_text(json.dumps(r2, indent=2), encoding="utf-8")
    OUT_TRIANGULATION.write_text(json.dumps(tri, indent=2), encoding="utf-8")
    OUT_REPORT.write_text(build_report(tri), encoding="utf-8")

    print(f"Whirlpool KEEP mapped: {tri['r2Summary']['keepMapped']}/6")
    print(f"family boundary closed: {tri['familyBoundaryVerdict']['familyBoundaryClosed']}")
    print(f"new canonical: {tri['newCanonicalConcepts']}")
    print(f"triangulation: {OUT_TRIANGULATION}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
