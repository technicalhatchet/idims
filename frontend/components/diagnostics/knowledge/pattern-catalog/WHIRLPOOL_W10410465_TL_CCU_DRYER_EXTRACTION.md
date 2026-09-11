# Whirlpool/Maytag CCU top-load dryer — W10410465 extraction

**Source:** `backend/docs/manuals/WPL Top load Dryer Service Manual.pdf` (Part W10410465A)  
**Extracted text:** `backend/docs/manuals/WPL Top load Dryer Service Manual-extracted.txt`  
**Scope:** 27 in. top-load CCU dryer — color LCD console, myst (steam) valve, dual-element electric heat, belt switch motor path  
**Platform:** `whirlpool_ccu_tl_dryer` (new — separate from FL `whirlpool_ccu_dryer` catch-all and ACU TL `whirlpool_acu_tl_dryer`)  
**Status:** 15 TEST procedures + 1 diagnostic-entry bundle; batch9 CCU measurement knowledge reused

Cross-reference: [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md) (W10680150 FL CCU — same P* pinouts), [WHIRLPOOL_W11416805_DRYER_EXTRACTION.md](./WHIRLPOOL_W11416805_DRYER_EXTRACTION.md) (ACU TL — different architecture).

**Do not** reuse Duet Sport MCE specs, W11416805 ACU TL pinouts, or Centennial timer-dryer specs.

---

## 1. Platform decision

| Option | Verdict |
|--------|---------|
| Extend `whirlpool_ccu_dryer` with TL patterns | **Rejected** — `/WED/i` catch-all mis-routes FL CCU; WED8500 collides with Duet Sport `/WED85/i` |
| New `whirlpool_ccu_tl_dryer` | **Accepted** — TL Cabrio/HE LCD CCU family; placed **before** Duet Sport in registry |

### Model patterns (electric + gas rules)

Manual does not print a nomenclature table; patterns target Cabrio / HE top-load CCU LCD console era (39 in cabinet, myst valve, Figure 11 CCU pinout):

| Pattern | Examples |
|---------|----------|
| `/WED66/i`, `/WGD66/i`, `/MED66/i`, `/MGD66/i` | WED6600*, Cabrio 6600 |
| `/WED75/i`, `/WGD75/i`, `/MED75/i`, `/MGD75/i` | WED7500*, Cabrio 7500 |
| `/WED78/i`, `/WGD78/i`, `/MED78/i`, `/MGD78/i` | WED7800* |
| `/WED80/i`, `/WGD80/i`, `/MED80/i`, `/MGD80/i` | WED8000*, WGD8000* |
| `/WED8500/i`, `/WGD8500/i`, `/MED8500/i`, `/MGD8500/i` | WED8500AW (4-digit — avoids Duet Sport `/WED85/i`) |
| `/WED8600/i`, `/WGD8600/i`, `/MED8600/i`, `/MGD8600/i` | WED8600* |

**Excluded (other platforms):** WED41/51 → `whirlpool_acu_tl_dryer`; WED55/59/4815 → `whirlpool_centennial_dryer`; WED83/85 → `whirlpool_duet_sport_dryer`; WED8700 → `whirlpool_connected_smart_gen3`; WED95/96 → `whirlpool_ccu_dryer` (FL).

**WO smoke:** WED7500AW + Whirlpool → `whirlpool_ccu_tl_dryer`; F3E2 → `w10410465-thermistors`; steam → `w10410465-myst-valve`.

---

## 2. Service diagnostics entry

| Step | Action |
|------|--------|
| Standby | Plugged in, all indicators off |
| 3-button × 3 | Any 3 buttons (not POWER): press/release each within 8 s, repeat sequence 2 more times |
| Language | English / French / Spanish |
| Home | Diagnostics Home → Error Diagnostic, Component Activation, System Info |

**Bundle:** `w10410465-diagnostic-entry`

---

## 3. Error codes (selected)

