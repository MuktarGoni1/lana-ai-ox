import asyncio
import logging
from typing import Dict, Any
from bullmq import Job
from app.services.lesson_service import LessonService
from app.services.tts_service import TTSService
from app.repositories.memory_lesson_repository import MemoryLessonRepository
from app.repositories.memory_cache_repository import MemoryCacheRepository

logger = logging.getLogger(__name__)

# Global service instances (initialized on first use)
lesson_service = None
tts_service = None

def init_services():
    """Initialize services for job processing."""
    global lesson_service, tts_service
    
    if lesson_service is None or tts_service is None:
        # Initialize repositories
        cache_repo = MemoryCacheRepository()
        lesson_repo = MemoryLessonRepository()
        
        # Initialize services
        lesson_service = LessonService(cache_repo, lesson_repo)
        tts_service = TTSService(cache_repo)

async def process_lesson_job(job: Job, token: str) -> Dict[str, Any]:
    """Process a lesson generation job."""
    try:
        init_services()
        
        job_data = job.data
        user_id = job_data.get("user_id")
        topic = job_data.get("topic")
        difficulty = job_data.get("difficulty", "intermediate")
        lesson_type = job_data.get("lesson_type", "standard")
        
        logger.info(f"Processing lesson job for user {user_id}, topic: {topic}")
        
        # Generate the lesson
        lesson = await lesson_service.get_or_create_lesson(
            user_id=user_id,
            topic=topic,
            difficulty=difficulty,
            lesson_type=lesson_type,
            refresh_cache=True  # Force generation for jobs
        )
        
        logger.info(f"Lesson generation completed for user {user_id}")
        
        return {
            "status": "completed",
            "lesson": lesson
        }
        
    except Exception as e:
        logger.error(f"Lesson job failed: {e}")
        raise

async def process_tts_job(job: Job, token: str) -> Dict[str, Any]:
    """Process a TTS generation job."""
    try:
        init_services()
        
        job_data = job.data
        text = job_data.get("text")
        voice_name = job_data.get("voice_name", "leda")
        
        logger.info(f"Processing TTS job for text: {text[:50]}...")
        
        # Generate speech
        audio_data = await tts_service.generate_speech(text, voice_name)
        
        logger.info("TTS generation completed")
        
        return {
            "status": "completed",
            "audio_data": audio_data.hex()  # Convert bytes to hex for JSON serialization
        }
        
    except Exception as e:
        logger.error(f"TTS job failed: {e}")
        raise

# Worker processors
async def lesson_worker_processor(job: Job, token: str):
    """Worker processor for lesson generation jobs."""
    result = await process_lesson_job(job, token)
    return result

async def tts_worker_processor(job: Job, token: str):
    """Worker processor for TTS generation jobs."""
    result = await process_tts_job(job, token)
    return result