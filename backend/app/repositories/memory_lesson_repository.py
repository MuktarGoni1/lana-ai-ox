from typing import Any, Dict, List, Optional
from datetime import datetime

from app.repositories.interfaces import ILessonRepository

class MemoryLessonRepository(ILessonRepository):
    """In-memory lesson repository for development and fallback."""

    def __init__(self):
        self._history: List[Dict[str, Any]] = []

    async def save_lesson_history(self, user_id: str, topic: str, lesson_data: Dict[str, Any]) -> str:
        entry = {
            "id": str(len(self._history) + 1),
            "uid": user_id,
            "title": topic,
            "content": lesson_data,
            "created_at": datetime.utcnow().isoformat(),
        }
        self._history.append(entry)
        return entry["id"]

    async def get_user_history(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        data = [
            {"id": e["id"], "title": e["title"], "created_at": e["created_at"]}
            for e in self._history if e.get("uid") == user_id
        ]
        return data[offset : offset + limit]

    async def get_lesson_by_id(self, lesson_id: str) -> Optional[Dict[str, Any]]:
        for e in self._history:
            if e.get("id") == lesson_id:
                return e.get("content")
        return None

    async def delete_lesson_by_id(self, lesson_id: str) -> bool:
        for i, e in enumerate(self._history):
            if e.get("id") == lesson_id:
                del self._history[i]
                return True
        return False

    async def get_popular_topics(self, limit: int = 10) -> List[str]:
        freq: Dict[str, int] = {}
        for e in self._history:
            t = e.get("title")
            if t:
                freq[t] = freq.get(t, 0) + 1
        popular = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        return [t for t, _ in popular[:limit]]