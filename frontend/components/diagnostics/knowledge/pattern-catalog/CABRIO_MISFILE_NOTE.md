# Cabrio line — `cabrio.pdf` scope note

**File:** `backend/docs/manuals/cabrio.pdf` → `cabrio-extracted.txt`

## What “Cabrio” means

**Cabrio is a Whirlpool/Maytag trim line** (premium tier), not an appliance category. Cabrio exists across washers, dryers, and other products — the name alone does not tell you which appliance a manual covers.

## What this PDF actually is

| Field | Value |
|-------|-------|
| **Appliance** | Dryer (electric & gas) |
| **Document** | Service data sheet **W10680150D** |
| **Platform** | CCU/UI dryer architecture (same family as `whirlpool-electric-gas-dryers.pdf.pdf`) |

So `cabrio.pdf` is a **valid Cabrio-tier dryer** tech sheet — not a corrupt or “wrong” file. Our earlier “misfile” label assumed Cabrio = washer; that was incorrect framing.

## How we use it

- **Dryer Phase A/B/C:** Cross-reference [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md); treat as near-duplicate of the main Whirlpool CCU dryer sheet.
- **Washer work:** This file does **not** cover Cabrio washers — source a separate **WTW\*** / **MVW\*** Cabrio washer tech sheet if needed.
- **DMA:** A few dryer F-code gaps were seeded from this sheet (F1E3, F1E5, F2E4, F2E5, F4E2, F6E3) where they weren’t already in the main dryer seed.
