# Over-the-range microwave batch extraction

**Sources:**
- `Samsung ME11A7510DSAA microwave.pdf`
- `LMHM2237BD.pdf` (LG OTR)

**Extracted text:** `*-extracted.txt` in `backend/docs/manuals/`  
**Status:** Phase A — **Phase B/C not merged**

**Pending:** `ME21A706BQN Service Manual.html` — optional HTML→text pass (Samsung OTR, likely similar C-* family).

---

## Samsung ME11A7510DSAA

| Code | Meaning | Checks |
|------|---------|--------|
| C-20 | Temp sensor error | Sensor unit; substrate; short = black wire |
| C-F1 | PCB / PBA defect | Replace main PBA |
| C-F2 | Touch defect | Touch film tape; connector |

**Service notes:** Power test procedure variance affects temperature rise readings (manual NOTE 1).

---

## LG LMHM2237BD

| Code | Meaning | Checks |
|------|---------|--------|
| F-1 | PCB thermistor short | Cabinet thermistor or PCB |
| F-2 | PCB thermistor open | Cabinet thermistor or PCB |
| F-4 | Humidity sensor fault | Humidity sensor circuit |

**Service mode:** Error displayed with beep on fault entry (§ test mode).

---

## Complaint routing (shared OTR)

| Symptom | Route |
|---------|-------|
| No heat + code | Sensor (C-20 / F-1/F-2) before magnetron |
| Touch dead | C-F2; membrane connector |
| Vent fan only | Door switches; fuse (see wiring) |
| Arcing | Waveguide cover; rack; metal |

---

## Phase B/C (deferred)

- New appliance subtype `microwave` in Solomon picker (if not present)
- Template: minimal fields — error code, door switches, high voltage caution
- No elimination rules until microwave template exists

**DMA:** Samsung C-20, C-F1, C-F2 + LG F-1, F-2, F-4 in batch append (`equipment_subtype`: `microwave`).
