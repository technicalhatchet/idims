# Samsung NE58H/NE58R induction slide-in range — extraction

**Source:** `backend/docs/manuals/samsunginductionne58h.pdf`  
**Extracted text:** `backend/docs/manuals/samsunginductionne58h-extracted.txt`  
**Scope:** NE58*9560W* / NE58R9560WS / NE58H9970WS — 30" slide-in induction + oven  
**Platform:** `samsung_range_ne58` · `templateId`: `induction_range`  
**Manual ID:** `SAMSUNG-NE58H-INDUCTION-RANGE`  
**Frozen ontology:** `range_oven` (CG-12 fit — implementation overlay for IPC/IGBT/inverter)  
**Fit context:** `CG12_INDUCTION_FIT_CLOSURE_v1.json`, `SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json`

---

## Pilot role (P05)

Implementation terminology stress — IPC, IGBT, Assy-Inverter Module, pan detection, and glass touch PCB must route to **overlay candidates**, never canonical promotion.

---

## Failure codes (§4-1)

| Code | Domain | Procedure |
|------|--------|-----------|
| **C-d0** | Key short | `ne58h-cd0-key-short` |
| **C-d1** | Door lock | `ne58h-cd1-door-lock` |
| **C-F0** | Main ↔ sub comm | `ne58h-cf0-main-sub` |
| **C-F2** | Touch comm | `ne58h-cf2-touch` |
| **C-20** | Oven sensor | `ne58h-c20-oven-sensor` |
| **C-21** | Abnormal oven temp | `ne58h-c21-abnormal-temp` |
| Cooktop flows | IGBT / pan / overtemp | `ne58h-induction-igbt-sensor`, `ne58h-induction-pan-detection`, `ne58h-induction-comm-inverter` |

---

## Implementation vocabulary (overlay only)

`assy_inverter_module`, `igbt_sensor`, `working_coil`, `pan_detection`, `glass_touch_pcb`, `filter_pcb`, `main_pcb`, `sub_pcb`

---

## Procedure index

| ID | OEM | Tags |
|----|-----|------|
| `ne58h-power` | §4-3 power | no_power |
| `ne58h-cf0-main-sub` | C-F0 | hmi_check |
| `ne58h-cf2-touch` | C-F2 | hmi_check |
| `ne58h-c20-oven-sensor` | C-20 | sensor_check |
| `ne58h-c21-abnormal-temp` | C-21 | no_bake |
| `ne58h-cd1-door-lock` | C-d1 | door_lock_check |
| `ne58h-induction-igbt-sensor` | IGBT open/short | igniter_check |
| `ne58h-induction-pan-detection` | Pan detection | surface_burner |
| `ne58h-induction-comm-inverter` | Display ↔ inverter | hmi_check |
| `ne58h-bake-element` | §4-3 bake | no_bake |
| `ne58h-convection-fan` | Convection fan | long_bake |
