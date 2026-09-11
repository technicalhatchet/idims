# Whirlpool Bella 32 cu ft French door — W10901168 extraction

**Sources:**
- `backend/docs/manuals/service-manual-w10901168-bella.pdf` (W10901168 — 32 cu ft Bella)
- `backend/docs/manuals/wrf954cihv.pdf` (W11366204 — WRF954/964/974/984, KRFC804, KRFC604/704, JFFCC72)

**Models:** WRF992/993/995*, WRF954/964/974/984*, WRF972*, WRFA94*, KRFC604/704/804*, JFFCC72*  
**Scope:** Orion board + GF2 board; Eyebrow UI + Door UI + Dispenser UI; dual ice maker option; linear compressor; pantry zone.  
**Platform:** `whirlpool_bella_french_door` — Orion+GF2 family (not `whirlpool_ka_french_door` ACU).

**W11366204 alias:** Same service-test matrix and Ω specs as W10901168 (29 Ω FC defrost, 43–49 Ω compressor coils, 108 Ω duct heaters). Reuses Bella procedure seeds — routing only.

## Platform decision vs W11509412 (KA)

| Factor | W11509412 KA | W10901168 Bella |
|--------|--------------|-----------------|
| Control | Single ACU | **Orion + GF2 dual board** |
| UI | Dispenser SW keys | **Eyebrow Recommended/Drawer diagnostics** |
| Compressor | EMD55CLT | **Linear motor + sensor windings** |
| Ice | RC compartment IM; E0–E5 | **Door + optional freezer IM; E1–E4 harvest** |
| Cooling | Single evap + damper | **3-way valve + separate RC/FC fans** |
| ST numbering | Overlaps 01/02 only | **01/02/05/14/40/56–59/89–98/120+** different semantics |

**Verdict:** Separate platform — dual-board Orion architecture is incompatible with KA ACU pinouts despite some shared test numbers.

## Diagnostics entry

Hold **Recommended + Drawer** 5 s (chime, lights out). Up/Down navigate; **Icemaker2** select; Fast Cool back; test **00** or 20 min timeout.

## Service tests (high value)

| Test | Function |
|------|----------|
| 01–02, 05, 14 | RC/FC/pantry/ice box thermistors (OP/SH) |
| 40 | Compressor + 3-way valve + RC/FC cool |
| 56–58 | FC fan, RC fan, condenser fan |
| 42 | Pantry air baffle |
| 59 | Ice box fan |
| 89, 91 | FC defrost / forced defrost |
| 96 | Water valve + isolation |
| 97–98 | Door/freezer IM fill |
| 66–67 | Fill tube heaters |
| 120–121 | IM harvest (E1–E4) |
| 79 | Ice bin switch |

## Measurements (batch47)

- `whirlpoolBellaFdCompressorSensorOhms` — sensor 14–19 Ω; line-common 7–13 Ω
- `whirlpoolBellaFdThreeWayValveOhms` — coil 43–49 Ω

Thermistors: service-test OP/SH only on manual (no published R/T table on Bella SM).

## Procedures (14 + 1 bundle)

Generator: `backend/scripts/generate_w10901168_bella_fridge_procedure_seeds.py`

**Deferred:** Diagram crops (condenser fan FIGURE 11 usable); WIFI tests 106/137 out of v1 scope.