| Code | Meaning | Procedure |
|------|---------|-----------|
| F1E1 | CCU problem | TEST #1 |
| F2E1 | UI stuck button | TEST #6 |
| F2E2 / F2E3 | UI software / EEPROM | TEST #6 → replace UI |
| F3E1 / F3E2 | Exhaust thermistor open/short | TEST #4a |
| F3E3 / F3E4 | Inlet thermistor open/short | TEST #4a |
| F3E5 | Both thermistors open (P14 unplugged) | Harness / P14 |
| F3E6 / F3E7 | Moisture sensor open/short | TEST #5 |
| F4E1 | Heater relay / connector | TEST #4 |
| F4E3 | Restricted airflow | Vent / TEST #4a |
| F4E4 | L2 low (&lt;30 V); gas: P14 pins 4–5 loopback | TEST #1, #2 |
| F6E1 / F6E2 | UI↔CCU comm | TEST #1, #6 |

---

## 4. TEST index & procedure IDs

| OEM | ID | templateIds | Notes |
|-----|-----|-------------|-------|
| #1 | `w10410465-ccu-power` | both | P9-2 L1, P2 +5 VDC, P5 +12 VDC; P14 thermistor short isolation |
| #2 | `w10410465-supply-connections` | both | Cord / harness continuity |
| #3 | `w10410465-motor-circuit` | both | P8-4–P9-1 **1–6 Ω**; belt switch; main 3.3–3.6 / start 2.7–3.0 Ω |
| #4 | `w10410465-heater-electric` | electric | Dual element **≤50 Ω** violet–violet |
| #4-gas | `w10410465-heater-gas` | gas | Thermal path → #4d |
| #4a | `w10410465-thermistors` | both | P14-3–P14-6 outlet; P14-1–P14-2 inlet |
| #4b | `w10410465-thermal-fuse` | both | Elec: motor series; gas: valve series |
| #4c | `w10410465-thermal-cutoff` | both | Open → replace cut-off + high-limit |
| #4d | `w10410465-gas-valve` | gas | Coils 1400/570/1300 Ω; ignitor 50–500 Ω |
| #5 | `w10410465-moisture-sensor` | both | P13; wet-cloth service mode |
| #5a | `w10410465-dryness-adjust` | both | Hold Dryness Level ~3 s |
| #6 | `w10410465-button-indicator` | both | UI Component Test |
| #7 | `w10410465-door-switch` | both | P8-3–P8-4 0–2 Ω closed |
| **#8** | `w10410465-drum-light` | both | UI P13; **150–370 mA** driver |
| **#9** | `w10410465-myst-valve` | both | P8-1–P9-2 **510–590 Ω** |

---

## 5. Measurement specs (reuse batch9)

| Knowledge ID | Spec | Test point |
|--------------|------|------------|
| `dryerMotorCircuitOhms` | 1–6 Ω | P8-4–P9-1 |
| `dryerDrumMotorWindingOhms` | Main 3.3–3.6; start 2.7–3.0 | Motor switch pins 4–5 / 4–3 |
| `whirlpoolCcuDryerHeaterOhms` | ≤50 Ω | Heater relay violet–violet |
| `dryerExhaustThermistorOhms` | R/T table p.16 | P14-3–P14-6 |
| `dryerInletThermistorOhmsElectric` / `Gas` | R/T table p.16–17 | P14-1–P14-2 |
| `gasValveCoilOhms` | 1400 ±70 / 570 ±28.5 / 1300 ±65 | Figure 21 |
| `hotSurfaceIgniterOhms` | 50–500 Ω | Ignitor 2-pin |
| `whirlpoolCcuDryerSteamValveOhms` | **510–590 Ω** | P8-1–P9-2 |
| Drum LED driver | 150–370 mA | UI P13 pins 1–3 live |

---

## 6. Diagram crops

| Asset | PDF page | Content |
|-------|----------|---------|
| `w10410465-ccu-pinout-figure11.png` | 9 | Figure 11 CCU pinouts |
| `w10410465-motor-figure17-19.png` | 13 | Motor windings & belt switch |
| `w10410465-thermal-figure20.png` | 14 | Thermal components 20a/20b |
| `w10410465-strip-circuits-figure23.png` | 22 | Strip circuits |
| `w10410465-gas-valve-figure21.png` | 18 | Gas valve coils |

```bash
python backend/scripts/crop_w10410465_procedure_figures.py
```

---

## 7. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10410465
cd frontend && npx tsc --noEmit
```

Dev smoke: `/solomon/procedures/dev` with WED7500AW + Whirlpool.
