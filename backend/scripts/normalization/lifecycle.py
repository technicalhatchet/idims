from __future__ import annotations


class NormalizationLifecycleError(RuntimeError):
    """Raised when normalization must not proceed or report success."""

    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code
