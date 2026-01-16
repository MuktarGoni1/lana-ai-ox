"""
Main API router that includes all route modules.
"""
from fastapi import APIRouter
from .routes import lessons, math_solver, tts, history, jobs, chat, quick_mode

# Create main API router
api_router = APIRouter()

# Include all route modules
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
api_router.include_router(math_solver.router, prefix="/math-solver", tags=["math-solver"])
api_router.include_router(tts.router, prefix="/tts", tags=["tts"])
api_router.include_router(history.router, tags=["history"])
api_router.include_router(jobs.router, tags=["jobs"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(quick_mode.router, prefix="/quick", tags=["quick-mode"])