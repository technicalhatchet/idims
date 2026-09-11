# Whirlpool 3.8 cu ft PSC top-load washer — W11697231 extraction

**Source:** `backend/docs/manuals/technical-manual-w11697231-reva wtw4950.pdf` (W11697231 Rev A)  
**Platform:** `whirlpool_tl_dd` — models `WTW49*`, `MVW49*` (PSC motor; not BPM W10864849)  
**Cross-reference:** [WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md](./WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md) (6.2 cu ft BPM DD — do not reuse J-connector or Ω values)

## Service mode entry

**Service Diagnostic:** Standby → wait 10 s → RESET (knob CCW) → within 6 s: CW, CW, CW (½ s each), CCW (½ s), CW. Success: status LEDs flash ½ s on/off (except Lid Locked).

**Manual Test Mode:** After diagnostic entry → knob to Spin + Done ON → START. Cycle selector picks output; START toggles. Lid closed + locked for agitate/spin.

**Fault codes:** Done LED on → START. **Calibration:** Rinse LED on → START (after drive/shifter/motor/capacitor replacement).

## Fault routing (selected)

| Code | TEST |
|------|------|
| F1E1, F1E2 | #1 Main Control / #3b Motor |
| F2E1, F2E3 | #4 Console |
| F3E1 | #6 Water Level |
| F3E2, F8E5 | #5 Thermistor / #2 Valves |
| F5E1–F5E4 | #8 Lid Lock |
| F7E1, F7E5–F7E7 | #3 / #3a / #3b Drive |
| F8E1, F8E3 | #2 Valves / #6 Water Level |
| F9E1 | #7 Drain Pump |

## Ω / voltage specs (TEST index)

| TEST | Connector | Spec |
|------|-----------|------|
| #1 | J5-1↔2 | 120 VAC line |
| #1 | J12-1↔4 | +12 VDC; isolate J12 for shifter short |
| #2 | J9-1↔4 Hot, J9-5↔4 Cold | 890 Ω – 1.3 kΩ |
| #3a | J2-1↔2 shifter | 2–3.5 kΩ |
| #3a | J12-3 shifter switch | SPIN +5 VDC / AGITATE 0 VDC |
| #3b | J2-4↔6 CW, J2-4↔5 CCW | 1/4 HP 5–9.5 Ω; 1/3 HP 3.5–6 Ω |
| #5 | J9-3↔7 thermistor | OEM R/T table (~50 kΩ @ 25°C) |
| #7 | J2-2↔3 drain | 14–25 Ω |
| #8 | J6-1↔2 solenoid (lid closed) | 85–155 Ω |

## Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11697231
```

**WO smoke:** Whirlpool WTW4950 → `whirlpool_tl_dd`; F5E2 → `w11697231-test-08-lid-lock`.
