# Samsung French-door direct cool ice maker frozen — service bulletin

**Source:** `backend/docs/manuals/samsung-service-bulletin-ice-maker.pdf`  
**Extracted text:** `backend/docs/manuals/samsung-service-bulletin-ice-maker-extracted.txt`  
**Manual ID:** `SAMSUNG-ICE-MAKER-BULLETIN`  
**Bulletin:** ASC20170602002 (2017.05.24)  
**Platform:** `samsung_fridge_rf28` (RF28 French-door direct cool ice room; bulletin models span RF22–RF34 family)  
**Status:** Complete — 2 service-path procedures

---

## Symptom routing

| Symptom | Tags | Procedure |
|---------|------|-----------|
| No ice, frozen ice room, bucket stuck with frost, buzzing/knocking, dispenser drip | `no_ice`, `ice_maker_frozen` | `samsungrf28-ice-room-frozen-prep` → `samsungrf28-ice-room-frozen-service` |

**Possible causes (bulletin):** inefficient ice-maker cooling-loop defrost; air duct blocked; auger fan failed; bucket gasket leak; ice route seal; water spray.

---

## Service measures (all steps required)

| Step | Action | Parts / notes |
|------|--------|---------------|
| Prep | Remove bucket; steam defrost ice room + drain; unplug during service; towel dry | Never heat gun / hair dryer |
| 1 | RTV seal ice room housing gaps | DA81-05595A |
| 2 | Adjust water fill line ~10 mm from rear | Grey retainer ring |
| 3 | Remove styrofoam from auger motor fan | — |
| 4 | Ice route flapper seal test (water in chute) | Replace route assy if leak |
| 5 | Inspect ice bucket gasket / cracks | Replace bucket if defective |
| 6 | Install Y-clip service kit on cooling loop | Retainer + 2× Y-clips, straight down |
| 7 | Replace ice maker assembly | Per model chart in bulletin |

---

## Models (bulletin list — partial)

RF22K*, RF23*, RF24*, RF25*, RF26*, RF28*, RF30*, RF31*, RF32*, RF34* (2014–present French-door direct cool).

Platform routing: primary `samsung_fridge_rf28` (`/RF28/i`). RF23BB → `samsung_fridge_bespoke`; SxS in-door ice → `samsung_sxs` (different architecture — bulletin not applied).

---

## Pipeline

```bash
python backend/scripts/generate_samsung_ice_maker_bulletin_procedure_seeds.py
cd frontend && npx tsc --noEmit
```

WO smoke: RF28R7201SR + no ice + frozen ice room → `samsungrf28-ice-room-frozen-prep`.
