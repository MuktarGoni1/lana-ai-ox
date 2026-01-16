from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from supabase import create_client, Client

from app.config import SUPABASE_URL, SUPABASE_KEY
from app.repositories.interfaces import IChatRepository


class SupabaseChatRepository(IChatRepository):
    """Supabase-backed chat repository implementation.

    Adheres to layered architecture: the repository abstracts storage and is injected
    into controllers/services via the `IChatRepository` interface.
    """

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None) -> None:
        url = (url or SUPABASE_URL or "").strip()
        key = (key or SUPABASE_KEY or "").strip()
        if not url or not key:
            raise ValueError("Supabase URL and KEY must be provided")
        self.client: Client = create_client(url, key)
        self.table_name = "chat_messages"

    async def append_message(self, sid: str, role: str, content: str) -> bool:
        if not sid or not role:
            return False
        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "sid": sid,
            "role": role,
            "content": content,
            "created_at": now,
        }
        try:
            res = self.client.table(self.table_name).insert(payload).execute()
            return bool(getattr(res, "data", None))
        except Exception:
            return False

    async def get_history(self, sid: str, limit: int = 100) -> List[Dict[str, Any]]:
        if not sid:
            return []
        try:
            res = (
                self.client.table(self.table_name)
                .select("sid, role, content, created_at")
                .eq("sid", sid)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            data: Optional[List[Dict[str, Any]]] = getattr(res, "data", None)
            return data or []
        except Exception:
            return []