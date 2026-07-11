"""Problem and resolution codes for DMA (Diagnostic Memory Amplifier) repair outcomes."""

DMA_PROBLEM_CODES = {
    "not_cooling": "Not cooling / no cool",
    "not_heating": "Not heating",
    "not_draining": "Not draining",
    "leaking": "Leaking water",
    "noisy": "Noisy / vibration",
    "wont_start": "Won't start / no power",
    "wont_spin": "Won't spin / agitate",
    "wont_stop_spinning": "Won't stop spinning",
    "ice_maker": "Ice maker issue",
    "door_seal": "Door seal / gasket",
    "error_code_display": "Error code on display",
    "poor_drying": "Poor drying / heating element",
    "display_issue": "Display / UI issue",
    "other": "Other",
}

DMA_RESOLUTION_CODES = {
    "mechanical_adjustment": "Mechanical adjustment made",
    "electrical_adjustment": "Electrical adjustment made",
    "mechanical_part_replaced": "Mechanical part replaced",
    "electrical_part_replaced": "Electrical part replaced",
    "cleaning_maintenance": "Cleaning / maintenance",
    "reset_software": "Reset / software update",
    "wiring_repair": "Wiring / connection repair",
    "other": "Other",
}

REPAIR_OUTCOME_NOTE_TYPE = "Repair Outcome"
