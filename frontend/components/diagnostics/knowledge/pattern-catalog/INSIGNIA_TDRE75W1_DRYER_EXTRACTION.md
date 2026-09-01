# Insignia NS-TDRE75W1 electric dryer extraction

**Source:** `NS-TDRE75W1 Service Manual.pdf` (also covers gas **NS-TDRG75W1**)  
**Extracted text:** `NS-TDRE75W1 Service Manual-extracted.txt` (49 pp., 57k chars)  
**Scope:** Insignia vented dryer; humidity + outlet NTC; service test mode with NTC test (E5 on fault)  
**Status:** Phase A + B + C merged (E4/E5/C9 dryer evidence).

Cross-reference: [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md) for general vent/thermostat patterns — **no Whirlpool F-codes** on this platform.

---

## Error codes (§4.3)

| Code | Category | Behavior | Checks |
|------|----------|----------|--------|
| E4 | Humidity sensor | Cycle completes with **timed dry** (humidity sensor bypassed); code logged at end | Humidity sensor CN10; harness |
| E5 | Outlet temp sensor | A/D &lt;10 or &gt;1000 → heater off, motor off, fault state | Outlet NTC CN3; 2 s debounce |
| C9 | Communication | 110 s timeout → heater off, motor off, fault state | Display comm CN9 harness; PCB |

**Service test:** Press Time Adjust + to step tests; screen `04` = NTC test (E5 if failed).

---

## Complaint routing

| Symptom | Route |
|---------|-------|
| Clothes wet, no code until end | E4 humidity — timed dry fallback |
| No heat mid-cycle | E5 outlet sensor |
| Dead UI / random stop | C9 comm |
| Long dry (no code) | Vent restriction; element; gas valve (TDRG) |

---

## Measurements

- Wiring CN1–CN10 per §4.4 (electric vs gas diagrams differ on heater paths)
- NTC test mode before replacing main PCB

**DMA:** Insignia `dryer` E4, E5, C9 rows.
