#!/usr/bin/env python3
"""Generate samsung_range_ny63.json overlay bindings from NY63 normalization artifact."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAL = ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
OUT = ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays/samsung_range_ny63.json"

norm = json.loads((CAL / "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json").read_text(encoding="utf-8"))

procedures = norm["normalizedProcedures"]
measurements = norm["normalizedMeasurements"]
branches = norm["normalizedDecisionBranches"]

FUNCTIONAL_REALIZATIONS = [
    {
        "canonicalLayer": "temperature_sensor",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "oven_sensor", "displayLabel": "Oven temperature sensor (RTD)"},
        "diagnosticEvidence": {
            "spec": "1080 Ω @ room; CNS600 open >2950 Ω / short <930 Ω",
            "measurementIds": ["ny63-oven-sensor-ohms", "ny63-cns600-connector-ohms"],
            "procedureIds": ["ny63-c20-oven-sensor", "ny63-c21-abnormal-temp"],
            "branchIds": ["ny63-c20-sensor-fault"],
            "errorCodes": ["C-20", "C-21"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1",
            "pages": [54, 55, 56],
        },
    },
    {
        "canonicalLayer": "surface_heating_system",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "spark_module", "displayLabel": "Cooktop spark ignition module"},
        "diagnosticEvidence": {
            "spec": "120 VAC at spark module burner terminals in LITE position",
            "measurementIds": ["ny63-spark-module-vac"],
            "procedureIds": [
                "ny63-cooktop-spark-all-burners",
                "ny63-cooktop-one-burner-electric",
                "ny63-symptom-cooktop-none-light",
                "ny63-symptom-one-burner-no-light",
            ],
            "branchIds": ["ny63-spark-replace-module", "ny63-one-burner-electrode"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-3",
            "pages": [73, 74],
        },
    },
    {
        "canonicalLayer": "surface_heating_system",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "switch_ignition", "displayLabel": "Burner ignition switch (LITE)"},
        "diagnosticEvidence": {
            "spec": "120 VAC at ignition switch housing terminal in LITE",
            "measurementIds": ["ny63-ignition-switch-vac"],
            "procedureIds": ["ny63-cooktop-one-burner-electric"],
            "branchIds": ["ny63-one-burner-ignition-switch"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-3",
            "pages": [74],
        },
    },
    {
        "canonicalLayer": "surface_heating_system",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "valve_cooktop", "displayLabel": "Cooktop gas manifold valve"},
        "diagnosticEvidence": {
            "procedureIds": ["ny63-cooktop-gas-supply", "ny63-gas-leak-check", "ny63-symptom-burners-wont-stay-lit"],
            "branchIds": ["ny63-gas-gpr-shutoff", "ny63-stay-lit-gpr-fault"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-3",
            "pages": [72, 75],
        },
    },
    {
        "canonicalLayer": "surface_heating_system",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "gas_pressure_regulator", "displayLabel": "Gas pressure regulator (GPR)"},
        "diagnosticEvidence": {
            "procedureIds": ["ny63-cooktop-gas-supply", "ny63-symptom-burners-wont-stay-lit", "ny63-flame-abnormal-orifice"],
            "branchIds": ["ny63-gas-gpr-shutoff", "ny63-stay-lit-gpr-fault", "ny63-flame-gpr-direction"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-3",
            "pages": [72, 77],
        },
    },
    {
        "canonicalLayer": "surface_heating_system",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "gas_orifice_nozzle", "displayLabel": "Burner orifice nozzle (NG/LP sizing)"},
        "diagnosticEvidence": {
            "spec": "Per-burner NG/LP orifice diameter table",
            "measurementIds": ["ny63-orifice-diameter-table"],
            "procedureIds": ["ny63-flame-abnormal-orifice", "ny63-symptom-one-burner-no-light"],
            "branchIds": ["ny63-flame-orifice-size", "ny63-one-burner-orifice"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-3",
            "pages": [76, 77],
        },
    },
    {
        "canonicalLayer": "bake_heating_element",
        "canonicalLayerKind": "instanceScope",
        "implementation": {"platformTerm": "heater_bake", "displayLabel": "Electric bake element (3000W)"},
        "diagnosticEvidence": {
            "spec": "19 Ω @ room temp",
            "measurementIds": ["ny63-bake-heater-ohms"],
            "procedureIds": ["ny63-c21-abnormal-temp", "ny63-symptom-oven-temp-slow", "ny63-symptom-oven-temp-fast"],
            "branchIds": ["ny63-heater-out-of-range", "ny63-fast-temp-relay-shorted"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1",
            "pages": [64, 65],
        },
    },
    {
        "canonicalLayer": "broil_heating_element",
        "canonicalLayerKind": "instanceScope",
        "implementation": {"platformTerm": "heater_broil", "displayLabel": "Electric broil element (4200W)"},
        "diagnosticEvidence": {
            "spec": "13 Ω @ room temp",
            "measurementIds": ["ny63-broil-heater-ohms"],
            "procedureIds": ["ny63-c21-abnormal-temp", "ny63-symptom-oven-temp-slow", "ny63-symptom-oven-temp-fast"],
            "branchIds": ["ny63-heater-out-of-range"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1",
            "pages": [64],
        },
    },
    {
        "canonicalLayer": "convection_heating_element",
        "canonicalLayerKind": "conditionalInstanceScope",
        "implementation": {"platformTerm": "convection_heater", "displayLabel": "Electric convection element (1300W)"},
        "diagnosticEvidence": {
            "spec": "44 Ω @ room temp",
            "measurementIds": ["ny63-convection-heater-ohms"],
            "procedureIds": ["ny63-c21-abnormal-temp", "ny63-symptom-oven-temp-slow"],
            "branchIds": ["ny63-heater-out-of-range"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1",
            "pages": [64],
        },
    },
    {
        "canonicalLayer": "convection_fan",
        "canonicalLayerKind": "conditionalConcept",
        "implementation": {"platformTerm": "convection_fan_motor", "displayLabel": "Upper/lower convection fan motor"},
        "diagnosticEvidence": {
            "spec": "25–30 Ω motor; SSR200/RY211 and SSR201/RY212 relays",
            "measurementIds": ["ny63-convection-fan-ohms"],
            "procedureIds": ["ny63-symptom-convection-fan"],
            "branchIds": ["ny63-convection-fan-motor-fault"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1",
            "pages": [65],
        },
    },
    {
        "canonicalLayer": "oven_door_switch",
        "canonicalLayerKind": "conditionalConcept",
        "implementation": {"platformTerm": "door_lock_motor", "displayLabel": "Door lock motor + micro-switch"},
        "diagnosticEvidence": {
            "spec": "1750–1850 Ω motor; 120 VAC when commanded; CNS600 pins 7,9 switch OL when open",
            "measurementIds": ["ny63-door-lock-motor-ohms", "ny63-door-lock-motor-vac", "ny63-door-lock-switch-ohms"],
            "procedureIds": ["ny63-cd1-door-lock"],
            "branchIds": ["ny63-cd1-lock-motor-fault", "ny63-cd1-microswitch-fault"],
            "errorCodes": ["C-d1"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1",
            "pages": [59, 60],
        },
    },
    {
        "canonicalLayer": "thermal_protection",
        "canonicalLayerKind": "conditionalConcept",
        "implementation": {"platformTerm": "cooling_fan_motor", "displayLabel": "Display cooling fan + oven thermostat"},
        "diagnosticEvidence": {
            "spec": "Thermostat 0 Ω closed; cooling fan 120 VAC Broil Hi white-yellow",
            "measurementIds": ["ny63-thermostat-ohms", "ny63-cooling-fan-vac"],
            "procedureIds": ["ny63-ca2-display-overtemp", "ny63-symptom-oven-temp-fast"],
            "branchIds": ["ny63-ca2-cooling-fan-fault"],
            "errorCodes": ["C-A2", "C-21"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1",
            "pages": [63, 64],
        },
    },
    {
        "canonicalLayer": "control_board",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "main_pcb", "displayLabel": "Main PCB — electric oven relays + gas spark path"},
        "diagnosticEvidence": {
            "spec": "CN300 5V/12V; heater relays OL de-energized; C-F0 Main↔Sub comm",
            "measurementIds": ["ny63-cn300-5v-12v", "ny63-heater-relay-ohms", "ny63-cn200-5v-12v"],
            "procedureIds": ["ny63-cf0-main-sub-comm", "ny63-c21-abnormal-temp", "ny63-symptom-oven-no-power", "ny63-control-no-display"],
            "branchIds": ["ny63-c21-relay-check", "ny63-cf0-replace-main-pcb"],
            "errorCodes": ["C-F0", "C-21"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1 / 4-2 / 6-3",
            "pages": [57, 61, 69, 88],
        },
    },
    {
        "canonicalLayer": "user_interface",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "glass_touch_panel", "displayLabel": "Glass touch panel + cooktop knobs"},
        "diagnosticEvidence": {
            "procedureIds": ["ny63-cd0-key-short", "ny63-cf2-touch-comm", "ny63-control-touch-keypad", "ny63-symptom-keypad-fault"],
            "branchIds": ["ny63-cd0-knob-jam", "ny63-cf2-replace-sub-pcb"],
            "errorCodes": ["C-d0", "C-F2"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1 / 4-2",
            "pages": [58, 62, 70],
        },
    },
    {
        "canonicalLayer": "power_supply",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "terminal_block", "displayLabel": "240/120V terminal block + gas supply prerequisite"},
        "diagnosticEvidence": {
            "spec": "240/120V or 208/120V @ terminal block; CNP100 L1~N 120V; gas valve open for cooktop",
            "measurementIds": ["ny63-terminal-block-vac", "ny63-cnp100-vac", "ny63-power-cord-vac"],
            "procedureIds": ["ny63-symptom-oven-no-power", "ny63-cooktop-gas-supply", "ny63-control-no-display"],
            "branchIds": ["ny63-power-harness-fault", "ny63-gas-gpr-shutoff"],
        },
        "provenance": {
            "normalizationRef": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
            "sourceManual": "SAMSUNG-NY63-DUAL-FUEL",
            "section": "4-1 / 4-3",
            "pages": [64, 69, 72],
        },
    },
]


def binding_field(bindings: list[str], field: str) -> str | None:
    for b in bindings:
        if b == field or b.startswith(f"{field}.") or field in b:
            return b
    return None


def procedure_binding(p: dict) -> dict:
    bindings = p.get("rangeOvenBindings", [])
    out = {
        "procedureId": p["procedureId"],
        "displayTitle": p["title"],
        "oemSection": p["source"]["section"],
        "sourcePages": p["source"]["pages"],
    }
    canonical = [b for b in bindings if b in {
        "power_supply", "control_board", "user_interface", "temperature_sensor", "surface_heating_system",
    }]
    if canonical:
        out["canonicalComponents"] = canonical
    instance = binding_field(bindings, "bake_heating_element") or (
        "bake_heating_element" if "bake_heating_element" in bindings else None
    )
    if "bake_heating_element" in bindings and "instanceScope" not in out:
        if len([b for b in bindings if b.endswith("_heating_element")]) == 1 and "bake_heating_element" in bindings:
            pass
    if "bake_heating_element" in bindings:
        out.setdefault("instanceScope", None)
    if "broil_heating_element" in bindings and "bake_heating_element" not in bindings:
        out["instanceScope"] = "broil_heating_element"
    elif "bake_heating_element" in bindings and "broil_heating_element" not in bindings:
        out["instanceScope"] = "bake_heating_element"
    if "convection_heating_element" in bindings:
        out["conditionalInstanceScope"] = "convection_heating_element"
    conditional = [b for b in bindings if b in {"convection_fan", "thermal_protection", "oven_door_switch"}]
    if conditional:
        out["conditionalConcepts"] = conditional
    # clean erroneous instanceScope key
    if "instanceScope" in out and out["instanceScope"] is None:
        del out["instanceScope"]
    if "bake_heating_element" in bindings and "broil_heating_element" in bindings:
        if "instanceScope" in out:
            del out["instanceScope"]
    return out


def measurement_binding(m: dict) -> dict:
    binding = m.get("rangeOvenBinding", "")
    out = {"normalizationId": m["id"]}
    proc_ids = []
    for p in procedures:
        if m["id"] in p.get("measurementIds", []):
            proc_ids.append(p["procedureId"])
    if proc_ids:
        out["procedureId"] = proc_ids[0]
    if "temperature_sensor" in binding:
        out["canonicalLayer"] = "temperature_sensor"
    elif "power_supply" in binding:
        out["canonicalLayer"] = "power_supply"
    elif "control_board" in binding:
        out["canonicalLayer"] = "control_board"
    elif "surface_heating_system" in binding:
        out["canonicalLayer"] = "surface_heating_system"
    elif "instanceScopes.bake_heating_element" in binding:
        out["instanceScope"] = "bake_heating_element"
    elif "instanceScopes.broil_heating_element" in binding:
        out["instanceScope"] = "broil_heating_element"
    elif "conditionalInstanceScopes.convection_heating_element" in binding:
        out["conditionalInstanceScope"] = "convection_heating_element"
    elif "conditionalConcepts.convection_fan" in binding:
        out["conditionalConcept"] = "convection_fan"
    elif "conditionalConcepts.oven_door_switch" in binding:
        out["conditionalConcept"] = "oven_door_switch"
    elif "thermal_protection" in binding:
        out["conditionalConcept"] = "thermal_protection"
    return out


def branch_binding(b: dict) -> dict:
    out = {
        "branchId": b["id"],
        "procedureId": b["procedureId"],
        "executable": True,
    }
    proc = next(p for p in procedures if p["procedureId"] == b["procedureId"])
    bindings = proc.get("rangeOvenBindings", [])
    if "surface_heating_system" in bindings:
        out["canonicalLayer"] = "surface_heating_system"
    elif "temperature_sensor" in bindings:
        out["canonicalLayer"] = "temperature_sensor"
    elif "control_board" in bindings:
        out["canonicalLayer"] = "control_board"
    elif "oven_door_switch" in bindings:
        out["conditionalConcept"] = "oven_door_switch"
    elif "thermal_protection" in bindings:
        out["conditionalConcept"] = "thermal_protection"
    elif "bake_heating_element" in bindings or "broil_heating_element" in bindings:
        if "bake_heating_element" in bindings and "broil_heating_element" not in bindings:
            out["instanceScope"] = "bake_heating_element"
        elif "broil_heating_element" in bindings and "bake_heating_element" not in bindings:
            out["instanceScope"] = "broil_heating_element"
    return out


overlay = {
    "schemaVersion": "1.0.0",
    "overlayKind": "manufacturer",
    "canonicalOntologyId": "range_oven",
    "manufacturer": "Samsung",
    "label": "Samsung NY63T8751 dual-fuel range (NY63T8751*)",
    "gateArtifact": "SAMSUNG_NY63T8751SS_RANGE_overlay_mapping_table_v1.json",
    "normalizationSource": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
    "platformFamilies": [
        {
            "platformFamilyId": "samsung_range_ny63",
            "platformId": "samsung_range_ny63",
            "manualId": "SAMSUNG-NY63-DUAL-FUEL",
            "label": "Samsung NY63T8751SS dual-fuel slide-in range",
            "appliesTo": {
                "templateIds": ["dual_fuel_range"],
                "manufacturers": ["Samsung"],
                "modelPatterns": ["NY63T8751*", "NY63T8751SS"],
                "platformIds": ["samsung_range_ny63"],
            },
            "oemTermAliases": {
                "main_pcb": "control_board",
                "sub_pcb": "control_board",
                "glass_touch_panel": "user_interface",
                "touch_film_cns801": "user_interface",
                "cooktop_knobs": "user_interface",
                "oven_sensor": "temperature_sensor",
                "spark_module": "surface_heating_system",
                "valve_cooktop": "surface_heating_system",
                "switch_ignition": "surface_heating_system",
                "electrode": "surface_heating_system",
                "gas_pressure_regulator": "surface_heating_system",
                "gas_orifice_nozzle": "surface_heating_system",
                "surface_burner": "surface_heating_system",
                "heater_bake": "bake_heating_element",
                "heater_broil": "broil_heating_element",
                "convection_heater": "convection_heating_element",
                "door_lock_motor": "oven_door_switch",
            },
            "displayTerms": {
                "power_supply": "240/120V terminal block + gas supply valve prerequisite",
                "control_board": "Main PCB + Sub PCB (DLB / bake / broil / convection relays + spark path)",
                "user_interface": "Glass touch panel + cooktop knobs (C-d0 / C-F2)",
                "temperature_sensor": "Oven RTD — 1080 Ω @ room; CNS600 connector",
                "surface_heating_system": "Gas cooktop — spark module / valve / ignition / orifice / GPR",
                "bake_heating_element": "Electric bake element — 19 Ω @ room",
                "broil_heating_element": "Electric broil element — 13 Ω @ room",
                "convection_heating_element": "Electric convection element — 44 Ω @ room",
                "convection_fan": "Upper/lower convection fan motor — 25–30 Ω",
                "thermal_protection": "Oven thermostat + display cooling fan (C-A2)",
                "oven_door_switch": "Door lock motor + micro-switch (C-d1)",
            },
            "functionalRealizations": FUNCTIONAL_REALIZATIONS,
            "instanceScopeBindings": [
                {
                    "instanceScopeId": "bake_heating_element",
                    "implementationTerms": ["heater_bake", "bake_relay_ry203"],
                    "procedureIds": ["ny63-c21-abnormal-temp", "ny63-symptom-oven-temp-slow"],
                },
                {
                    "instanceScopeId": "broil_heating_element",
                    "implementationTerms": ["heater_broil", "broil_relay_ry202"],
                    "procedureIds": ["ny63-c21-abnormal-temp", "ny63-symptom-oven-temp-slow"],
                },
            ],
            "conditionalInstanceScopeBindings": [
                {
                    "conditionalInstanceScopeId": "convection_heating_element",
                    "implementationTerms": ["convection_heater", "convection_relay_ry207"],
                    "procedureIds": ["ny63-c21-abnormal-temp", "ny63-symptom-oven-temp-slow"],
                }
            ],
            "conditionalConceptBindings": [
                {
                    "conditionalConceptId": "convection_fan",
                    "implementationTerms": ["upper_convection_fan", "lower_convection_fan", "ssr200_ssr201_fan_relays"],
                    "procedureIds": ["ny63-symptom-convection-fan"],
                },
                {
                    "conditionalConceptId": "thermal_protection",
                    "implementationTerms": ["thermostat", "cooling_fan_motor", "control_pba_ntc"],
                    "procedureIds": ["ny63-ca2-display-overtemp", "ny63-symptom-oven-temp-fast"],
                    "errorCodes": ["C-A2", "C-21"],
                },
                {
                    "conditionalConceptId": "oven_door_switch",
                    "implementationTerms": ["door_lock_motor", "door_lock_switch"],
                    "procedureIds": ["ny63-cd1-door-lock"],
                },
            ],
            "add": {
                "components": [
                    {"id": "spark_module", "name": "Cooktop spark module", "aliases": ["spark_module"], "systemId": "surface_heating", "type": "actuator", "implementsCanonicalId": "surface_heating_system"},
                    {"id": "valve_cooktop", "name": "Cooktop gas manifold valve", "aliases": ["valve_cooktop", "assy_valve_cooktop"], "systemId": "surface_heating", "type": "actuator", "implementsCanonicalId": "surface_heating_system"},
                    {"id": "switch_ignition", "name": "Burner ignition switch", "aliases": ["switch_ignition"], "systemId": "surface_heating", "type": "actuator", "implementsCanonicalId": "surface_heating_system"},
                    {"id": "electrode", "name": "Spark electrode", "aliases": ["electrode"], "systemId": "surface_heating", "type": "actuator", "implementsCanonicalId": "surface_heating_system"},
                    {"id": "gas_pressure_regulator", "name": "Gas pressure regulator", "aliases": ["gas_pressure_regulator", "gpr"], "systemId": "surface_heating", "type": "actuator", "implementsCanonicalId": "surface_heating_system"},
                    {"id": "gas_orifice_nozzle", "name": "Burner orifice nozzle", "aliases": ["gas_orifice_nozzle"], "systemId": "surface_heating", "type": "passive", "implementsCanonicalId": "surface_heating_system"},
                    {"id": "heater_bake", "name": "Electric bake element", "aliases": ["heater_bake"], "systemId": "oven_heat_generation", "type": "actuator", "implementsInstanceScopeId": "bake_heating_element"},
                    {"id": "heater_broil", "name": "Electric broil element", "aliases": ["heater_broil"], "systemId": "oven_heat_generation", "type": "actuator", "implementsInstanceScopeId": "broil_heating_element"},
                    {"id": "convection_heater", "name": "Electric convection element", "aliases": ["convection_heater"], "systemId": "oven_heat_generation", "type": "actuator", "implementsConditionalInstanceScopeId": "convection_heating_element"},
                    {"id": "convection_fan_motor", "name": "Convection fan motor", "aliases": ["upper_convection_fan", "lower_convection_fan"], "systemId": "oven_airflow", "type": "actuator", "implementsConditionalConceptId": "convection_fan"},
                    {"id": "door_lock_motor", "name": "Oven door lock motor", "aliases": ["door_lock_motor"], "systemId": "door_authorization", "type": "actuator", "implementsConditionalConceptId": "oven_door_switch"},
                    {"id": "cooling_fan_motor", "name": "Display cooling fan motor", "aliases": ["cooling_fan_motor"], "systemId": "thermal_management", "type": "actuator", "implementsConditionalConceptId": "thermal_protection"},
                ],
                "relationships": [
                    {"from": "spark_module", "to": "surface_heating_system", "type": "implements", "source": "service_manual", "confidence": "high", "note": "CG-13 witness — gas cooktop spark path under surface_heating_system."},
                    {"from": "valve_cooktop", "to": "surface_heating_system", "type": "implements", "source": "service_manual", "confidence": "high"},
                    {"from": "heater_bake", "to": "bake_heating_element", "type": "implements_instance_scope", "source": "service_manual", "confidence": "high", "note": "Electric oven domain — separate from gas cooktop surface."},
                    {"from": "heater_broil", "to": "broil_heating_element", "type": "implements_instance_scope", "source": "service_manual", "confidence": "high"},
                    {"from": "convection_heater", "to": "convection_heating_element", "type": "implements_instance_scope", "source": "service_manual", "confidence": "high"},
                    {"from": "control_board", "to": "surface_heating_system", "type": "controls", "source": "service_manual", "confidence": "high", "note": "Shared control_board orchestrates electric oven relays and cooktop spark module without dual_fuel canonical node."},
                ],
            },
            "procedureBindings": [procedure_binding(p) for p in procedures],
            "measurementBindings": [measurement_binding(m) for m in measurements],
            "decisionBranchBindings": [branch_binding(b) for b in branches],
            "routingRejections": [
                {"conceptId": "dual_fuel_range.json", "verdict": "reject_fuel_specific_canonical", "note": "No dual_fuel_range canonical ontology — range_oven only."},
                {"conceptId": "oven_heating_system", "verdict": "reject_aggregate_resurrection", "note": "Monolithic aggregate remains removed per CG-10."},
                {"conceptId": "dual_energy_control_split", "verdict": "platform_topology_only", "note": "Electric oven + gas cooktop coexist under control_board — CG-13 architectural witness, not canonical promotion."},
            ],
        }
    ],
    "status": "published",
    "gateKind": "samsung_ny63_dual_fuel_range_compounding",
    "compoundingEvidence": {
        "phase": "CG-RANGE-COMPOUNDING",
        "sequence": 3,
        "manualId": "SAMSUNG-NY63-DUAL-FUEL",
        "platformId": "samsung_range_ny63",
        "normalizationArtifact": "CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json",
        "gateArtifact": "SAMSUNG_NY63T8751SS_RANGE_overlay_mapping_table_v1.json",
        "auditArtifact": "CG_RANGE_NY63T8751SS_COMPOUNDING_AUDIT_v1.json",
        "accounting": {
            "canonicalInheritances": 5,
            "instanceScopeBindings": 2,
            "conditionalInstanceScopeBindings": 1,
            "conditionalBindings": 3,
            "overlayImplementationComponents": 12,
            "proceduresBound": len(procedures),
            "measurementsBound": len(measurements),
            "decisionBranchesExecutable": len(branches),
            "functionalRealizations": len(FUNCTIONAL_REALIZATIONS),
            "canonicalExpansion": 0,
            "ontologyMutations": 0,
        },
        "publishedAt": "2026-09-17T06:00:00+00:00",
    },
}

OUT.write_text(json.dumps(overlay, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {OUT}")
print(f"procedures={len(procedures)} measurements={len(measurements)} branches={len(branches)} realizations={len(FUNCTIONAL_REALIZATIONS)}")
