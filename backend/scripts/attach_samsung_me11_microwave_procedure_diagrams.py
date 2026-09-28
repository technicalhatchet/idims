#!/usr/bin/env python3
"""Attach Samsung ME11 diagram references to procedure steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_microwave_otr"
ASSET_BASE = "/images/procedures/samsung_microwave_otr"

DIAGRAMS: dict[str, dict[str, str]] = {
    "samsung-me11-disassembly-hv": {
        "id": "samsung-me11-disassembly-hv",
        "caption": "HV transformer / capacitor access (§3-2, p.12)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-disassembly-hv.png",
    },
    "samsung-me11-disassembly-door": {
        "id": "samsung-me11-disassembly-door",
        "caption": "Door assembly disassembly (§3-5, p.16)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-disassembly-door.png",
    },
    "samsung-me11-interlock-switch": {
        "id": "samsung-me11-interlock-switch",
        "caption": "Interlock switch adjustment (§4-6, p.24)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-interlock-switch.png",
    },
    "samsung-me11-pcb-sub-module": {
        "id": "samsung-me11-pcb-sub-module",
        "caption": "Sub module PCB layout (§6-1, p.38)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-pcb-sub-module.png",
    },
    "samsung-me11-pcb-sub-connectors": {
        "id": "samsung-me11-pcb-sub-connectors",
        "caption": "Sub module connectors (§6-1, p.39)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-pcb-sub-connectors.png",
    },
    "samsung-me11-pcb-main": {
        "id": "samsung-me11-pcb-main",
        "caption": "Main PBA layout (§6-2, p.40)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-pcb-main.png",
    },
    "samsung-me11-pcb-main-connectors": {
        "id": "samsung-me11-pcb-main-connectors",
        "caption": "Main PBA connectors CN250/CN200 (§6-2, p.41)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-pcb-main-connectors.png",
    },
    "samsung-me11-wiring-1": {
        "id": "samsung-me11-wiring-1",
        "caption": "Wiring diagram sheet 1 (§7-1, p.42)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-wiring-1.png",
    },
    "samsung-me11-wiring-2": {
        "id": "samsung-me11-wiring-2",
        "caption": "Wiring diagram sheet 2 (§7-1, p.43)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-wiring-2.png",
    },
    "samsung-me11-wiring-3": {
        "id": "samsung-me11-wiring-3",
        "caption": "Wiring diagram sheet 3 (§7-1, p.44)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-wiring-3.png",
    },
    "samsung-me11-wiring-4": {
        "id": "samsung-me11-wiring-4",
        "caption": "Wiring diagram sheet 4 (§7-1, p.45)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-wiring-4.png",
    },
    "samsung-me11-wiring-5": {
        "id": "samsung-me11-wiring-5",
        "caption": "Wiring diagram sheet 5 (§7-1, p.46)",
        "assetPath": f"{ASSET_BASE}/samsung-me11-wiring-5.png",
    },
}

PROCEDURE_IMAGES: dict[str, list[str]] = {
    "samsungotrmw-door-interlock": ["samsung-me11-interlock-switch", "samsung-me11-wiring-1"],
    "samsungotrmw-hv-transformer": ["samsung-me11-disassembly-hv", "samsung-me11-wiring-2"],
    "samsungotrmw-hv-capacitor": ["samsung-me11-disassembly-hv", "samsung-me11-wiring-2"],
    "samsungotrmw-hv-diode": ["samsung-me11-wiring-2", "samsung-me11-wiring-3"],
    "samsungotrmw-magnetron": ["samsung-me11-disassembly-hv", "samsung-me11-wiring-3"],
    "samsungotrmw-vent-motor": ["samsung-me11-wiring-4"],
    "samsungotrmw-humidity-sensor": ["samsung-me11-pcb-main-connectors", "samsung-me11-wiring-1"],
    "samsungotrmw-keypad-touch": ["samsung-me11-pcb-sub-connectors", "samsung-me11-disassembly-door"],
    "samsungotrmw-pcb-comm": ["samsung-me11-pcb-main", "samsung-me11-pcb-sub-module", "samsung-me11-pcb-main-connectors"],
    "samsungotrmw-thermal-cutout": ["samsung-me11-pcb-main-connectors", "samsung-me11-wiring-2"],
    "samsungotrmw-turntable": ["samsung-me11-wiring-2"],
}

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "Primary interlock": ["samsung-me11-interlock-switch"],
    "Monitor interlock": ["samsung-me11-interlock-switch"],
    "Door sensing switch": ["samsung-me11-interlock-switch"],
    "CN250": ["samsung-me11-pcb-main-connectors"],
    "Magnetron TCO": ["samsung-me11-wiring-2"],
    "Cavity TCO": ["samsung-me11-pcb-main-connectors"],
    "HV transformer": ["samsung-me11-disassembly-hv"],
    "Vent blower": ["samsung-me11-wiring-4"],
}


def images_for_ids(ids: list[str]) -> list[dict[str, str]]:
    return [DIAGRAMS[i] for i in ids if i in DIAGRAMS]


def attach_procedure_level(seed: dict) -> bool:
    pid = seed.get("id", "")
    ids = PROCEDURE_IMAGES.get(pid, [])
    if not ids:
        return False
    seed["images"] = images_for_ids(ids)
    return True


def attach_measurement_diagrams(seed: dict) -> int:
    attached = 0
    for step in seed.get("steps", []):
        if step.get("type") != "measurement":
            continue
        test_point = step.get("testPoint") or {}
        connector = test_point.get("connector", "")
        ids = CONNECTOR_DIAGRAM_IDS.get(connector, [])
        if ids:
            step["images"] = images_for_ids(ids)
            attached += 1
    return attached


def main() -> None:
    proc_level = 0
    meas_level = 0
    for path in sorted(SEED_DIR.glob("samsungotrmw-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if attach_procedure_level(data):
            proc_level += 1
        count = attach_measurement_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: procedure images={bool(data.get('images'))}, {count} measurement step(s)")
        meas_level += count
    print(f"Attached procedure-level images on {proc_level} seeds; {meas_level} measurement steps.")


if __name__ == "__main__":
    main()
