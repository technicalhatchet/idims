#!/usr/bin/env python3
"""Generate W11174814 corroboration overlay from normalization artifact."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAL = ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
OUT = (
    ROOT
    / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays/whirlpool_freestanding_range_w11174814.json"
)

norm = json.loads((CAL / "CG_RANGE_W11174814_NORMALIZATION_v1.json").read_text(encoding="utf-8"))

procedures = norm["normalizedProcedures"]
measurements = norm["normalizedMeasurements"]
branches = norm["normalizedDecisionBranches"]

FUNCTIONAL_REALIZATIONS = [
    {
        "canonicalLayer": "temperature_sensor",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "oven_rtd", "displayLabel": "Main oven temperature sensor (RTD)"},
        "diagnosticEvidence": {
            "spec": "1000–1200 Ω @ room — P10/P3/Con3 test points per control family",
            "measurementIds": ["w11174814-oven-sensor-ohms"],
            "procedureIds": ["w11174426-oven-sensor", "w11746350-oven-sensor"],
            "branchIds": ["w11174814-f3e0-sensor-fault"],
            "errorCodes": ["F3E0"],
        },
        "corroborationNote": "Samsung witnesses ~1080 Ω — same functional layer, OEM band differs",
        "provenance": {
            "normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json",
            "sourceManual": "W11174814",
            "section": "3-33 / 3-41",
            "pages": [45, 73],
        },
    },
    {
        "canonicalLayer": "surface_heating_system",
        "canonicalLayerKind": "component",
        "fuelSlice": "electric_radiant",
        "implementation": {"platformTerm": "infinite_switch", "displayLabel": "Cooktop infinite switch + limiter"},
        "diagnosticEvidence": {
            "procedureIds": ["w11174426-infinite-switch", "w11746350-bridge-element"],
            "branchIds": ["w11174814-infinite-switch-fault"],
        },
        "corroborationNote": "Radiant surface path — parallels electric ceran surface vocabulary",
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-41", "pages": [45, 47]},
    },
    {
        "canonicalLayer": "surface_heating_system",
        "canonicalLayerKind": "component",
        "fuelSlice": "electric_radiant",
        "implementation": {"platformTerm": "ceran_element", "displayLabel": "Ceran radiant cooktop element"},
        "diagnosticEvidence": {
            "spec": "23–83 Ω H1↔H2; thermal limiter opens 1100°F",
            "measurementIds": ["w11174814-ceran-element-ohms"],
            "procedureIds": ["w11174814-ceran-element"],
            "branchIds": ["w11174814-ceran-open-replace"],
        },
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-47", "pages": [86, 87]},
    },
    {
        "canonicalLayer": "surface_heating_system",
        "canonicalLayerKind": "component",
        "fuelSlice": "induction",
        "implementation": {"platformTerm": "ipc_induction_power_control", "displayLabel": "Induction Power Control (IPC) module"},
        "diagnosticEvidence": {
            "procedureIds": ["w11174814-induction-ipc-path"],
            "branchIds": ["w11174814-ipc-replace-module"],
            "implementationTerms": ["coil_thermistor_j604_j605", "blower_j205"],
        },
        "corroborationNote": "Whirlpool IPC parallels Samsung inverter/IGBT — surface_heating_system only",
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "4-05 / 4-10", "pages": [66, 67]},
    },
    {
        "canonicalLayer": "surface_heating_system",
        "canonicalLayerKind": "component",
        "fuelSlice": "gas",
        "implementation": {"platformTerm": "surface_spark_module", "displayLabel": "Surface burner spark module"},
        "diagnosticEvidence": {
            "spec": "120 VAC L↔N with knob in LITE",
            "measurementIds": ["w11174814-surface-spark-vac"],
            "procedureIds": ["w11174426-surface-spark", "w11746350-surface-spark"],
            "branchIds": ["w11174814-surface-spark-no-voltage"],
        },
        "corroborationNote": "Gas surface spark — parallels NX60/NY63 spark_module vocabulary",
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-44", "pages": [47]},
    },
    {
        "canonicalLayer": "bake_heating_element",
        "canonicalLayerKind": "instanceScope",
        "fuelSlice": "electric_radiant",
        "implementation": {"platformTerm": "bake_element", "displayLabel": "Visible/hidden electric bake element"},
        "diagnosticEvidence": {
            "spec": "10–40 Ω visible; ~23.3 Ω Copernicus hidden bake",
            "measurementIds": ["w11174814-bake-element-ohms", "w11174814-hidden-bake-ohms"],
            "procedureIds": ["w11174426-bake-element", "w11746350-bake-element"],
            "branchIds": ["w11174814-bake-element-out-of-range"],
        },
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-33 / 3", "pages": [73, 47]},
    },
    {
        "canonicalLayer": "bake_heating_element",
        "canonicalLayerKind": "instanceScope",
        "fuelSlice": "gas",
        "implementation": {"platformTerm": "bake_igniter", "displayLabel": "Gas oven bake hot-surface igniter"},
        "diagnosticEvidence": {
            "spec": "40–400 Ω cold; DSI coil 216 Ω",
            "measurementIds": ["w11174814-gas-igniter-ohms", "w11174814-dsi-coil-ohms"],
            "procedureIds": ["w11174814-gas-igniter", "w11174426-dsi-board", "w11746350-dsi-gas-valve"],
            "branchIds": ["w11174814-igniter-out-of-range", "w11174814-dsi-coil-fault"],
        },
        "corroborationNote": "Gas bake path via DSI — parallels NX60 HSI instance scope binding",
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-47 / 3-36", "pages": [76, 86]},
    },
    {
        "canonicalLayer": "broil_heating_element",
        "canonicalLayerKind": "instanceScope",
        "implementation": {"platformTerm": "broil_element", "displayLabel": "Electric or gas broil path"},
        "diagnosticEvidence": {
            "spec": "10–40 Ω electric broil; gas igniter 40–400 Ω",
            "measurementIds": ["w11174814-broil-element-ohms", "w11174814-gas-igniter-ohms"],
            "procedureIds": ["w11174426-broil-element", "w11174814-gas-igniter"],
            "branchIds": ["w11174814-broil-element-out-of-range", "w11174814-igniter-out-of-range"],
        },
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-33 / 3-47", "pages": [73, 86]},
    },
    {
        "canonicalLayer": "convection_heating_element",
        "canonicalLayerKind": "conditionalInstanceScope",
        "implementation": {"platformTerm": "convection_heater", "displayLabel": "Convection heating element"},
        "diagnosticEvidence": {
            "spec": "~16 Ω Maxwell gas convection element",
            "measurementIds": ["w11174814-convection-element-ohms"],
            "procedureIds": ["w11746350-convect-element"],
        },
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-36", "pages": [76]},
    },
    {
        "canonicalLayer": "convection_fan",
        "canonicalLayerKind": "conditionalConcept",
        "implementation": {"platformTerm": "convection_fan_motor", "displayLabel": "Convection fan motor"},
        "diagnosticEvidence": {
            "spec": "85–90 Ω Maxwell; 80–95 Ω Indigo; 10–80 Ω LCC gas",
            "measurementIds": ["w11174814-convection-fan-ohms"],
            "procedureIds": ["w11746350-vent-fan"],
        },
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-33", "pages": [73]},
    },
    {
        "canonicalLayer": "oven_door_switch",
        "canonicalLayerKind": "conditionalConcept",
        "implementation": {"platformTerm": "door_latch_motor", "displayLabel": "Door latch motor / position switch"},
        "diagnosticEvidence": {
            "spec": "500–3000 Ω latch motor",
            "measurementIds": ["w11174814-door-latch-ohms"],
            "procedureIds": ["w11174426-door-latch", "w11746350-door-latch"],
            "branchIds": ["w11174814-door-latch-fault"],
            "errorCodes": ["F5E1"],
        },
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-41", "pages": [45]},
    },
    {
        "canonicalLayer": "thermal_protection",
        "canonicalLayerKind": "conditionalConcept",
        "implementation": {"platformTerm": "thermo_fuse", "displayLabel": "Oven thermo fuse + cooktop limiter"},
        "diagnosticEvidence": {
            "spec": "Thermo fuse continuity; opens >363°F rear; limiter 1050°F",
            "procedureIds": ["w11746350-thermal-fuse"],
            "branchIds": ["w11174814-thermo-fuse-open"],
        },
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "3-33", "pages": [73]},
    },
    {
        "canonicalLayer": "control_board",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "control_family", "displayLabel": "Maxwell / LCX-LCC / Indigo / Copernicus ACU + DSI"},
        "diagnosticEvidence": {
            "spec": "DSI 8–18 VDC; coil 216 Ω; multi-family diagnostic entry bundles",
            "measurementIds": ["w11174814-dsi-voltage", "w11174814-dsi-coil-ohms", "w11174814-control-supply-vac"],
            "procedureIds": ["w11174426-acu-power", "w11174426-dsi-board", "w11746350-acu-power", "w11746350-dsi-gas-valve"],
            "branchIds": ["w11174814-dsi-coil-fault", "w11174814-control-replace", "w11174814-acu-comm-fault"],
        },
        "corroborationNote": "Cross-domain control without dual_fuel canonical node — corroborates CG-13",
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "2 / 3-36", "pages": [25, 76]},
    },
    {
        "canonicalLayer": "user_interface",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "touch_keypad", "displayLabel": "Touch keypad / infinite knobs / Indigo UI"},
        "diagnosticEvidence": {
            "procedureIds": ["w11174426-hmi", "w11746350-hmi"],
            "branchIds": ["w11174814-hmi-replace-control"],
            "errorCodes": ["F2E1"],
        },
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "2", "pages": [25, 26]},
    },
    {
        "canonicalLayer": "power_supply",
        "canonicalLayerKind": "component",
        "implementation": {"platformTerm": "line_supply", "displayLabel": "240 V wall outlet + 120 V control supply"},
        "diagnosticEvidence": {
            "spec": "240+10%/-15% V wall; 120 VAC P1-1↔P1-3",
            "measurementIds": ["w11174814-wall-supply-vac", "w11174814-control-supply-vac"],
            "procedureIds": ["w11174426-acu-power", "w11746350-acu-power"],
            "branchIds": ["w11174814-control-replace"],
        },
        "provenance": {"normalizationRef": "CG_RANGE_W11174814_NORMALIZATION_v1.json", "sourceManual": "W11174814", "section": "2 / 3-33", "pages": [25, 73]},
    },
]


def procedure_binding(p: dict) -> dict:
    out = {
        "procedureId": p["procedureId"],
        "displayTitle": p["title"],
        "oemSection": p["source"]["section"],
        "sourcePages": p["source"]["pages"],
    }
    if p.get("fuelSlice"):
        out["fuelSlice"] = p["fuelSlice"]
    if p.get("controlFamily"):
        out["controlFamily"] = p["controlFamily"]
    if p.get("accessoryOnly"):
        out["platformOnly"] = True
        out["corroborationNote"] = "Accessory/platform procedure — not canonical promotion"
    bindings = p.get("rangeOvenBindings", [])
    canonical = [b for b in bindings if b in {
        "power_supply", "control_board", "user_interface", "temperature_sensor", "surface_heating_system",
    }]
    if canonical:
        out["canonicalComponents"] = canonical
    if "bake_heating_element" in bindings and "broil_heating_element" not in bindings:
        out["instanceScope"] = "bake_heating_element"
    elif "broil_heating_element" in bindings and "bake_heating_element" not in bindings:
        out["instanceScope"] = "broil_heating_element"
    if "convection_heating_element" in bindings:
        out["conditionalInstanceScope"] = "convection_heating_element"
    conditional = [b for b in bindings if b in {"convection_fan", "thermal_protection", "oven_door_switch"}]
    if conditional:
        out["conditionalConcepts"] = conditional
    return out


def measurement_binding(m: dict) -> dict:
    out = {"normalizationId": m["id"]}
    if m.get("accessoryOnly"):
        out["platformOnly"] = True
    for p in procedures:
        if m["id"] in p.get("measurementIds", []):
            out["procedureId"] = p["procedureId"]
            break
    binding = m.get("rangeOvenBinding")
    if not binding:
        return out
    if binding == "temperature_sensor":
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
    return out


def branch_binding(b: dict) -> dict:
    out = {"branchId": b["id"], "procedureId": b["procedureId"], "executable": True}
    proc = next(p for p in procedures if p["procedureId"] == b["procedureId"])
    bindings = proc.get("rangeOvenBindings", [])
    if proc.get("accessoryOnly"):
        out["platformOnly"] = True
    elif "surface_heating_system" in bindings:
        out["canonicalLayer"] = "surface_heating_system"
    elif "temperature_sensor" in bindings:
        out["canonicalLayer"] = "temperature_sensor"
    elif "control_board" in bindings or "power_supply" in bindings:
        out["canonicalLayer"] = "control_board"
    elif "oven_door_switch" in bindings:
        out["conditionalConcept"] = "oven_door_switch"
    elif "thermal_protection" in bindings:
        out["conditionalConcept"] = "thermal_protection"
    elif "bake_heating_element" in bindings:
        out["instanceScope"] = "bake_heating_element"
    elif "broil_heating_element" in bindings:
        out["instanceScope"] = "broil_heating_element"
    return out


overlay = {
    "schemaVersion": "1.0.0",
    "overlayKind": "manufacturer",
    "compoundingRole": "corroboration",
    "notRetroactiveFitEvidence": True,
    "canonicalOntologyId": "range_oven",
    "manufacturer": "Whirlpool",
    "manufacturerFamily": ["Whirlpool", "Maytag", "KitchenAid", "Kenmore", "JennAir", "IKEA", "Amana"],
    "label": "Whirlpool-family freestanding range — W11174814 corroboration corpus",
    "gateArtifact": "WHIRLPOOL_W11174814_RANGE_overlay_mapping_table_v1.json",
    "normalizationSource": "CG_RANGE_W11174814_NORMALIZATION_v1.json",
    "corroborationPolicy": {
        "purpose": "Cross-manufacturer corroboration of range_oven contract — not retroactive CG-10–13 fit evidence",
        "notRetroactiveFitEvidence": True,
        "doesNotReopen": ["CG-10", "CG-11", "CG-12", "CG-13"],
        "samsungWitnessOverlaysUntouched": [
            "samsung_range_nx60.json",
            "samsung_range_ne58.json",
            "samsung_range_ny63.json",
        ],
    },
    "platformFamilies": [
        {
            "platformFamilyId": "whirlpool_freestanding_range_w11174814",
            "platformId": "whirlpool_freestanding_range",
            "manualId": "W11174814",
            "label": "Whirlpool-family freestanding range (W11174814 corroboration)",
            "appliesTo": {
                "templateIds": ["electric_range", "gas_range", "induction_range", "dual_fuel_range"],
                "manufacturers": ["Whirlpool", "Maytag", "KitchenAid", "Kenmore", "JennAir", "IKEA", "Amana"],
                "modelPatterns": ["WFE*", "WFG*", "MER*", "MGR*", "KFE*", "KFG*", "JES*", "JGS*", "AER*", "AGR*"],
                "platformIds": ["whirlpool_freestanding_range"],
            },
            "fuelImplementationSlices": ["electric_radiant", "induction", "gas", "dual_fuel"],
            "oemTermAliases": {
                "infinite_switch": "surface_heating_system",
                "ceran_element": "surface_heating_system",
                "ipc_induction_power_control": "surface_heating_system",
                "surface_spark_module": "surface_heating_system",
                "dsi_board": "control_board",
                "bake_element": "bake_heating_element",
                "hidden_bake_element": "bake_heating_element",
                "broil_element": "broil_heating_element",
                "hot_surface_igniter": "bake_heating_element",
                "door_latch_motor": "oven_door_switch",
                "thermo_fuse": "thermal_protection",
            },
            "displayTerms": {
                "power_supply": "240 V wall outlet + 120 V control supply",
                "control_board": "Maxwell / LCX-LCC / Indigo / Copernicus + DSI boards",
                "user_interface": "Touch keypad / infinite knobs / Indigo UI",
                "temperature_sensor": "Main oven RTD — 1000–1200 Ω @ room",
                "surface_heating_system": "Radiant infinite switch / ceran / IPC induction / gas spark",
                "bake_heating_element": "Electric bake or gas DSI/igniter path",
                "broil_heating_element": "Electric broil or gas igniter path",
                "convection_heating_element": "Convection element (~16 Ω gas Maxwell)",
                "convection_fan": "Convection fan motor — family-specific Ω bands",
                "thermal_protection": "Thermo fuse + cooktop limiter switches",
                "oven_door_switch": "Door latch motor 500–3000 Ω (F5E1)",
            },
            "functionalRealizations": FUNCTIONAL_REALIZATIONS,
            "instanceScopeBindings": [
                {
                    "instanceScopeId": "bake_heating_element",
                    "implementationTerms": ["bake_element", "hidden_bake_element", "bake_igniter", "dsi_board"],
                    "fuelSlices": ["electric_radiant", "gas"],
                },
                {
                    "instanceScopeId": "broil_heating_element",
                    "implementationTerms": ["broil_element", "broil_igniter"],
                    "fuelSlices": ["electric_radiant", "gas"],
                },
            ],
            "conditionalInstanceScopeBindings": [
                {
                    "conditionalInstanceScopeId": "convection_heating_element",
                    "implementationTerms": ["convection_heater"],
                    "procedureIds": ["w11746350-convect-element"],
                }
            ],
            "conditionalConceptBindings": [
                {"conditionalConceptId": "convection_fan", "implementationTerms": ["convection_fan_motor"], "procedureIds": ["w11746350-vent-fan"]},
                {"conditionalConceptId": "thermal_protection", "implementationTerms": ["thermo_fuse", "limiter_switch"], "procedureIds": ["w11746350-thermal-fuse"]},
                {"conditionalConceptId": "oven_door_switch", "implementationTerms": ["door_latch_motor"], "procedureIds": ["w11174426-door-latch", "w11746350-door-latch"]},
            ],
            "add": {
                "components": [
                    {"id": "infinite_switch", "name": "Cooktop infinite switch", "systemId": "surface_heating", "type": "actuator", "implementsCanonicalId": "surface_heating_system", "fuelSlice": "electric_radiant"},
                    {"id": "ceran_element", "name": "Ceran radiant element", "systemId": "surface_heating", "type": "actuator", "implementsCanonicalId": "surface_heating_system", "fuelSlice": "electric_radiant"},
                    {"id": "ipc_induction_power_control", "name": "Induction Power Control module", "aliases": ["IPC", "induction_module"], "systemId": "surface_heating", "type": "actuator", "implementsCanonicalId": "surface_heating_system", "fuelSlice": "induction"},
                    {"id": "surface_spark_module", "name": "Surface burner spark module", "systemId": "surface_heating", "type": "actuator", "implementsCanonicalId": "surface_heating_system", "fuelSlice": "gas"},
                    {"id": "dsi_board", "name": "DSI ignition board", "systemId": "oven_heat_generation", "type": "actuator", "implementsCanonicalId": "control_board", "fuelSlice": "gas"},
                    {"id": "bake_element", "name": "Electric bake element", "systemId": "oven_heat_generation", "type": "actuator", "implementsInstanceScopeId": "bake_heating_element"},
                    {"id": "hidden_bake_element", "name": "Hidden bake element (Copernicus)", "systemId": "oven_heat_generation", "type": "actuator", "implementsInstanceScopeId": "bake_heating_element"},
                    {"id": "broil_element", "name": "Electric broil element", "systemId": "oven_heat_generation", "type": "actuator", "implementsInstanceScopeId": "broil_heating_element"},
                    {"id": "bake_igniter", "name": "Gas bake hot-surface igniter", "systemId": "oven_heat_generation", "type": "actuator", "implementsInstanceScopeId": "bake_heating_element", "fuelSlice": "gas"},
                    {"id": "convection_heater", "name": "Convection heating element", "systemId": "oven_heat_generation", "type": "actuator", "implementsConditionalInstanceScopeId": "convection_heating_element"},
                    {"id": "convection_fan_motor", "name": "Convection fan motor", "systemId": "oven_airflow", "type": "actuator", "implementsConditionalConceptId": "convection_fan"},
                    {"id": "door_latch_motor", "name": "Door latch motor", "systemId": "door_authorization", "type": "actuator", "implementsConditionalConceptId": "oven_door_switch"},
                    {"id": "thermo_fuse", "name": "Oven thermo fuse", "systemId": "thermal_management", "type": "passive", "implementsConditionalConceptId": "thermal_protection"},
                    {"id": "warming_drawer_element", "name": "Warming drawer element", "systemId": "accessory", "type": "actuator", "note": "PLATFORM_ONLY — accessory, not canonical"},
                    {"id": "warming_drawer_rtd", "name": "Warming drawer RTD", "systemId": "accessory", "type": "sensor", "note": "PLATFORM_ONLY — F3E2 accessory sensor"},
                    {"id": "oven_light_assembly", "name": "Oven light assembly", "systemId": "accessory", "type": "actuator", "note": "PLATFORM_ONLY — not canonical oven_light node"},
                ],
                "relationships": [
                    {"from": "ipc_induction_power_control", "to": "surface_heating_system", "type": "implements", "source": "service_manual", "confidence": "high", "note": "Corroborates CG-12 — induction under surface_heating_system."},
                    {"from": "surface_spark_module", "to": "surface_heating_system", "type": "implements", "source": "service_manual", "confidence": "high", "note": "Corroborates CG-11 gas surface vocabulary."},
                    {"from": "bake_element", "to": "bake_heating_element", "type": "implements_instance_scope", "source": "service_manual", "confidence": "high"},
                    {"from": "dsi_board", "to": "control_board", "type": "implements", "source": "service_manual", "confidence": "high", "note": "Gas oven DSI orchestration — dual-domain corroboration for CG-13."},
                ],
            },
            "procedureBindings": [procedure_binding(p) for p in procedures],
            "measurementBindings": [measurement_binding(m) for m in measurements],
            "decisionBranchBindings": [branch_binding(b) for b in branches],
            "routingRejections": [
                {"conceptId": "dual_fuel_range.json", "verdict": "reject_fuel_specific_canonical", "note": "No dual_fuel_range canonical ontology — range_oven only."},
                {"conceptId": "whirlpool_freestanding_range.json", "verdict": "reject_fuel_specific_canonical", "note": "Platform overlay only — not canonical graph."},
                {"conceptId": "oven_heating_system", "verdict": "reject_aggregate_resurrection", "note": "Monolithic aggregate remains removed per CG-10."},
                {"conceptId": "warming_drawer", "verdict": "platform_accessory_only", "note": "Optional accessory — not canonical promotion."},
            ],
        }
    ],
    "status": "published",
    "gateKind": "whirlpool_w11174814_range_corroboration_compounding",
    "compoundingEvidence": {
        "phase": "CG-RANGE-COMPOUNDING",
        "sequence": 4,
        "role": "corroboration",
        "notRetroactiveFitEvidence": True,
        "manualId": "W11174814",
        "platformId": "whirlpool_freestanding_range",
        "normalizationArtifact": "CG_RANGE_W11174814_NORMALIZATION_v1.json",
        "gateArtifact": "WHIRLPOOL_W11174814_RANGE_overlay_mapping_table_v1.json",
        "auditArtifact": "CG_RANGE_W11174814_COMPOUNDING_AUDIT_v1.json",
        "accounting": {
            "canonicalInheritances": 5,
            "instanceScopeBindings": 2,
            "conditionalInstanceScopeBindings": 1,
            "conditionalBindings": 3,
            "overlayImplementationComponents": 16,
            "proceduresBound": len(procedures),
            "measurementsBound": len(measurements),
            "decisionBranchesExecutable": len(branches),
            "functionalRealizations": len(FUNCTIONAL_REALIZATIONS),
            "platformOnlyProcedures": 3,
            "canonicalExpansion": 0,
            "ontologyMutations": 0,
            "fitArtifactsReopened": 0,
        },
        "publishedAt": "2026-09-17T06:30:00+00:00",
    },
}

OUT.write_text(json.dumps(overlay, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {OUT}")
print(
    f"procedures={len(procedures)} measurements={len(measurements)} "
    f"branches={len(branches)} realizations={len(FUNCTIONAL_REALIZATIONS)}"
)
