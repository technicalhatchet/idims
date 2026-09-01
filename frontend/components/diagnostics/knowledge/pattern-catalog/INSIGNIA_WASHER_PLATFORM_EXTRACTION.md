# Insignia washer platform extraction

**Sources:**
- `NS-TWM41WH8A insignia washer service manual.pdf` (53 pp.)
- `Service-Manual-NS-WMT41WA5.pdf` (66 pp., OEM MAV160-A2810PS)

**Extracted text:** `*-extracted.txt` in `backend/docs/manuals/`  
**Scope:** Best Buy Insignia top-load washers (shared OEM platform; WMT41WA5 adds impact switch + frequency level sensor)  
**Status:** Phase A + B + C merged (shared washer template — chips, routing, evidence).

---

## Error codes

| Code | TWM41WH8A | WMT41WA5 notes |
|------|-----------|----------------|
| E1 | Water intake >60 min | 30 min timeout; simultaneous fill/drain leak path |
| E2 | Drain >10 min | 10–15 min |
| E3 | Lid open | Door magnet switch |
| E4 | Unbalance spin | Collision/OOB switch on WMT41WA5 |
| **E5** | — | Impact switch disconnected (WMT41WA5 only) |
| F2 / C9 | PCB failure | Replace power/main PCB |
| F8 | Level sensor failed | Capacitance 40–50 nF (TWM) / **26.70±0.3 kHz empty** (WMT) |
| Fd | Door lock failed | Lid lock actuator |
| CL | Child lock timeout | Door open >20 min |

---

## Measurements

| Component | TWM41WH8A | WMT41WA5 |
|-----------|-----------|----------|
| Inlet valve | 0.7–1.2 kΩ | 4–6 Ω |
| Drain pump | 10–20 Ω | 5–7 Ω (retractor) |
| Water pressure | 0.05–1 MPa | Same |
| Level sensor F8 | 40–50 nF; 20–40 Ω | <18 or >30 kHz fault |

---

## Phase B/C (deferred)

- Map E1–E4 to `washer` template fill/drain/spin/unbalance chips
- Field guidance: frequency level sensor vs capacitive platform
- All Insignia washer codes seeded as **new manufacturer** in DMA batch

**NS-TWM35W1** (`NS-TWM35W1 Service Manual.pdf`, 50 pp.):

| Code | Meaning | Notes vs TWM41 |
|------|---------|----------------|
| E1 | Fill timeout (30 min) | Same family |
| E2 | Drain timeout (10 min) | Same |
| E3 | Lid open / not level | Same |
| E4 | Unbalance (3 retries) | Same |
| E5 | Impact switch pressed | Same as WMT41WA5 |
| **F5** | Load sensing failed | **New** — belt tension |
| F2 / C9 | PCB failure | Same |
| F8 | Level sensor failed | Same |
| Fd | Door lock failed | Same |

Extracted: `NS-TWM35W1 Service Manual-extracted.txt`
