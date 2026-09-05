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
    "restricted_ventilation": "Restricted ventilation / duct",
    "display_issue": "Display / UI issue",
    "other": "Other",
}

DMA_RESOLUTION_CODES = {
    "mechanical_adjustment": "Mechanical adjustment made",
    "electrical_adjustment": "Electrical adjustment made",
    "mechanical_part_replaced": "Mechanical part replaced",
    "electrical_part_replaced": "Electrical part replaced",
    "cleaning_maintenance": "Cleaning / maintenance",
    "external_cause": "External cause — not appliance fault",
    "customer_education": "Customer education / usage",
    "referred_third_party": "Referred third-party service",
    "reset_software": "Reset / software update",
    "wiring_repair": "Wiring / connection repair",
    "other": "Other",
}

REPAIR_OUTCOME_NOTE_TYPE = "Repair Outcome"


def parse_dma_code_list(value: str | None) -> list[str]:
    """Split comma-separated DMA code slugs into a de-duplicated list."""
    if not value:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for part in str(value).split(","):
        token = part.strip()
        if token and token not in seen:
            seen.add(token)
            out.append(token)
    return out


def join_dma_code_list(value: str | list[str] | None) -> str | None:
    """Normalize chip list storage as comma-separated slugs."""
    if value is None:
        return None
    if isinstance(value, list):
        tokens = [str(item).strip() for item in value if str(item).strip()]
    else:
        tokens = parse_dma_code_list(value)
    if not tokens:
        return None
    return ", ".join(tokens)


def validate_dma_code_list(
    value: str | None,
    allowed: dict[str, str],
    field_name: str,
) -> str | None:
    """Validate each slug in a comma-separated code list."""
    if not value:
        return value
    tokens = parse_dma_code_list(value)
    invalid = [token for token in tokens if token not in allowed]
    if invalid:
        allowed_keys = sorted(allowed.keys())
        raise ValueError(
            f"{field_name} contains invalid value(s): {invalid}. "
            f"Each code must be one of {allowed_keys}"
        )
    return join_dma_code_list(tokens)
