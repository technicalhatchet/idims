# Whirlpool front-load washer — W11169652 extraction

**Source:** `backend/docs/manuals/service-manual-w11169652-reva-27in-front-load-washers.pdf` (94 pp., W11169652A)  
**Extracted text:** `backend/docs/manuals/service-manual-w11169652-reva-27in-front-load-washers-extracted.txt`  
**Scope:** Whirlpool/Maytag 27" front-load; console and LCD HMI; direct-drive; optional heat/steam/dry/WiFi  
**Status:** Phase A complete — **Phase B/C not merged**

Cross-reference: existing Whirlpool `washing_machine` seed (top-load codes overlap partially).

---

## 1. Pre-service checklist

| Check | Solomon field / chip |
|-------|---------------------|
| 120 VAC 15–20 A dedicated circuit | `motor_electrical.supply_voltage` |
| Hot water ≥120°F at tap | field help on fill |
| HE detergent only | `commonly_missed.he_detergent` |
| Drain hose height / siphon | `functional_checks.drain_install` |
| Door lock before spin | `functional_checks.door_lock` |

---

## 2. Error codes (F#E# + aliases)

| Code | Alias | Meaning | First test |
|------|-------|---------|------------|
| F0E1 | rL | Load during Clean Washer | Remove load |
| F0E2 | Sd | Oversuds | HE detergent; pressure hose |
| **F0E5** | ob | Off-balance | Rebalance load |
| F1E1 | — | ACU fault | TEST #1 ACU power |
| F1E2 | — | Motor control ACU | TEST #1, #3 |
| F3E1 | — | Pressure sensor | TEST #7 |
| **F3E2** | — | Wash NTC | TEST #10 |
| **F3E5** | — | Dry NTC | TEST #16 |
| **F3E6** | — | Accelerometer | Replace ACU |
| **F4E1** | — | Wash heater relay | TEST #9 |
| **F4E2** | — | Heater not on | TEST #9 |
| **F4E4** | — | Vent/dry blower | TEST #13/#17 |
| **F5E1** | — | Door switch open while locked | TEST #4 |
| F5E2 | — | Door won't lock | TEST #4 |
| F5E3 | — | Door unlock fail | TEST #4 |
| **F5E4** | dr | Door not open between cycles | Open door |
| **F6E1–E3** | — | ACU↔HMI / ACU↔MCU comm | J19 harness; TEST #2, #3 |
| F7E1 | — | Motor speed (top-load legacy) | — |
| **F7E2/E8/E9/EA/EC** | — | Motor faults | TEST #3 |
| F8E1 | Lo FL | Long fill | TEST #6 |
| F8E3 | — | Overflow | TEST #6–8 |
| F9E1 | — | Long drain | TEST #8 |
| **FCE0** | — | WiFi error | WiFi module |

**Bold** = new vs existing Whirlpool washer seed (batch DMA append).

---

## 3. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| Won't power | Outlet; AC cord→ACU; ACU↔HMI; TEST #1, #2 |
| Won't fill | Supply; screens; siphon; valves; TEST #6, #7 |
| Won't drain | Hose height; filter; pump; TEST #8 |
| Won't spin | Door lock; obstruction; TEST #3, #4 |
| Leaking | Hoses; bellows; dispenser; heater torque 4.5 Nm |
| No heat (combo) | TEST #9; F4E1/F4E2 |

---

## 4. Measurements

| Item | Spec |
|------|------|
| Motor J6 | 6–20 Ω all pairs |
| Inlet valve | 1.1–1.35 kΩ |
| Wash heater J3 | 7–30 Ω |
| Drain pump J11 | 18.5–21.5 Ω |
| Recirc pump | 36–46 Ω |
| Max spin | 1160 RPM |

---

## 5. Phase B/C proposals (not merged)

- Evidence rules for F5E1/F5E4 door path, F8E1 fill, F9E1 drain, F0E5 ob
- Chip keyword: `ob`, `dr`, `long_fill`, `long_drain`
- Routing tokens: `F0E5`, `F5E4`, `FCE0`, `F7E9`

**DMA:** `backend/data/dma_error_codes_seed.json` — new rows via `append_manual_batch_dma_seed.py`
