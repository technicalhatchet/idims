# Whirlpool ACU top-load dryer (`whirlpool_acu_tl_dryer`) procedure seeds

**Manuals:** W11798430 (WED4100) + W11416805 (WED5100)  
**Extraction:** [`WHIRLPOOL_W11798430_DRYER_EXTRACTION.md`](../../knowledge/pattern-catalog/WHIRLPOOL_W11798430_DRYER_EXTRACTION.md) · [`WHIRLPOOL_W11416805_DRYER_EXTRACTION.md`](../../knowledge/pattern-catalog/WHIRLPOOL_W11416805_DRYER_EXTRACTION.md)  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json)

## Scope

Whirlpool/Maytag **ACU-era top-load** dryers (`WED41*`, `WGD41*`, `MED41*`, `MGD41*` and `WED51*`, `WGD51*`, `MED51*`, `MGD51*`). Single-element electric heat ~10 Ω. W4100 uses J7/J4; W5100 uses J8/J9/J14.

| Manual | Pipeline | Procs | Bundle |
|--------|----------|-------|--------|
| W11798430 | `--manual W11798430` | 12 | `w11798430-diagnostic-entry` |
| W11416805 | `--manual W11416805` | 14 | `w11416805-diagnostic-entry` |

W5100 adds moisture sensor (TEST #5) and steam water valve (TEST #9). W4100 TEST #5 = HMI.

Deferred: ACU pinout diagram crops.
