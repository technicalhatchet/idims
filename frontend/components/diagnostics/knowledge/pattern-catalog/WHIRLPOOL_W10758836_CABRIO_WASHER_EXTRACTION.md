# Whirlpool 2014 Cabrio direct-drive washer — W10758836 extraction

**Source:** `backend/docs/manuals/jobaid-w10758836-l-87.pdf` (Job Aid W10758836, L-87)  
**Extracted text:** `backend/docs/manuals/jobaid-w10758836-l-87-extracted.txt`  
**Platform:** `whirlpool_tl_dd` (shared with W10864849 WTW9500 family)  
**Models:** WTW8500DW, WTW8500DC (`/WTW85/i`, `/MVWB85/i`)  
**Status:** Reuses **W10864849 procedure seeds** — no Cabrio delta procedures

Cross-reference: [WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md](./WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md)

---

## Seed reuse vs delta

| Area | W10758836 (WTW8500) | W10864849 (WTW9500) | Decision |
|------|---------------------|---------------------|----------|
| TEST #1–9 core | Same J-connector pinouts, same Ω specs | Base seeds | **Reuse** `w10864849-test-01` … `test-09` |
| Valves J2 | 790–840 Ω | 790–840 Ω | Reuse |
| Motor J1 | 8–10 Ω | 8–10 Ω | Reuse |
| Shifter / drain pumps | Same J4 tests | Same | Reuse |
| UI harness | ACU J18 ↔ **UI J6** | ACU J18 ↔ **UI J17** | **Label delta only** — same pin mapping (1↔3, 2↔2, 3↔1); `test-04` text says J17 |
| TEST #10 Service LEDs | **Not in manual** | `w10864849-test-10` | Optional on 8500 — seed remains, low yield |
| TEST #11 Basket light | **Not in manual** | `w10864849-test-11` | Defer / ignore on 8500 |
| TEST #12 Bulk dispense / REX | **Not in manual** | `w10864849-test-12` | Defer / ignore on 8500 |
| Drive architecture | Clutch coil (no float basket) | Clutch coil | Same generation |

**No Ω-spec delta** → no `w10758836-*` procedure JSON. Platform rule `/WTW85/i`, `/MVWB85/i` added **before** `/WTW/i` catch-all.

---

## Diagram assets

W10864849 crops already on `whirlpool_tl_dd` (`crop_w10864849_procedure_figures.py` → pinout p.31, strip circuits p.32–44).

W10758836 diagnostic figures align to later PDF pages (pinout **p.72**, valves **p.73**; no separate strip-circuit pages beyond inline figures). Content matches W10864849 TEST sections — **no Cabrio-specific diagram crops shipped** (redundant).

---

## Service modes

Same 3-button Service Diagnostic entry and Service Test Mode as W10864849 (`w10864849-service-diagnostic-entry`, `w10864849-service-test-mode` bundles).

---

## WO smoke

Whirlpool `WTW8500DW` → `whirlpool_tl_dd`; F5E2 → `w10864849-test-08-lid-lock`
