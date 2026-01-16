from typing import Any, Dict, List, Optional
from app.repositories.interfaces import IChatRepository
from app.repositories.supabase_chat_repository import SupabaseChatRepository
from app.settings import Settings


class InMemoryChatRepository(IChatRepository):
    def __init__(self) -> None:
        self._store: Dict[str, List[Dict[str, Any]]] = {}

    async def append_message(self, sid: str, role: str, content: str) -> bool:
        self._store.setdefault(sid, []).append(
            {"sid": sid, "role": role, "content": content, "created_at": ""}
        )
        return True

    async def get_history(self, sid: str, limit: int = 100) -> List[Dict[str, Any]]:
        return (self._store.get(sid, []) or [])[:limit]


class HistoryRepository(IChatRepository):
    """Repository that selects Supabase or in-memory with async-safe calls."""

    def __init__(self, settings: Settings) -> None:
        self._repo: IChatRepository
        url = (settings.supabase_url or "").strip()
        key = (settings.supabase_service_role_key or settings.supabase_anon_key or "").strip()
        if url and key:
            try:
                self._repo = SupabaseChatRepository(url=url, key=key)
            except Exception:
                self._repo = InMemoryChatRepository()
        else:
            self._repo = InMemoryChatRepository()

    async def append_message(self, sid: str, role: str, content: str) -> bool:
        return await self._repo.append_message(sid, role, content)

    async def get_history(self, sid: str, limit: int = 100) -> List[Dict[str, Any]]:
        return await self._repo.get_history(sid, limit)