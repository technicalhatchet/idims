from app.services.work_order_performance_service import (
    ON_TIME_GRACE_MINUTES,
    classify_schedule_adherence_delta,
)


def test_early_arrival_beyond_grace_counts_as_on_time():
    on_time, direction = classify_schedule_adherence_delta(-20)
    assert on_time is True
    assert direction == "early"


def test_arrival_within_grace_is_on_time():
    on_time, direction = classify_schedule_adherence_delta(10)
    assert on_time is True
    assert direction == "on_time"


def test_arrival_at_grace_boundary_is_on_time():
    on_time, direction = classify_schedule_adherence_delta(ON_TIME_GRACE_MINUTES)
    assert on_time is True
    assert direction == "on_time"


def test_arrival_beyond_grace_is_late():
    on_time, direction = classify_schedule_adherence_delta(ON_TIME_GRACE_MINUTES + 1)
    assert on_time is False
    assert direction == "late"
