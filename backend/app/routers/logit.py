import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.logit import LogitEntry, LogitProject
from app.models.user import User
from app.schemas.logit import (
    LogitClassifyRequest,
    LogitClassifyResponse,
    LogitEntryCreate,
    LogitEntryResponse,
    LogitEntryUpdate,
    LogitProjectCreate,
    LogitProjectResponse,
    LogitProjectUpdate,
)
from app.services.gemini_logit_service import classify_logit_observation

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_owned_project(db: Session, project_id: UUID, user_id: UUID) -> LogitProject:
    project = (
        db.query(LogitProject)
        .filter(LogitProject.id == project_id, LogitProject.user_id == user_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _get_owned_entry(db: Session, entry_id: UUID, user_id: UUID) -> LogitEntry:
    entry = (
        db.query(LogitEntry)
        .filter(LogitEntry.id == entry_id, LogitEntry.user_id == user_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return entry


def _project_response(db: Session, project: LogitProject) -> LogitProjectResponse:
    entry_count = (
        db.query(func.count(LogitEntry.id))
        .filter(LogitEntry.project_id == project.id)
        .scalar()
        or 0
    )
    unreviewed_count = (
        db.query(func.count(LogitEntry.id))
        .filter(LogitEntry.project_id == project.id, LogitEntry.status == "draft")
        .scalar()
        or 0
    )
    return LogitProjectResponse(
        id=project.id,
        name=project.name,
        context=project.context,
        icon=project.icon,
        created_at=project.created_at,
        updated_at=project.updated_at,
        entry_count=entry_count,
        unreviewed_count=unreviewed_count,
    )


@router.get("/projects", response_model=List[LogitProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = (
        db.query(LogitProject)
        .filter(LogitProject.user_id == current_user.id)
        .order_by(LogitProject.updated_at.desc())
        .all()
    )
    return [_project_response(db, project) for project in projects]


@router.post("/projects", response_model=LogitProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: LogitProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = LogitProject(
        user_id=current_user.id,
        name=body.name.strip(),
        context=(body.context or "").strip() or None,
        icon=(body.icon or "📝").strip() or "📝",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_response(db, project)


@router.patch("/projects/{project_id}", response_model=LogitProjectResponse)
async def update_project(
    project_id: UUID,
    body: LogitProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, project_id, current_user.id)
    if body.name is not None:
        project.name = body.name.strip()
    if body.context is not None:
        project.context = body.context.strip() or None
    if body.icon is not None:
        project.icon = body.icon.strip() or "📝"
    db.commit()
    db.refresh(project)
    return _project_response(db, project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, project_id, current_user.id)
    db.delete(project)
    db.commit()
    return None


@router.get("/projects/{project_id}/entries", response_model=List[LogitEntryResponse])
async def list_entries(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_project(db, project_id, current_user.id)
    entries = (
        db.query(LogitEntry)
        .filter(LogitEntry.project_id == project_id, LogitEntry.user_id == current_user.id)
        .order_by(LogitEntry.created_at.desc())
        .all()
    )
    return entries


@router.get("/entries/{entry_id}", response_model=LogitEntryResponse)
async def get_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_owned_entry(db, entry_id, current_user.id)


@router.post("/classify", response_model=LogitClassifyResponse)
async def classify_observation(
    body: LogitClassifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, body.project_id, current_user.id)
    transcript = body.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transcript is required")

    try:
        result = await classify_logit_observation(
            project.name,
            project.context or "",
            transcript,
            body.observation_type,
        )
    except Exception as exc:
        logger.warning("LoGiT classification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not classify observation right now. Try again or save as draft.",
        ) from exc

    return LogitClassifyResponse(
        classification=result["classification"],
        model=result.get("model"),
        source=result.get("source", "gemini"),
    )


@router.post("/entries", response_model=LogitEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    body: LogitEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_project(db, body.project_id, current_user.id)
    transcript = body.original_transcript.strip()
    if not transcript:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transcript is required")

    entry = LogitEntry(
        project_id=body.project_id,
        user_id=current_user.id,
        original_transcript=transcript,
        status=body.status,
        type=body.type,
        category=body.category,
        severity=body.severity,
        frequency=body.frequency,
        title=body.title,
        description=body.description,
        impact=body.impact,
        suggested_fix=body.suggested_fix,
        ai_title=body.ai_title,
        ai_description=body.ai_description,
        ai_impact=body.ai_impact,
        ai_suggested_fix=body.ai_suggested_fix,
        ai_confidence=body.ai_confidence,
        ai_model=body.ai_model,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/entries/{entry_id}", response_model=LogitEntryResponse)
async def update_entry(
    entry_id: UUID,
    body: LogitEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = _get_owned_entry(db, entry_id, current_user.id)
    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = _get_owned_entry(db, entry_id, current_user.id)
    db.delete(entry)
    db.commit()
    return None
