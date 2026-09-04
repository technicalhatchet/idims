# Whirlpool WRT311FDZT00 wiring sheet extraction (W10674984)

**Source:** `backend/docs/manuals/wiring-sheet-W10674984-RevA wrt311fzdt00.pdf` (2 pp., scan/image-only)  
**Extracted text:** `backend/docs/manuals/wiring-sheet-W10674984-RevA wrt311fzdt00-extracted.txt` (manual transcription — PyMuPDF 0 chars)  
**Scope:** WRT311* top-mount with **ADC 2000** adaptive defrost, Embraco EM3Z/EM3D compressor. Model example: **WRT311FDZT00**.  
**Status:** Phase A + B + C merged (platform `whirlpool_wrt311_adc`, batch11 measurements, ADC voltage fields).

Cross-reference: [WHIRLPOOL_WRT_TOP_MOUNT_EXTRACTION.md](./WHIRLPOOL_WRT_TOP_MOUNT_EXTRACTION.md) (W10330404 generic job aid — mechanical timer / ~30 Ω heater).

---

## 1. Platform distinction

| Platform | Model match | Defrost control | Heater Ω |
|----------|-------------|-----------------|----------|
| `whirlpool_wrt311_adc` | `WRT311*` | ADC 2000 electronic | **30–42 Ω** (350–480 W) |
| `whirlpool_wrt_top_mount` | `WRT` (non-311), `W8T`, `W4T` | Timer or generic ADC | ~30/33 Ω (W10330404) |

Solomon resolves **WRT311** to the more specific ADC platform first.

---

## 2. Component specifications (page 1)

### Sealed system performance

| Ambient | Total watts | High side PSIG | Low side |
|---------|-------------|----------------|----------|
| 70°F | 120 ± 20 | 120 ± 20 | -6" to 3# |
| 90°F | 130 ± 20 | 160 ± 20 | -4" to 3# |
| 110°F | 140 ± 20 | 220 ± 20 | -2" to 4# |

### Compressor families

| Part | Model |
|------|-------|
| W10445423 | Embraco EM3Z |
| W10575980 | Embraco EM3D |

### Defrost / fans

| Component | Spec |
|-----------|------|
| Defrost heater | 350–480 W @ 120 V → **42–30 Ω** |
| Bi-metal | Opens at **58°F** (service note) |
| Evap fan | EM3Z 1.5–2.5 W / EM3D 1.7–3.7 W @ 120 V |
| Cond fan | EM3Z 3.1–5.1 W / EM3D 1.6–3.6 W |

---

## 3. ADC 2000 voltage test points (page 2)

| Measurement | Pins | Expected |
|-------------|------|----------|
| Compressor run-time feedback | P1 (BK) – P3 (RD) | 120 VAC |
| Defrost heater run-time feedback | P1 (BK) – P2 (PK) | 120 VAC |
| **Defrost heater output** | **P2 (PK) – P6 (WH)** | **120 VAC when energized** |
| **Cooling output** | **P6 (WH) – P4 (OR)** | **120 VAC when cooling** |
| Constant input | P1 (BK) – P6 (WH) | 120 VAC plugged in |

**Solomon fields:** `defrost_circuit.adc_heater_output_v`, `fans_and_electrical.adc_cooling_output_v`

---

## 4. Electronic defrost test mode

Bi-metal must be **closed** to enter.

**Option 1:** Power off 30 s → thermostat **OFF** → power on.  
**Option 2:** Thermostat OFF 15 s → ON 5 s (×3) → OFF.

- Relay click confirms entry  
- Heater runs up to **18 minutes** or until bi-metal opens  
- **Do not** bypass bi-metal and overheat evaporator

**Solomon field:** `functional_checks.adc_defrost_test_entered`  
**DMA:** `ADCTEST` row added

---

## 5. Phase B — fields & measurements

**batch11 knowledge IDs:**

| ID | Binding |
|----|---------|
| `whirlpoolWrt311DefrostHeaterOhms` | `defrost_circuit.defrost_heater_ohms` |
| `whirlpoolWrt311DefrostBimetalOhms` | `defrost_circuit.defrost_thermostat` |
| `whirlpoolWrt311AdcDefrostHeaterVoltage` | `defrost_circuit.adc_heater_output_v` |
| `whirlpoolWrt311AdcCoolingOutputVoltage` | `fans_and_electrical.adc_cooling_output_v` |
| `whirlpoolWrt311SealedSystemWatts70F` | reference only (performance table) |

---

## 6. Phase C — evidence

- `ref_ms_wp_wrt311_*` measurement confirms (heater, ADC voltages)
- `ref_kw_wp_adc_test` keyword routing

---

## 7. Captured vs gaps

### Captured

- Full wiring diagram logic (ADC → loads)
- Pin-level voltage test points P1–P6
- Defrost heater 30–42 Ω (corrects W10330404 ~30 Ω for WRT311)
- Bi-metal opens 58°F
- ADC defrost test mode entry (thermostat sequence)
- Sealed-system watts/PSIG by ambient
- EM3Z/EM3D compressor identification

### Gaps

| Gap | Notes |
|-----|-------|
| Cabinet thermistor R/T table | Not on this 2-page wiring sheet — use separate tech sheet if needed |
| Evap fan Ω | Wattage only; no winding ohms on sheet |
| PTC / run cap values | Refer to part numbers on component (NOTE #6) |
| Modular ice maker test | [WHIRLPOOL_MODULAR_ICE_MAKER_2225623_EXTRACTION.md](./WHIRLPOOL_MODULAR_ICE_MAKER_2225623_EXTRACTION.md) |
| OCR layer | PDF is pure scan — transcription in `-extracted.txt` |

---

## 8. Re-seed

```bash
python backend/scripts/regenerate_dma_error_codes_sql.py
cd frontend && npx tsc --noEmit
```

Re-run `backend/database/supabase_dma_error_codes_seed.sql` in Supabase.

---

*Re-render for visual review: pages saved temporarily during extraction; source PDF remains authoritative.*
