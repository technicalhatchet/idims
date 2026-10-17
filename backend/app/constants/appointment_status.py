"""appointment_status_enum labels — must match WorkOrderAppointment.status SQLAlchemy Enum."""

from app.models.work_order import WorkOrderAppointment

APPOINTMENT_STATUS_CANCELED = "canceled"


def appointment_status_enum_values() -> tuple[str, ...]:
    """Enum members as defined on the model (same set Postgres appointment_status_enum allows)."""
    return tuple(WorkOrderAppointment.__table__.c.status.type.enums)
