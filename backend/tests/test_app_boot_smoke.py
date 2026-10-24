"""Ensure the FastAPI app and worker package import without NameError (model column types, etc.)."""


def test_import_app_main():
    import app.main  # noqa: F401

    assert app.main.app is not None


def test_import_celery_worker_module():
    import app.background.worker as worker

    assert hasattr(worker, "celery_app")
    assert hasattr(worker, "setup_background_tasks")
