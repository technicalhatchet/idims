# CG-9 — Samsung RS28 SxS Family Boundary Discovery Report

**Generated:** 2026-09-16T12:55:37.199782+00:00
**Phase:** discovery only — canonical expansion = 0, freeze reopened = False

## Manual studied

- **Primary:** `SAMSUNG-RS28-SXS` (RS28A500ASR)
- **Platform:** `samsung_sxs`
- **Procedures:** 0 seeds (0 with measurement steps)

SAMSUNG-RS28-SXS is the richest SxS anchor: 17 RS28 procedure seeds + shared RF260B variants on samsung_sxs, full §4-2 self-diagnostic checklist, and cross-linked svc manual for door-switch flowcharts. RS22T reuses RS28 seeds; RF260B is platform sibling only.

## Six KEEP functions (SxS independent evidence)

| Concept | Disposition | Confidence |
|---------|-------------|------------|
| control_board | shared_function | high |
| user_interface | shared_function | high |
| door_switch | shared_function | medium |
| evaporator_fan | shared_function | high |
| air_damper | shared_function | high |
| defrost_heater | shared_function | high |

## Five conditional concepts

| Concept | Assessment | Disposition |
|---------|------------|-------------|
| temperature_sensor | same_functional_role | shared_function |
| compressor | same_functional_role | shared_function |
| condenser_fan | unresolved_implementation_ambiguity | needs_second_manual |
| ice_maker | same_functional_role | shared_function |
| water_dispenser | same_functional_role | shared_function |

## Family-boundary hypotheses (evidence status only)

### hypothesisA_shareFrenchDoorOntology
- **Status:** supported
- Side-by-side shares existing french_door_refrigerator functional ontology.

### hypothesisB_broaderRefrigeratorOntology
- **Status:** supported
- French-door and side-by-side belong to a broader refrigerator ontology; current freeze is configuration-scoped naming.

### hypothesisC_distinctSideBySideOntology
- **Status:** contradicted
- Side-by-side requires a distinct canonical functional ontology.

### hypothesisD_insufficientEvidence
- **Status:** partially_unresolved
- Evidence insufficient to decide family boundary.

## Recommended next step

Run CG-9 R2 with Whirlpool W11296289 SxS before any canonical family decision. If R2 confirms functional alignment, treat french_door_refrigerator as operationally shared refrigerator functional ontology (Hypothesis A+B) and defer ontology rename to a future human re-freeze gate — do NOT create side_by_side_refrigerator.json from one Samsung manual.
