from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from typing import List
from app.api.dependencies.auth import get_current_user, CurrentUser, get_settings
from app.repositories.history_repository import HistoryRepository
from app.services.history_service import HistoryService, ForbiddenError, NotFoundError


router = APIRouter()


class ChatMessage(BaseModel):
    """Request model for posting a chat message to history."""
    sid: str
    role: str
    content: str


def get_history_service(settings = Depends(get_settings)) -> HistoryService:
    repo = HistoryRepository(settings)
    return HistoryService(repo)


@router.get("/history")
async def get_history(
    sid: str = Query(..., min_length=1),
    limit: int = Query(100, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
    service: HistoryService = Depends(get_history_service),
):
    """Get history for a user-owned session id; enforces authorization first."""
    try:
        return await service.get_history(user.id, sid, limit)
    except ForbiddenError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve history")


@router.post("/history")
async def post_history(
    msg: ChatMessage,
    user: CurrentUser = Depends(get_current_user),
    service: HistoryService = Depends(get_history_service),
):
    """Append a sanitized message to history with role and ownership checks."""
    try:
        ok = await service.append_message(user.id, msg.sid, msg.role, msg.content)
        return {"ok": ok}
    except ForbiddenError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to store message")