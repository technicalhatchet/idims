#!/usr/bin/env python3
"""Gate 5 read-only analysis of eight non-trivial scoped-evidence procedures. No seed mutation."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_ROOT = REPO_ROOT / "frontend/components/diagnostics/procedures/seed"
OUT_DIR = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
)

GATE5_PROCEDURE_IDS = [
    "w8178558-door-lock",
    "w11169652-test-01-acu-power",
    "w8178558-inlet-valves",
    "w10864849-test-07-drain-recirc-pump",
    "w11416787-test-07-drain-recirc-pump",
    "w11633848-overfill-switch",
    "lgotrmw-door-interlock",
    "samsungotrmw-door-interlock",
]

PROVEN_WITNESSES = [
    "w8178558-drain-pump",
    "w8178558-wash-heater",
    "w8178558-wash-ntc",
]


def find_seed_path(procedure_id: str) -> Path | None:
    for path in SEED_ROOT.rglob("*.json"):
        if path.name == f"{procedure_id}.json":
            return path
    return None


def load_proc(procedure_id: str) -> tuple[dict[str, Any], str] | None:
    path = find_seed_path(procedure_id)
    if not path:
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f), str(path.relative_to(REPO_ROOT)).replace("\\", "/")


def step_summary(proc: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for step in sorted(proc.get("steps") or [], key=lambda s: s.get("order", 0)):
        row: dict[str, Any] = {
            "id": step.get("id"),
            "order": step.get("order"),
            "type": step.get("type"),
            "title": step.get("title"),
        }
        if step.get("type") == "instruction":
            row["bodyExcerpt"] = (step.get("body") or "")[:240]
        if step.get("type") == "measurement":
            row["measurementKnowledgeId"] = step.get("measurementKnowledgeId")
            row["testPoint"] = step.get("testPoint")
            row["measurementContext"] = step.get("measurementContext")
        rows.append(row)
    return rows


# Human-reviewed Gate 5 classifications (seed-inspected Mar 2026).
GATE5_REVIEWS: dict[str, dict[str, Any]] = {
    "w8178558-door-lock": {
        "gate3Bucket": "AMBIGUOUS_CONFIGURATION",
        "classification": "NEEDS_NEW_SEMANTIC_DESIGN",
        "components": ["door_lock", "control_board (live test branch only)"],
        "firstLoadSideVerification": None,
        "laterTestPoints": [
            "DL3 pins 1&3 / 2&3 at CCU (connector unplugged at CCU)",
            "DS2 pins 3&1 at CCU (door state checkpoint)",
            "Pin-for-pin harness DL3/DS2 with both ends disconnected",
            "Manual Diagnostic Test energize (live)",
        ],
        "disconnectInstructions": [
            "disconnect_dl3: DL3 from CCU before first Ω step",
            "disconnect_ds2: DS2 from CCU before door switch checkpoint",
            "harness_test_prep: DL3 and DS2 unplugged at CCU and at lock assembly",
        ],
        "loadInCircuitDuringLaterTest": False,
        "loadInCircuitExplicitInSeed": False,
        "laterTestEstablishesPathFault": "Partially — harness_bad implies wire fault, but test is isolated pin-pin continuity, not through_path with load present",
        "multiPointOrMultiLoad": True,
        "oemOutcomeAgreesWithSemantics": False,
        "modelWithoutDistortion": False,
        "rationale": (
            "No at-load component_verified pass precedes CCU Ω; first measurements are at DL3 with "
            "CCU end only disconnected (harness still carries lock). Isolated harness continuity "
            "explicitly requires both ends open — not Gate 4 loadInCircuit=true. harness_bad confirms "
            "door_lock while OEM directs replace harness. Three sub-circuits (lock/unlock solenoids, "
            "DS2) plus live CCU output test exceed single anchor + path_open pair."
        ),
        "designGap": (
            "Wire-continuity checkpoint assertion (harness isolated), multi-subcircuit anchor policy, "
            "and CCU-first vs load-first sequencing — not new assertion types but compound conclusion rules."
        ),
        "futureMigrationNotes": "Remain legacy; do not map harness_bad to path_open without new semantics.",
    },
    "w11169652-test-01-acu-power": {
        "gate3Bucket": "AMBIGUOUS_CONFIGURATION",
        "classification": "AMBIGUOUS_CONFIGURATION",
        "components": ["supply"],
        "firstLoadSideVerification": None,
        "laterTestPoints": [
            "RFI line in",
            "RFI line out",
            "ACU J2 pins 1&2 (with IF connected per body)",
            "HMI 5 VDC (downstream)",
        ],
        "disconnectInstructions": [
            "No component disconnect; live voltage with power restored at restore_power_line",
        ],
        "loadInCircuitDuringLaterTest": None,
        "loadInCircuitExplicitInSeed": False,
        "laterTestEstablishesPathFault": "j2_bad implies harness between RFI and ACU, but domain is AC voltage supply chain not Ω load",
        "multiPointOrMultiLoad": True,
        "oemOutcomeAgreesWithSemantics": "Mixed — j2_bad OEM is harness repair; line_out_bad is RFI replacement; all confirm supply",
        "modelWithoutDistortion": False,
        "rationale": (
            "Procedure is supply segmentation (cord → RFI → J2 → ACU), not component-at-load then "
            "through_path Ω. No measurementContext or single anchored load. j2_bad could be read as "
            "path fault or supply segment failure; confirm_supply_critical_supply_fault collapses distinct OEM paths."
        ),
        "competingInterpretations": [
            "j2_bad as external_path_fault on supply vs supply segment confirm",
            "Whether IF-connected J2 measurement implies loadInCircuit for any scoped Ω model (N/A — voltage steps)",
        ],
        "missingEvidence": [
            "No at-load resistance verification of any replaceable load",
            "No explicit through_path / loadInCircuit for voltage checkpoints",
        ],
        "futureMigrationNotes": "Remain legacy; supply-path semantics need separate design from Gate 4 witness.",
    },
    "w8178558-inlet-valves": {
        "gate3Bucket": "MULTI_POINT_COMPOUND",
        "classification": "NEEDS_NEW_SEMANTIC_DESIGN",
        "components": ["inlet_valve"],
        "firstLoadSideVerification": "valve_at_component — cold & hot coils at valve terminals (coils disconnected at valve)",
        "laterTestPoints": [
            "VCH7 pins 1&3 (cold)",
            "VCH7 pins 5&7 (hot)",
            "Manual Diagnostic Test fill (live)",
        ],
        "disconnectInstructions": [
            "disconnect_valve_coils: solenoid connectors at valve",
            "disconnect_vch7: VCH7 from CCU only before CCU Ω",
        ],
        "loadInCircuitDuringLaterTest": True,
        "loadInCircuitExplicitInSeed": False,
        "laterTestEstablishesPathFault": "Yes for OL at VCH7 with good at component — structurally parallel to heater witness per coil",
        "multiPointOrMultiLoad": True,
        "oemOutcomeAgreesWithSemantics": False,
        "modelWithoutDistortion": False,
        "rationale": (
            "Two independent coil paths on one VCH7 connector share one componentId; single "
            "valve_comp_pass verifies both coils in one step. CCU open branches route to replace_valve "
            "(component) not harness/path OEM. Cold and hot CCU steps each re-eliminate inlet_valve on pass. "
            "Gate 4 pair rule applies per coil but compound run needs multiple pathRefs or split procedures."
        ),
        "designGap": (
            "Multi-pathRef / multi-coil compound conclusion on one componentId; optional per-coil "
            "component_verified scope; path-first terminal outcome missing for CCU-only open."
        ),
        "futureMigrationNotes": (
            "Per-coil migration (cold then hot) possible after compound policy; not safe as single naive seed pass."
        ),
    },
    "w10864849-test-07-drain-recirc-pump": {
        "gate3Bucket": "MULTI_POINT_COMPOUND",
        "classification": "NEEDS_NEW_SEMANTIC_DESIGN",
        "components": ["drain_pump", "recirculation_pump (effects mis-tagged drain_pump on recirc branches)"],
        "firstLoadSideVerification": "pump_terminal_ohms (order 9) — after J4 and harness steps",
        "laterTestPoints": [
            "J4-1&3 drain (J4 disconnected)",
            "J4-1&5 recirc optional",
            "harness_pump_cont checkpoint",
            "pump motor terminals",
        ],
        "disconnectInstructions": [
            "j4_pump_ohms body: Disconnect J4",
            "Harness continuity with washer tilted — continuity pump pins to J4",
        ],
        "loadInCircuitDuringLaterTest": "J4 Ω with J4 unplugged — pump windings on harness side (similar to CCU witness) but no prior at-pump pass in step order",
        "loadInCircuitExplicitInSeed": False,
        "laterTestEstablishesPathFault": "ph_open → replace_lower_harness_pump but effect confirms drain_pump",
        "multiPointOrMultiLoad": True,
        "oemOutcomeAgreesWithSemantics": False,
        "modelWithoutDistortion": False,
        "rationale": (
            "ACU-first sequence: J4 pass eliminates drain_pump before harness and before pump_terminal_ohms. "
            "Cannot apply Gate 4 eliminate→path_open temporal rule without reordering or branch-scoped state. "
            "Drain + recirc on one J4; recirc failures attach to drain_pump componentId."
        ),
        "designGap": "ACU-first vs load-first ordering, dual-motor J4, harness visual_check between connector and load measurements.",
        "futureMigrationNotes": "Align with w11169652-test-08 pattern — design before migration.",
    },
    "w11416787-test-07-drain-recirc-pump": {
        "gate3Bucket": "MULTI_POINT_COMPOUND",
        "classification": "NEEDS_NEW_SEMANTIC_DESIGN",
        "components": ["drain_pump", "recirculation_pump (effects mis-tagged drain_pump)"],
        "firstLoadSideVerification": "pump_terminal_ohms after J15 measurements and harness checkpoint (same structure as W10864849 TEST #7)",
        "laterTestPoints": ["J15 drain/recirc Ω", "harness_pump_cont", "pump terminals"],
        "disconnectInstructions": ["Disconnect J15 for Ω at control connector"],
        "loadInCircuitDuringLaterTest": "Same as w10864849-test-07",
        "loadInCircuitExplicitInSeed": False,
        "laterTestEstablishesPathFault": "Harness open branch — same as W10864849",
        "multiPointOrMultiLoad": True,
        "oemOutcomeAgreesWithSemantics": False,
        "modelWithoutDistortion": False,
        "rationale": "Platform delta (J15 vs J4) with identical multi-point ACU-first pump flow; same compound limitations.",
        "designGap": "Same as w10864849-test-07-drain-recirc-pump",
        "futureMigrationNotes": "Migrate only after shared TL DD pump-path design.",
    },
    "w11633848-overfill-switch": {
        "gate3Bucket": "MULTI_POINT_COMPOUND",
        "classification": "NEEDS_NEW_SEMANTIC_DESIGN",
        "components": ["inlet_valve (seed componentIds)", "float switch (semantic, not separate componentId)"],
        "firstLoadSideVerification": None,
        "laterTestPoints": [
            "P6 7&9 fill valve (P6 unplugged at control)",
            "P6 4&6 float down",
            "P6 4&6 float up (OL is pass branch)",
        ],
        "disconnectInstructions": ["disconnect_p6_overfill: Unplug P6 from control"],
        "loadInCircuitDuringLaterTest": False,
        "loadInCircuitExplicitInSeed": False,
        "laterTestEstablishesPathFault": "No — all measurements at control connector with P6 removed; float tests are positional switch semantics",
        "multiPointOrMultiLoad": True,
        "oemOutcomeAgreesWithSemantics": False,
        "modelWithoutDistortion": False,
        "rationale": (
            "No at-load Ω on valve or float. Float-up pass uses measurement_open as success. Effects on "
            "float faults confirm/eliminate inlet_valve incorrectly. Multiple P6 pin pairs and mechanical "
            "float state — not single-load through_path."
        ),
        "designGap": (
            "Stateful switch pass/fail (OL expected), separate float_switch anchor, control-only P6 measurements."
        ),
        "futureMigrationNotes": "Fix component attribution and float semantics before any scoped migration.",
    },
    "lgotrmw-door-interlock": {
        "gate3Bucket": "MULTI_POINT_COMPOUND",
        "classification": "TRUE_COMPONENT_FAILURE",
        "components": ["door_interlock"],
        "firstLoadSideVerification": "Primary/secondary/monitor tests at switch terminals with leads disconnected per step",
        "laterTestPoints": [
            "Primary COM-NO (door closed) measurement",
            "Secondary COM-NO (door closed)",
            "Monitor COM-NC states via checkpoints",
        ],
        "disconnectInstructions": [
            "primary_open: Disconnect primary switch leads",
            "Tests are directly at interlock switches, not at a control harness connector",
        ],
        "loadInCircuitDuringLaterTest": False,
        "loadInCircuitExplicitInSeed": False,
        "laterTestEstablishesPathFault": "No — OL/closed readings are direct switch health, not path_open through wiring",
        "multiPointOrMultiLoad": True,
        "oemOutcomeAgreesWithSemantics": True,
        "modelWithoutDistortion": True,
        "rationale": (
            "Sequential interlock switch tests (primary, secondary, monitor) with door state. "
            "Failures confirm door_interlock for component replacement/adjustment — not external path "
            "with verified-good load. No CCU/connector through-path step."
        ),
        "futureMigrationNotes": "Remain legacy unscoped; scoped path model does not apply.",
    },
    "samsungotrmw-door-interlock": {
        "gate3Bucket": "MULTI_POINT_COMPOUND",
        "classification": "TRUE_COMPONENT_FAILURE",
        "components": ["door_interlock"],
        "firstLoadSideVerification": "Same pattern as LG — primary closed measurement at switch with door shut",
        "laterTestPoints": ["Primary COM-NO", "Monitor COM-NC checkpoints", "Additional interlock steps"],
        "disconnectInstructions": ["Disconnect primary switch leads at switch"],
        "loadInCircuitDuringLaterTest": False,
        "loadInCircuitExplicitInSeed": False,
        "laterTestEstablishesPathFault": "No",
        "multiPointOrMultiLoad": True,
        "oemOutcomeAgreesWithSemantics": True,
        "modelWithoutDistortion": True,
        "rationale": "Microwave interlock procedure tests switches in situ; path_open + external_path_fault would misrepresent direct switch failure.",
        "futureMigrationNotes": "Remain legacy unscoped.",
    },
}


def build_artifact() -> dict[str, Any]:
    procedures: list[dict[str, Any]] = []
    counts: dict[str, int] = {k: 0 for k in [
        "CURRENT_MODEL_SUFFICIENT",
        "NEEDS_NEW_SEMANTIC_DESIGN",
        "TRUE_COMPONENT_FAILURE",
        "INSUFFICIENT_EVIDENCE",
        "AMBIGUOUS_CONFIGURATION",
    ]}

    for pid in GATE5_PROCEDURE_IDS:
        loaded = load_proc(pid)
        if not loaded:
            raise SystemExit(f"Missing seed for {pid}")
        proc, seed_path = loaded
        review = GATE5_REVIEWS[pid]
        cls = review["classification"]
        counts[cls] += 1
        procedures.append(
            {
                "procedureId": pid,
                "platformId": proc.get("platformId"),
                "componentIds": proc.get("componentIds"),
                "seedPath": seed_path,
                "gate3Bucket": review["gate3Bucket"],
                "classification": cls,
                "analysis": {k: v for k, v in review.items() if k not in ("classification", "gate3Bucket")},
                "stepIndex": step_summary(proc),
            }
        )

    safe_single_seed = [
        p["procedureId"]
        for p in procedures
        if p["classification"] == "CURRENT_MODEL_SUFFICIENT"
    ]
    design_work = [
        p["procedureId"]
        for p in procedures
        if p["classification"] in ("NEEDS_NEW_SEMANTIC_DESIGN", "AMBIGUOUS_CONFIGURATION")
    ]
    legacy_unscoped = [
        p["procedureId"]
        for p in procedures
        if p["classification"]
        in (
            "NEEDS_NEW_SEMANTIC_DESIGN",
            "AMBIGUOUS_CONFIGURATION",
            "TRUE_COMPONENT_FAILURE",
            "INSUFFICIENT_EVIDENCE",
        )
    ]

    return {
        "schemaVersion": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "method": "gate5_read_only_human_review_v1",
        "provenWitnesses": PROVEN_WITNESSES,
        "scope": {
            "procedureIds": GATE5_PROCEDURE_IDS,
            "note": "Eight non-trivial procedures from Gate 3; no seed or production changes.",
        },
        "classificationCounts": counts,
        "gate5Summary": {
            "safeForFutureSingleSeedMigration": safe_single_seed,
            "requiresArchitectureOrDesignWork": design_work,
            "shouldRemainLegacyUnscoped": legacy_unscoped,
            "provenPatternReminder": (
                "component_verified at_load → path_open through_path loadInCircuit=true → external_path_fault"
            ),
        },
        "procedures": procedures,
        "noProposedProductionMutations": True,
    }


def main() -> None:
    discovery = build_artifact()
    audit = {
        "schemaVersion": "1.0.0",
        "generatedAt": discovery["generatedAt"],
        "artifact": "CG_SCOPED_EVIDENCE_GATE5_DISCOVERY_v1.json",
        "executiveSummary": {
            "proceduresReviewed": len(GATE5_PROCEDURE_IDS),
            "classificationCounts": discovery["classificationCounts"],
            "safeSingleSeed": len(discovery["gate5Summary"]["safeForFutureSingleSeedMigration"]),
            "designWork": len(discovery["gate5Summary"]["requiresArchitectureOrDesignWork"]),
            "legacyUnscoped": len(discovery["gate5Summary"]["shouldRemainLegacyUnscoped"]),
        },
        "readOnly": True,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "CG_SCOPED_EVIDENCE_GATE5_DISCOVERY_v1.json"
    audit_path = OUT_DIR / "CG_SCOPED_EVIDENCE_GATE5_DISCOVERY_AUDIT_v1.json"
    out.write_text(json.dumps(discovery, indent=2), encoding="utf-8")
    audit_path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(f"Wrote {out}")
    print(f"Wrote {audit_path}")
    print(json.dumps(discovery["classificationCounts"], indent=2))


if __name__ == "__main__":
    main()
