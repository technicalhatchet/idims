# Insignia TWM41 / TWM35 washer procedures

Platform: `insignia_washer_cap` (capacitive water level sensor)

## Procedures

| ID | OEM | Tags |
|----|-----|------|
| `insigniatwmcap-inlet-valves` | 4.5-A | E1 |
| `insigniatwmcap-drain-pump` | 4.5-B | E2 |
| `insigniatwmcap-lid-switch` | 4.5-C | E3, CL |
| `insigniatwmcap-unbalance` | 4.5-D | E4, E5 |
| `insigniatwmcap-level-sensor` | 4.5-E | F8 |
| `insigniatwmcap-door-lock` | 4.5-F | Fd |
| `insigniatwmcap-pcb-failure` | 4.3 | F2, C9 |
| `insigniatwmcap-load-sensing` | F5 | F5 |

## Bundle

- `insigniatwmcap-test-mode-entry` — Soak + Extra Rinse + Power (§4.1–4.2)

Regenerate: `python backend/scripts/generate_insignia_twm_washer_procedure_seeds.py`
