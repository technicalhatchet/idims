# CG-9 — LG LSC27926 SxS Family Boundary Discovery Report

**Generated:** 2026-09-16T13:46:47.778784+00:00
**Phase:** discovery only — canonical expansion = 0, freeze reopened = False

## Manual studied

- **Primary:** `LG-LSC27926-SXS` (LSC27926ST)
- **Platform:** `lg_sxs`
- **Procedures:** 0 seeds (0 with measurement steps)

LG-LSC27926-SXS is the LG SxS anchor: 14 lgsxs-* procedure seeds + test-mode bundle, conventional relay compressor (distinct from lg_lrmvs linear), BLDC F/C fans, OptiChill damper, and dedicated door-switch procedure with Test 1 fan-stop evidence.

## Six KEEP functions (SxS independent evidence)

| Concept | Disposition | Confidence |
|---------|-------------|------------|
| control_board | shared_function | high |
| user_interface | shared_function | high |
| door_switch | shared_function | high |
| evaporator_fan | shared_function | high |
| air_damper | shared_function | high |
| defrost_heater | shared_function | high |

## Five conditional concepts

| Concept | Assessment | Disposition |
|---------|------------|-------------|
| temperature_sensor | same_functional_role | shared_function |
| compressor | same_functional_role | shared_function |
| condenser_fan | same_functional_role | shared_function |
| ice_maker | same_functional_role | shared_function |
| water_dispenser | same_functional_role | shared_function |

## Family-boundary hypotheses (evidence status only)

### hypothesisA_shareFrenchDoorOntology
- **Status:** supported
- LG SxS shares existing french_door_refrigerator functional ontology.

### hypothesisB_broaderRefrigeratorOntology
- **Status:** supported
- French-door and side-by-side belong to a broader refrigerator ontology; current freeze is configuration-scoped naming.

### hypothesisC_distinctSideBySideOntology
- **Status:** contradicted
- LG SxS requires a distinct canonical functional ontology.

### hypothesisD_insufficientEvidence
- **Status:** contradicted
- Evidence insufficient to decide family boundary for LG SxS.

## Recommended next step

Proceed to CG-9.5 WP3 production compounding for LSC27926 SxS. CG-9 R2 triangulation already closed family boundary — this observation confirms LG SxS aligns with frozen refrigerator contract without canonical expansion. Do NOT import lg_lrmvs linear-compressor vocabulary.
