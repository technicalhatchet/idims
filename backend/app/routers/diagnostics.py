import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.diagnostics_ai import (
    GenerateDiagnosticNotesRequest,
    GenerateDiagnosticNotesResponse,
)
from app.services.gemini_note_service import generate_diagnostic_notes

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/generate-notes", response_model=GenerateDiagnosticNotesResponse)
async def generate_notes_route(
    body: GenerateDiagnosticNotesRequest,
    current_user: User = Depends(get_current_user),
):
    """Rewrite structured diagnostic facts into service note prose (summarize only)."""
    if current_user.is_client:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients cannot generate diagnostic notes",
        )

    result = await generate_diagnostic_notes(body)
    return GenerateDiagnosticNotesResponse(
        rootCauseSummary=result["rootCauseSummary"],
        technicianNote=result["technicianNote"],
        customerExplanation=result["customerExplanation"],
        source=result.get("source", "gemini"),
        model=result.get("model"),
        fallbackReason=result.get("fallbackReason"),
    )
