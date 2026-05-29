"""Default DMA repair tag vocabulary (slug, label, category)."""

DMA_TAG_CATEGORIES = ("system", "symptom", "failure", "action", "confidence")

DEFAULT_DMA_TAGS: list[tuple[str, str, str]] = [
    # System — subsystem / component
    ("drain", "Drain", "system"),
    ("drain_pump", "Drain pump", "system"),
    ("compressor", "Compressor", "system"),
    ("frost", "Frost / defrost", "system"),
    ("evap_fan", "Evap fan", "system"),
    ("control_board", "Control board", "system"),
    ("pressure_hose", "Pressure hose", "system"),
    ("thermistor", "Thermistor", "system"),
    ("inlet_valve", "Inlet valve", "system"),
    ("door_latch", "Door latch", "system"),
    ("heating_element", "Heating element", "system"),
    ("igniter", "Igniter", "system"),
    ("belt", "Belt", "system"),
    ("motor", "Motor", "system"),
    ("inverter_board", "Inverter board", "system"),
    ("wiring", "Wiring / harness", "system"),
    ("capacitor", "Capacitor", "system"),
    ("fan_motor", "Fan motor", "system"),
    ("ice_maker", "Ice maker", "system"),
    ("sensor", "Sensor", "system"),
    ("pump", "Pump", "system"),
    ("filter", "Filter", "system"),
    ("detergent", "Detergent / suds", "system"),
    ("sealed_system", "Sealed system", "system"),
    ("defrost_timer", "Defrost timer", "system"),
    ("relay", "Relay / overload", "system"),
    ("airflow", "Airflow", "system"),
    # Symptom — customer-facing / observed
    ("leak", "Leak", "symptom"),
    ("no_cool", "No cool", "symptom"),
    ("not_draining", "Not draining", "symptom"),
    ("not_heating", "Not heating", "symptom"),
    ("not_spinning", "Not spinning", "symptom"),
    ("intermittent", "Intermittent", "symptom"),
    ("noisy", "Noisy", "symptom"),
    ("dead", "Dead / no power", "symptom"),
    ("restriction", "Restriction", "symptom"),
    # Failure — how it failed
    ("clogged", "Clogged", "failure"),
    # Action — what you did
    ("replaced", "Replaced", "action"),
    ("cleaned", "Cleaned", "action"),
    ("cleared", "Cleared", "action"),
    # Confidence — outcome certainty
    ("confirmed_failure", "Confirmed failure", "confidence"),
    ("suspected_failure", "Suspected failure", "confidence"),
    ("repeat_failure", "Repeat failure", "confidence"),
    ("callback", "Callback", "confidence"),
    ("verified_repair", "Verified repair", "confidence"),
    ("temporary_fix", "Temporary fix", "confidence"),
]

CATEGORY_SORT_ORDER = {name: index for index, name in enumerate(DMA_TAG_CATEGORIES)}
