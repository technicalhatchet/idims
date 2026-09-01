# GE GUD27 unitized laundry extraction

**Source:** `backend/docs/manuals/gud27essmww.pdf`  
**Extracted text:** `backend/docs/manuals/gud27essmww-extracted.txt`  
**Scope:** GE 24/27 in. unitized washer+dryer stack (GUD27ESSMWW electric; GUD27GSSMWW gas dryer section)  
**Status:** Phase A + **Phase B/C merged** (`stacked_laundry` template: timer chips, mechanical timer pre-check, evidence)

**This doc covers the dryer portion only** for diagnostic purposes; washer is mechanical/timer platform in same cabinet.

---

## Dryer architecture

| Item | Detail |
|------|--------|
| Control | **Mechanical timer** — no CCU, no customer error codes |
| Heat (electric) | Inlet + outlet control thermostats; safety + high-limit |
| Heat (gas) | Outlet control thermostat only for regulation |
| Dryness | Auto cycles hold timer until thermostats sense dry |

---

## Complaint routing (no F-codes)

| Symptom | Checks |
|---------|--------|
| No heat electric | High-limit; safety thermostat; heating element; 240 V at element |
| No heat gas | Igniter; flame sensor; gas valve; outlet thermostat |
| No tumble | Drive belt; idler; motor |
| Timer not advancing (auto) | Outlet thermostat; vent restriction; load size |
| Timer not advancing (timed) | Timer motor; timer contacts |
| Overheat | Safety thermostat; restricted vent; cycling thermostats |

---

## Measurements

- Element resistance per wiring diagram
- Thermostat continuity (biased thermostats near element and blower)
- Timer chart §62 for contact sequencing

---

## vs existing dryer extractions

| vs Whirlpool CCU | No F1E1–F9E* — timer/thermostat path only |
| vs Samsung/LG electronic | No display codes; vent still critical |

**DMA:** No new error-code rows (mechanical platform). Optional future: complaint chips `unitized_timer_dryer` only in Phase B.

---

## Phase B/C (merged)

- **Template:** `stacked_laundry` — `timer_platform` pre-check, `timer_advances` field on dryer section
- **Chips:** `timer_not_advancing`, `unitized_timer` in `stackedLaundryComplaints.ts`
- **Routing:** `stackedLaundryRouting.ts` + complaint keyword expansion for GUD27 / timer stuck
- **Evidence:** `knowledge/evidence/stacked_laundry.json` — timer + vent/thermostat ladder
- **Guidance:** `stackedLaundryFieldGuidance.ts`, `stackedLaundryFieldVisibility.ts`
- No display error codes — symptom/chip routing only
