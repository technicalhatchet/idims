from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_admin_or_manager_user
from app.db.database import get_db
from app.models.user import User
from app.services.feature_flags_service import FeatureContext, require_feature
from app.services.maintenance_service import materialize_all_appliances

router = APIRouter()


def _staff_ctx(user: User) -> FeatureContext:
    return FeatureContext(roles=list(user.roles or []))


@router.post("/materialize-all", response_model=Dict[str, Any])
async def post_materialize_all_maintenance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "maintenance_reminders", _staff_ctx(current_user))
    result = materialize_all_appliances(db)
    db.commit()
    return result
