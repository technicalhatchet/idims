# Whirlpool Theseus counter-depth French door — W11803249 extraction

**Source:** `backend/docs/manuals/technical-manual-w11803249-revb cdfd2024.pdf`  
**Scope:** 36 in counter-depth 24 cu ft; **Theseus ACU** (P1/P4/P5/P8/P9/P10/P11/P12/P70); external inverter; pantry damper; RH on HMI J4.  
**Platform:** `whirlpool_theseus_cdfd` — **new** (not `whirlpool_jazz_french_door`).

## Platform decision vs W10322959 (Jazz)

| Factor | W10322959 Jazz | W11803249 Theseus CDFD |
|--------|----------------|------------------------|
| Era / UI | S-E keypad; 10k NTC | **3-key ×3 SM**; **2.7k NTC** (KA-like chart) |
| Compressor | EM2Y60 relay 4.75 Ω | **Inverter 24.7 Ω**; tests 72/75 |
| Board | Jazz control | **Theseus ACU P*** + A40 HMI |
| Dampers | Single FF damper test 6 | **RC P70 + Pantry P12** tests 80/81 |
| Pantry | N/A | **P70 pantry thermistor test 17** |
| Service tests | 1–9 | **10–29, 72+, 111+, 131+, 181** |

**Verdict:** Separate platform — Jazz S-E architecture and 10k thermistors do not apply; P* naming overlaps KA but test matrix and inverter differ.

## Service tests (captured)

Manual mode: 10 FC evap NTC, 12 FC, 13 RC, 15 IM tray, 17 pantry, 25 ambient, 29 RH, 41 doors, 61 forced defrost, 72 compressor cooling, 75 set speed, 80/81 dampers, 91 LEDs, 111 FC fan, 113 condenser, 131 defrost, 134/144 heaters, 181 IM harvest, 200 HMI LEDs.

## Component tests #1–15

Main control P1/P4; HMI J3; compressor/inverter P8-8; fans P8/P9; dampers P70/P12; defrost P2-7; thermistors P5/P10/P70/P22; RH J4; doors P8-3; IM P11/P70; water P2-6; paddle P8; heaters J4/P11.

## Measurements (batch47)

- `whirlpoolTheseusCdfdThermistorOhms` — 2700 Ω @ 77°F
- `whirlpoolTheseusCdfdDefrostHeaterOhms` — 43 Ω
- `whirlpoolTheseusCdfdCompressorOhms` — 24.7 Ω
- `whirlpoolTheseusCdfdMullionHeaterOhms` — 15 Ω
- `whirlpoolTheseusCdfdFillTubeHeaterOhms` — 32 Ω

## Procedures (13 + 1 bundle)

Generator: `backend/scripts/generate_w11803249_theseus_cdfd_procedure_seeds.py`

**Deferred:** Diagram crops; Service Matters app tool integration.
