# LG WM4000H*A front-load washer — extraction

**Source:** `backend/docs/manuals/lg wm4000h fl washer service manual.pdf`  
**Extracted text:** `backend/docs/manuals/lg wm4000h fl washer service manual-extracted.txt`  
**Scope:** WM3400–WM4000 family (WM4000H*A pilot witness) — 54-page service manual  
**Platform:** `lg_fl_washer_wm4000` · `templateId`: `washer`  
**Manual ID:** `LG-FL-WASHER`  
**Frozen ontology:** `front_load_washer` (CG pilot P03 — third-manufacturer mapping)

---

## Pilot role (P03)

Third-manufacturer FL washer mapping onto frozen `front_load_washer`. LG-specific implementation vocabulary (DISPLAY PWB, MAIN PWB, Smart Diagnosis, ThinQ, circulation pump naming) must route to **overlay / implementation_specific** candidates — not canonical promotion.

---

## Extraction limitations

PDF is predominantly image-based (46/54 pages sparse in pymupdf extract). Component inventory and model-variant matrix verified from §11 wiring diagram (p.53) and feature sections (p.4–6, p.13–15, p.18). Troubleshooting tables (§7) and component test Ω specs (§8) require diagram review — seeds use wiring-label anchors until full OCR pass.

---

## Model variant matrix (p.53 notes)

| Models | Circulation pump | Heater | Wi-Fi |
|--------|------------------|--------|-------|
| WM3400 | No | No | No |
| WM3460 / WM3500 | No | No | — |
| WM3600 / WM3700 | No | — | — |
| WM3900 / WM4000 | Yes | Yes | Yes (WM4000) |

Pilot smoke model: **WM4000H*A** (full feature set).

---

## Wiring diagram components (§11, p.53)

`DISPLAY PWB`, `MAIN PWB`, `CIRCULATION PUMP`, `DRAIN PUMP`, `MOTOR`, `WASH THERMISTOR`, `PRESSURE SENSOR`, `VALVE HOT`, `VALVE BLEACH`, `VALVE PRE`, `VALVE INLET`, `DOOR LOCK`, `WASHER HEATER`, `VIBRATION SENSOR`, `Wi-Fi` module.

Main PCB part reference: **MEZ50402101** (WM3600/WM4000 family).

---

## Implementation vocabulary (overlay only)

`display_pwb`, `main_pwb`, `smart_diagnosis`, `thinq`, `wifi_module`, `circulation_pump` (LG label → canonical `recirc_pump` via overlay), `vibration_sensor`

---

## Procedure index

| ID | OEM section | Tags |
|----|-------------|------|
| `lgwm4000-power` | §4 install / supply | no_power |
| `lgwm4000-door-lock` | §8 door lock | door_lock_check |
| `lgwm4000-drain-pump` | §8 drain pump | drain_failure |
| `lgwm4000-motor-circuit` | §8 direct-drive motor | motor_check |
| `lgwm4000-wash-thermistor` | §8 wash thermistor | heating_failure |
| `lgwm4000-pressure-sensor` | §8 pressure sensor | water_level_failure |
| `lgwm4000-inlet-valves` | §8 inlet / bleach / pre-wash valves | fill_failure |
| `lgwm4000-wash-heater` | §8 washer heater | heating_failure |
| `lgwm4000-circulation-pump` | §8 circulation pump | recirc_failure |
| `lgwm4000-display-comm` | §8 display ↔ main PWB | hmi_check |
| `lgwm4000-vibration-sensor` | §8 vibration sensor | vibration_unbalance |
| `lgwm4000-smart-diagnosis` | §2 Smart Diagnosis / ThinQ | hmi_check |

---

## Service mode

§6 TEST MODE (p.18) — SPIN/SOIL/Delay Wash entry; bundle deferred v1 (image-only steps).
