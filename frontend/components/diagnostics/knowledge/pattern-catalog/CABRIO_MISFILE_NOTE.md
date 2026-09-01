# Cabrio PDF misfile note

**File:** `backend/docs/manuals/cabrio.pdf` → `cabrio-extracted.txt`  
**Expected:** Whirlpool Cabrio top-load washer  
**Actual:** Whirlpool/Maytag **dryer** service data sheet **W10680150D** (same CCU platform as `whirlpool-electric-gas-dryers.pdf.pdf`)

## Action

- **Do not** use for washer Phase B/C.
- Cross-reference [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md) for all F-codes.
- Optional DMA gaps seeded from this file: F1E3, F1E5, F2E4, F2E5, F4E2, F6E3 (see batch append script).

## If Cabrio washer coverage is needed

Source the correct Cabrio **washer** tech sheet (WTW* / MVW* platform) and queue as a new PDF.
