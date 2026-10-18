from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ClientMergeFieldChoices(BaseModel):
    name: Literal["keep", "merge"] = "keep"
    email: Literal["keep", "merge"] = "keep"
    mobile: Literal["keep", "merge"] = "keep"
    phone: Literal["keep", "merge"] = "keep"


class ClientMergeRequest(BaseModel):
    keep_client_id: UUID
    merge_client_id: UUID
    field_choices: ClientMergeFieldChoices = Field(default_factory=ClientMergeFieldChoices)


class ClientMergeExecuteResponse(BaseModel):
    success: bool = True
    keep_client_id: UUID
    merge_client_id: UUID
    audit_id: UUID
    warnings: List[Dict[str, Any]]
