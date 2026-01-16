from typing import Any, Dict, List
from app.repositories.interfaces import IChatRepository


class NotFoundError(Exception):
    pass


class ForbiddenError(Exception):
    pass


def sanitize_text(text: str) -> str:
    import re, html
    if not text:
        return ""
    text = html.escape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


class HistoryService:
    """Service layer for chat history operations.

    Enforces authorization checks (S-2), input sanitization (S-1), and returns
    normalized DTOs for API responses (A-3). All repository I/O is async (P-1).
    """

    def __init__(self, repo: IChatRepository) -> None:
        """Initialize with a repository abstraction (A-2)."""
        self.repo = repo

    async def get_history(self, user_id: str, sid: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Return chat history for a user-scoped session id.

        Raises ForbiddenError if the session doesn't belong to the user (S-2).
        """
        # Handle guest users - they can only access their own guest sessions
        if user_id.startswith("guest-"):
            # For guest users, the session ID should match their user ID
            if sid != user_id:
                raise ForbiddenError("Guest users can only access their own sessions")
        else:
            # For authenticated users, session IDs must be namespaced by user
            if not sid.startswith(f"{user_id}:"):
                raise ForbiddenError("Session does not belong to user")
        
        msgs = await self.repo.get_history(sid, limit=limit)
        return [
            {
                "id": f"{m.get('sid','')}-{i}",
                "title": (m.get("content") or "").strip()[:48] or "(empty)",
                "timestamp": m.get("created_at") or "",
            }
            for i, m in enumerate(msgs)
        ]

    async def append_message(self, user_id: str, sid: str, role: str, content: str) -> bool:
        """Append a message to a session after role and ownership checks."""
        if role not in {"user", "assistant"}:
            raise ForbiddenError("Invalid role")
        
        # Handle guest users - they can only access their own guest sessions
        if user_id.startswith("guest-"):
            # For guest users, the session ID should match their user ID
            if sid != user_id:
                raise ForbiddenError("Guest users can only access their own sessions")
        else:
            # For authenticated users, session IDs must be namespaced by user
            if not sid.startswith(f"{user_id}:"):
                raise ForbiddenError("Session does not belong to user")
        
        content = sanitize_text(content)
        return await self.repo.append_message(sid, role, content)