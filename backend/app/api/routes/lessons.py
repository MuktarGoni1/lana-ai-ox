"""
Lessons API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore
from typing import List
from app.services.lesson_service import LessonService
from app.repositories.interfaces import ILessonRepository
from app.repositories.memory_cache_repository import MemoryCacheRepository
from app.repositories.memory_lesson_repository import MemoryLessonRepository
from app.repositories.supabase_repository import SupabaseRepository
from app.config import SUPABASE_URL, SUPABASE_KEY

router = APIRouter()

# Dependency provider for LessonService
def get_lesson_service() -> LessonService:
    cache = MemoryCacheRepository()
    repo: ILessonRepository
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            repo = SupabaseRepository(SUPABASE_URL, SUPABASE_KEY)
        except Exception:
            repo = MemoryLessonRepository()
    else:
        repo = MemoryLessonRepository()
    return LessonService(cache_repository=cache, lesson_repository=repo)

@router.get("/")
async def get_lessons(service: LessonService = Depends(get_lesson_service), limit: int = Query(10, ge=1, le=50)) -> List[str]:
    """Get popular lesson topics (simple list)."""
    topics = await service.get_popular_topics(limit)
    return topics

@router.get("/{lesson_id}")
async def get_lesson(lesson_id: str, service: LessonService = Depends(get_lesson_service)):
    """Get a specific lesson by ID."""
    lesson = await service.get_lesson_detail(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson

@router.get("/{lesson_id}/quiz")
async def get_lesson_quiz(lesson_id: str, service: LessonService = Depends(get_lesson_service)):
    """Get quiz data for a specific lesson by ID."""
    lesson = await service.get_lesson_detail(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Extract quiz data from the lesson
    quiz_data = lesson.get("quiz", [])
    
    # If no quiz data, return empty array
    if not quiz_data:
        return []
    
    return quiz_data
