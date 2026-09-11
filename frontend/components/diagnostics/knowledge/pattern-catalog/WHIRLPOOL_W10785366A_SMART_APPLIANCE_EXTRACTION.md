# Whirlpool Connected Smart Appliances Gen III — W10785366A extraction

**Source:** `backend/docs/manuals/Job Aid - W10785366A (CA-02) smart appliances.pdf`  
**Extracted text:** `backend/docs/manuals/Job Aid - W10785366A (CA-02) smart appliances-extracted.txt`  
**Scope:** Smart-layer add-on only (WiFi module, PM board, CT, HMI connectivity) — **not** base appliance component tests  
**Platform:** `whirlpool_connected_smart_gen3` — one platform, `templateIds` per appliance category  
**Status:** batch34 measurements, 6 procedures + 4 service-mode bundles

---

## Platform design

| Field | Value |
|-------|-------|
| platformId | `whirlpool_connected_smart_gen3` |
| Routing | Rules placed **before** generic `/WTW/i`, `/WED/i`, `/WRF98/i` patterns |
| Rationale | Job aid documents only smart delta; base manuals remain on their platforms |

### Model patterns

| templateId | Models | Base appliance (separate manual) |
|------------|--------|----------------------------------|
| `washer` | WTW8700*, MTW8700* | Top-load washer tech sheet (not in this job aid) |
| `electric_dryer` | WED8700*, MED8700* | Dryer tech sheet |
| `gas_dryer` | WGD8700*, MGD8700* | Gas dryer tech sheet |
| `dishwasher` | WDT995* | Clean-connect DW (HMI + WiFi only — no PMM) |
| `refrigerator` | WRF989*, WRF995* | Jazz French door family (WiFi + HMI delta) |

---

## Smart components (§3–4)

| Component | Function | Laundry | Dishwasher | Refrigerator |
|-----------|----------|---------|------------|--------------|
| WiFi Processor Module | HAN + WISE connectivity | ✓ | ✓ | ✓ |
| PM Board + CT | Live kW / kWh measurement | ✓ | — | — |
| HMI (CONNECT, WiFi, Smart Grid LEDs) | User connect + status | ✓ | ✓ | ✓ |

### Key specs

| Measurement | Spec | Connector |
|-------------|------|-----------|
| CT1 / CT2 | 135 Ω ±5% | PM J4 pins 1–2 / 3–4 |
| WiFi module supply | ~5 VDC* | WiFi J4-1 to J4-6 |
| PM board WIDE/WIN | 5 VDC | PM J2-1 to J2-3 (J3 interchangeable) |
| PM AC sense | 120 VAC | PM J1-1 to J1-2 (L1–N) |

\*Voltage may read higher per appliance tech sheet.

---

## WiFi module LED chart (§4-15)

| LED | Meaning |
|-----|---------|
| Off | Not connected, WiFi disabled, deep-sleep, or unpowered |
| Green steady | Connected to router + WISE |
| Green fast (10 Hz) | Connecting to router |
| Green slow (0.5 Hz) | Router OK, WISE not connected |
| Green on + amber fast | Remote firmware update |
| Amber extra slow | Low power mode |

---

## Service diagnostic entry

### Smart washer (§5-5) / smart dryer (§6-5)

1. Standby — indicators off  
2. Any 3 buttons (not POWER): press 1-2-3 within 8 sec, repeat **2 more times**  
3. Success: all indicators 5 sec, **888** on display, tone  
4. **Software Version Display:** hold **2nd** entry button 5 sec — cycles UI, ACU, **n** (WiFi), **p** (PMM)  
5. **n--** = WiFi not communicating; all **--** = UI/harness (F6E2)

### Clean-connect dishwasher (§7-4)

- Standby: **1-2-3-1-2-3-1-2-3** (≤1 sec between keys)  
- Close door to start Service Diagnostics cycle  
- No dedicated WiFi status step (fault reported to ACU only)

### Smart refrigerator (§8-4)

- **Recommended + Drawer** held 5 sec (chime)  
- Navigate: Icemaker2 = Enter; Up/Down; Fast Cool = Back  
- Test **106** link (00 testing → 01/02/03)  
- Tests **108–109** antenna signal %

---

## Procedure checklist

| ID | OEM | templateIds | Tags |
|----|-----|-------------|------|
| `w10785366a-wifi-module` | §4-14–15 | all smart | wifi_check, connectivity_issue |
| `w10785366a-pmm-ct` | §4-17 | washer, electric_dryer, gas_dryer | energy_monitoring |
| `w10785366a-hmi-wifi-comm` | §4-10 | laundry + dishwasher | F6E2, hmi_check |
| `w10785366a-connectivity-console` | §4-7–11 | all smart | connectivity_issue |
| `w10785366a-dishwasher-wifi` | §7 | dishwasher | wifi_check |
| `w10785366a-fridge-wifi-service` | §8-4 | refrigerator | wifi_check |

### Bundles

| Bundle | Applies to |
|--------|------------|
| `w10785366a-laundry-service-diagnostic-entry` | washer, electric_dryer, gas_dryer |
| `w10785366a-laundry-software-version-display` | washer, electric_dryer, gas_dryer |
| `w10785366a-dishwasher-service-diagnostic-cycle` | dishwasher |
| `w10785366a-fridge-service-mode-entry` | refrigerator |

---

## Complaint routing

| Complaint / symptom | First procedure |
|--------------------|-----------------|
| Cannot connect to WiFi / app | `w10785366a-connectivity-console` → `w10785366a-wifi-module` |
| App shows no live power / energy | `w10785366a-pmm-ct` (laundry only) |
| F6E2 / n-- on version display | `w10785366a-hmi-wifi-comm` |
| Dishwasher smart features dead | `w10785366a-dishwasher-wifi` |
| Fridge WiFi / Smart Grid | `w10785366a-fridge-wifi-service` |

---

## Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10785366A
```

**WO smoke:** Whirlpool `WTW8700EC0` → `whirlpool_connected_smart_gen3`; connectivity → `w10785366a-wifi-module`.

**Do not** reuse Duet Sport or TL DD Ω specs — this manual is connectivity/power-measurement only.
