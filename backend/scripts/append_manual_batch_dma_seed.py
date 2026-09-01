#!/usr/bin/env python
"""Append manual-batch DMA rows to dma_error_codes_seed.json with deduplication."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "data" / "dma_error_codes_seed.json"

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def norm_key(manufacturer: str, subtype: str, code_normalized: str) -> tuple[str, str, str]:
    return (
        manufacturer.strip().lower(),
        subtype.strip().lower(),
        re.sub(r"[^A-Z0-9]", "", code_normalized.upper()),
    )


def row(
    manufacturer: str,
    equipment_subtype: str,
    code: str,
    meaning: str,
    common_causes: str,
    recommended_fix: str,
    related: list[str] | None = None,
) -> dict:
    code_normalized = re.sub(r"[^A-Za-z0-9]", "", code).upper()
    related_codes = related or [code_normalized]
    return {
        "manufacturer": manufacturer,
        "equipment_subtype": equipment_subtype,
        "code": code,
        "code_normalized": code_normalized,
        "meaning": meaning,
        "common_causes": common_causes,
        "recommended_fix": recommended_fix,
        "alias_group_id": str(uuid.uuid4()),
        "related_codes": list(dict.fromkeys(related_codes)),
    }


NEW_ROWS = [
    # Whirlpool front-load washer — codes not in seed
    row("Whirlpool", "washing_machine", "F0 E5", "Off-balance load", "Unbalanced or oversized load", "Rebalance load; level unit", ["F0E5", "OB"]),
    row("Whirlpool", "washing_machine", "ob", "Off-balance load", "Unbalanced or oversized load", "Rebalance load", ["F0E5", "OB"]),
    row("Whirlpool", "washing_machine", "F3 E2", "Wash NTC fault", "Open/short wash temp sensor", "TEST #10 wash temp sensor"),
    row("Whirlpool", "washing_machine", "F3 E5", "Dry NTC fault", "Dry thermistor out of range", "TEST #16; wash still works"),
    row("Whirlpool", "washing_machine", "F3 E6", "Accelerometer fault", "ACU self-test failure", "Replace ACU"),
    row("Whirlpool", "washing_machine", "F4 E1", "Wash heater relay error", "No temp rise detected", "TEST #9 heating element"),
    row("Whirlpool", "washing_machine", "F4 E2", "Heater not turning on", "Heater relay open", "TEST #9"),
    row("Whirlpool", "washing_machine", "F4 E4", "Vent/dry blower motor fault", "Open/short fan motor", "TEST #13 or #17"),
    row("Whirlpool", "washing_machine", "F5 E1", "Door switch fault", "Switch open while locked", "TEST #4 door lock"),
    row("Whirlpool", "washing_machine", "F5 E4", "Door not open between cycles", "User did not open door", "Open door; TEST #4", ["F5E4", "DR"]),
    row("Whirlpool", "washing_machine", "dr", "Door not open between cycles", "User did not open door", "Open door between cycles", ["F5E4", "DR"]),
    row("Whirlpool", "washing_machine", "F6 E1", "ACU cannot hear HMI", "HMI communication loss", "Check J19 harness; TEST #2"),
    row("Whirlpool", "washing_machine", "F6 E2", "HMI cannot hear ACU", "UI communication loss", "Check J19 harness; TEST #2"),
    row("Whirlpool", "washing_machine", "F6 E3", "ACU-MCU communication", "Motor controller comm loss", "TEST #1, #3"),
    row("Whirlpool", "washing_machine", "F7 E2", "Motor control internal fault", "ACU motor section fault", "TEST #3; replace ACU/stator"),
    row("Whirlpool", "washing_machine", "F7 E8", "Motor over-temp", "Overload or friction", "TEST #3; clear obstruction"),
    row("Whirlpool", "washing_machine", "F7 E9", "Motor locked rotor", "Mechanical bind", "TEST #3; check drum"),
    row("Whirlpool", "washing_machine", "F7 EA", "Motor lost phase", "Stator/harness fault", "TEST #3"),
    row("Whirlpool", "washing_machine", "F7 EC", "Motor overload", "Excessive load", "TEST #3; reduce load"),
    row("Whirlpool", "washing_machine", "FCE0", "WiFi module error", "HMI-WiFi comm failure", "Check WiFi module; Section 5"),
    # Samsung FlexWash dual-load
    row("Samsung", "washing_machine", "AC", "Sub-main PBA communication", "Loose sub PBA connector", "Reseat sub PBA; inspect soldering"),
    row("Samsung", "washing_machine", "AC4", "WiFi module communication", "WiFi harness fault", "Check WiFi module connections"),
    row("Samsung", "washing_machine", "AC6", "Inverter PBA communication", "Inverter harness fault", "Check inverter PBA connector"),
    row("Samsung", "washing_machine", "AC7", "Upper-lower PCB communication", "Dual-washer interconnect fault", "Check upper↔lower main PCB harness"),
    row("Samsung", "washing_machine", "BC2", "Stuck button / main relay", "Panel deformation or stuck key", "Inspect buttons; sub PBA mounting"),
    row("Samsung", "washing_machine", "DC1", "Door lock switch fault", "Lock terminal broken or leakage", "Inspect door lock switch wiring"),
    row("Samsung", "washing_machine", "DC4", "Upper washer door open", "Upper door not closed", "Close upper washer door"),
    row("Samsung", "washing_machine", "4C2", "Hot/cold hose mis-routed", "Wrong hose engagement or high temp", "Correct hoses; check Wool/Lingerie temp"),
    row("Samsung", "washing_machine", "HC1", "Heater fault (variant)", "Heater short/open with false level", "Check heater and tub temp sensor"),
    row("Samsung", "washing_machine", "TC1", "Wash heater temp sensor", "Sensor contact or disconnect", "Check heater sensor connector"),
    row("Samsung", "washing_machine", "TC4", "Inverter over-temp", "Inverter PBA overheating", "Inspect inverter PBA cooling"),
    row("Samsung", "washing_machine", "SF", "System fault / MCU fail", "Main PCB microcontroller failure", "Replace main PCB assembly"),
    # Insignia washers
    row("Insignia", "washing_machine", "E1", "Abnormal water intake", "Faucets off, low pressure, clogged screens", "Open faucets; clean screens; check inlet valve"),
    row("Insignia", "washing_machine", "E2", "Drain timeout", "Blocked hose/pump, lid open", "Straighten hose; test pump; clear pump"),
    row("Insignia", "washing_machine", "E3", "Lid open", "Lid switch or magnet failure", "Close lid; test lid switch/magnet"),
    row("Insignia", "washing_machine", "E4", "Unbalance in spin", "Uneven load", "Level unit; rebalance load"),
    row("Insignia", "washing_machine", "E5", "Impact switch disconnected", "Tub pressing switch; loose terminals", "Reinstall suspension; test impact switch"),
    row("Insignia", "washing_machine", "F2", "PCB failure", "Power PCB fault", "Replace power PCB"),
    row("Insignia", "washing_machine", "F8", "Water level sensor fault", "Sensor out of spec", "Test sensor frequency or capacitance; replace"),
    row("Insignia", "washing_machine", "Fd", "Door lock failed", "Lid lock actuator or harness", "Inspect door lock"),
    row("Insignia", "washing_machine", "C9", "PCB failure", "Main PCB fault", "Replace PCBs"),
    row("Insignia", "washing_machine", "CL", "Child lock door timeout", "Door open >20 min with child lock", "Power off; disable child lock"),
    # Whirlpool ADA dishwasher legacy
    row("Whirlpool", "dishwasher", "E1", "Water inlet failure", "No fill in 4 min", "Check supply, inlet valve, flow meter, pressure switch"),
    row("Whirlpool", "dishwasher", "E3", "Heater failure", "Temp not reached in 90 min", "Test heater and thermistor"),
    row("Whirlpool", "dishwasher", "E4", "Overflow", "Base pan switch tripped", "Level unit; locate leak; check overflow switch"),
    row("Whirlpool", "dishwasher", "E6", "NTC open circuit", "Open thermistor or harness", "Test thermistor circuit"),
    row("Whirlpool", "dishwasher", "E7", "NTC short circuit", "Shorted thermistor or harness", "Test thermistor circuit"),
    # KitchenAid dishwasher ACU
    row("KitchenAid", "dishwasher", "F1 E1", "ACU failure", "Main control fault", "Replace ACU"),
    row("KitchenAid", "dishwasher", "F1 E2", "MCU failure", "Motor control section fault", "Replace ACU"),
    row("KitchenAid", "dishwasher", "F2 E1", "Stuck key", "UI button stuck", "Replace console or control"),
    row("KitchenAid", "dishwasher", "F3 E1", "Thermistor/OWI open or short", "NTC or OWI circuit fault", "Test OWI/thermistor harness"),
    row("KitchenAid", "dishwasher", "F3 E2", "OWI calibration failed", "Dirty OWI lens or bad sensor", "Clean OWI; fix drain loop check valve"),
    row("KitchenAid", "dishwasher", "F4 E2", "Heater open or relay failed", "Open heater circuit", "Test heater and relay"),
    row("KitchenAid", "dishwasher", "F4 E3", "Heater relay shorted", "Heater stuck on", "Replace control; inspect heater"),
    row("KitchenAid", "dishwasher", "F5 E1", "Door stuck open", "Door not latched", "Test latch and door switch"),
    row("KitchenAid", "dishwasher", "F5 E2", "Door stuck closed", "Switch stuck; door not opened between cycles", "Test latch; educate user"),
    row("KitchenAid", "dishwasher", "F6 E1", "No response from ACU", "UI-ACU communication", "Reseat HMI harness"),
    row("KitchenAid", "dishwasher", "F7 E1", "Single-speed wash motor failure", "Motor or drive circuit", "Test wash motor"),
    row("KitchenAid", "dishwasher", "F7 E2", "Variable-speed wash motor failure", "Motor or drive circuit", "Test wash motor"),
    row("KitchenAid", "dishwasher", "F7 E4", "RIF filter plugged", "Removable filter blocked", "Clean RIF filter"),
    row("KitchenAid", "dishwasher", "F8 E1", "No water / tap closed", "Supply off or inlet fault", "Open tap; test fill valve"),
    row("KitchenAid", "dishwasher", "F8 E2", "Fill valve electrical", "Open solenoid or fuse", "Test fill valve coil"),
    row("KitchenAid", "dishwasher", "F8 E3", "Low water / suds in pump", "Wrong detergent or air in pump", "Correct detergent; check sump"),
    row("KitchenAid", "dishwasher", "F8 E4", "Overfill / float open", "Stuck inlet or float fault", "Test float and inlet valve"),
    row("KitchenAid", "dishwasher", "F8 E5", "Fill valve stuck on", "Inlet valve stuck open", "Replace fill valve"),
    row("KitchenAid", "dishwasher", "F8 E6", "Flow meter failed", "Flow meter or harness", "Test flow meter"),
    row("KitchenAid", "dishwasher", "F9 E1", "Not draining", "Drain path obstruction", "Clear drain hose and filter"),
    row("KitchenAid", "dishwasher", "F9 E2", "Drain motor electrical", "Open drain motor winding", "Test drain motor"),
    row("KitchenAid", "dishwasher", "F9 E4", "Tub light failure", "Tub light circuit", "Test tub light"),
    row("KitchenAid", "dishwasher", "F10 E1", "Dispenser electrical", "Open dispenser solenoid", "Test dispenser coil"),
    row("KitchenAid", "dishwasher", "F10 E2", "Vent wax motor electrical", "Open vent motor", "Test vent wax motor"),
    row("KitchenAid", "dishwasher", "F10 E3", "Drying fan electrical", "Open drying fan", "Test drying fan motor"),
    row("KitchenAid", "dishwasher", "F10 E4", "Diverter cannot find position", "Diverter motor/sensor", "Test diverter"),
    row("KitchenAid", "dishwasher", "F10 E5", "Diverter leak detected", "Diverter seal leak", "Inspect diverter and sump"),
    # LG dishwasher
    row("LG", "dishwasher", "VARIO ERROR", "Vario cam position fault", "Misassembled vario switch; failed motor", "Reassemble vario switch; test 4 kΩ motor"),
    # Frigidaire Professional
    row("Frigidaire", "refrigerator", "Er t1", "Freezer temp sensor fault", "Open/short FZ sensor", "Test FZ thermistor"),
    row("Frigidaire", "refrigerator", "Er t2", "FZ defrost sensor fault", "Open/short defrost sensor", "Test defrost thermistor"),
    row("Frigidaire", "refrigerator", "Er t3", "Fresh food temp sensor fault", "Open/short FF sensor", "Test FF thermistor"),
    row("Frigidaire", "refrigerator", "Er t4", "FF defrost sensor fault", "Open/short FF defrost sensor", "Test sensor"),
    row("Frigidaire", "refrigerator", "Er t5", "VCZ temp sensor fault", "Variable zone sensor fault", "Test VCZ thermistor"),
    row("Frigidaire", "refrigerator", "Er t6", "FFIM tray sensor fault", "Ice tray sensor open/short", "Test FFIM sensor"),
    row("Frigidaire", "refrigerator", "Er CE", "UI-main communication", "Display harness or board", "Reseat UI harness; replace board"),
    # Insignia/Midea refrigerator
    row("Insignia", "refrigerator", "E0", "Ice maker fault", "Ice maker assembly or sensor", "Run EYE test mode; inspect I/M"),
    row("Insignia", "refrigerator", "E1", "Refrigerator temp sensor", "RC thermistor fault", "Test NTC B3839"),
    row("Insignia", "refrigerator", "E2", "Freezer temp sensor", "FZ thermistor fault", "Test NTC B3839"),
    row("Insignia", "refrigerator", "E4", "RC defrost sensor", "Defrost thermistor fault", "Test defrost sensor"),
    row("Insignia", "refrigerator", "E5", "FZ defrost sensor", "Defrost thermistor fault", "Test defrost sensor"),
    row("Insignia", "refrigerator", "E6", "Communication failure", "Display-main CN9 harness", "Reseat CN9 harness"),
    row("Insignia", "refrigerator", "E7", "Ambient temp sensor", "Ambient thermistor fault", "Test ambient sensor"),
    row("Insignia", "refrigerator", "E9", "High temp alarm FZ", "Door seal; compressor; sealed system", "Check gasket; verify compressor run"),
    row("Insignia", "refrigerator", "EE", "Ice maker sensor circuit", "Ice maker sensor fault", "Test ice maker sensor"),
    row("Insignia", "refrigerator", "EH", "Ambient humidity sensor", "Humidity sensor fault", "Test humidity sensor"),
    row("Insignia", "refrigerator", "EF", "Water tank not installed", "Tank missing or mis-seated", "Install water tank correctly"),
    row("Insignia", "refrigerator", "CA", "Main-ice maker board comm", "Ice maker PCB harness", "Check ice maker board connections"),
    row("Insignia", "refrigerator", "EP", "Ice maker off-ice fault", "Ice maker mechanical fault", "Inspect ice maker assembly"),
    # Insignia freezer
    row("Insignia", "freezer", "E2", "Freezer temp sensor", "FZ thermistor fault", "Test NTC B3839"),
    row("Insignia", "freezer", "E5", "FZ defrost sensor", "Defrost thermistor fault", "Test defrost sensor"),
    row("Insignia", "freezer", "E6", "Communication failure", "Display-main harness", "Reseat harness"),
    row("Insignia", "freezer", "E7", "Ambient temp sensor", "Ambient thermistor fault", "Test ambient sensor"),
    row("Insignia", "freezer", "E9", "High temp alarm", "Door seal; frost; sealed system", "Check gasket and evaporator fan"),
    # LG dryer duct
    row("LG", "dryer", "d85", "Duct restriction (intermediate)", "Restricted exhaust path", "Clean vent; verify ≤0.6 in. W.C. static pressure"),
    # Microwaves
    row("Samsung", "microwave", "C-20", "Temp sensor error", "Sensor unit or substrate connection", "Check sensor; short = black wire"),
    row("Samsung", "microwave", "C-F1", "PBA defect", "Main PCB failure", "Replace PBA"),
    row("Samsung", "microwave", "C-F2", "Touch defect", "Touch film or connector", "Check touch film tape and connector"),
    row("LG", "microwave", "F-1", "PCB thermistor short", "Cabinet thermistor shorted", "Replace thermistor or PCB"),
    row("LG", "microwave", "F-2", "PCB thermistor open", "Cabinet thermistor open", "Replace thermistor or PCB"),
    row("LG", "microwave", "F-4", "Humidity sensor fault", "Humidity sensor open or short", "Test humidity sensor"),
    # Whirlpool dryer gaps from cabrio misfile sheet
    row("Whirlpool", "dryer", "F1 E3", "Incorrect controller installed", "ACU/UI part mismatch", "Verify and replace mismatched board"),
    row("Whirlpool", "dryer", "F1 E5", "Parameter memory invalid", "Missing ACU parameter file", "Replace ACU"),
    row("Whirlpool", "dryer", "F2 E4", "UI incompatible parameter file", "UI software mismatch", "Replace UI"),
    row("Whirlpool", "dryer", "F2 E5", "UI parameter memory invalid", "Corrupt UI EEPROM", "Replace UI"),
    row("Whirlpool", "dryer", "F4 E2", "Heater 2 relay failure", "Heater 2 wiring (electric)", "Check heater 2 relay and wiring"),
    row("Whirlpool", "dryer", "F6 E3", "ACU cannot hear UI", "ACU-UI harness fault", "Check ACU↔UI harness"),
]


def main() -> None:
    existing = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    keys = {norm_key(r["manufacturer"], r["equipment_subtype"], r["code_normalized"]) for r in existing}
    added = 0
    skipped = 0
    for new_row in NEW_ROWS:
        key = norm_key(new_row["manufacturer"], new_row["equipment_subtype"], new_row["code_normalized"])
        if key in keys:
            skipped += 1
            continue
        existing.append(new_row)
        keys.add(key)
        added += 1
    for row_data in existing:
        alias = str(row_data.get("alias_group_id", ""))
        if not UUID_RE.match(alias):
            raise SystemExit(f"Invalid UUID: {alias}")
    JSON_PATH.write_text(json.dumps(existing, indent=2) + "\n", encoding="utf-8")
    print(f"Added {added} rows, skipped {skipped} duplicates. Total: {len(existing)}")


if __name__ == "__main__":
    main()
