"""Expense category slugs (parts cost lives on WorkOrderPart, not here)."""

EXPENSE_CATEGORIES: tuple[str, ...] = (
    "fuel",
    "tools",
    "vehicle",
    "supplies",
    "advertising",
    "software",
    "insurance",
    "office",
    "tolls",
    "parking",
    "subcontractor",
    "disposal",
    "misc",
)

EXPENSE_CATEGORY_LABELS: dict[str, str] = {
    "fuel": "Fuel",
    "tools": "Tools",
    "vehicle": "Vehicle",
    "supplies": "Supplies",
    "advertising": "Advertising",
    "software": "Software",
    "insurance": "Insurance",
    "office": "Office",
    "tolls": "Tolls",
    "parking": "Parking",
    "subcontractor": "Subcontractor labor",
    "disposal": "Disposal fees",
    "misc": "Misc",
}

MILEAGE_METHODS: tuple[str, ...] = ("estimated", "odometer", "calculated")
