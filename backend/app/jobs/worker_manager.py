import asyncio
import logging
from bullmq import Worker
from app.jobs.queue_config import get_lesson_queue, get_tts_queue, get_redis_connection
from app.jobs.job_processors import lesson_worker_processor, tts_worker_processor

logger = logging.getLogger(__name__)

class WorkerManager:
    """Manages BullMQ workers for processing jobs."""
    
    def __init__(self):
        self.lesson_worker = None
        self.tts_worker = None
        self.running = False
        
    async def start_workers(self):
        """Start all job workers."""
        if self.running:
            logger.warning("Workers are already running")
            return
            
        try:
            redis_connection = get_redis_connection()
            
            # Create and start lesson worker
            self.lesson_worker = Worker(
                "lesson-generation",
                lesson_worker_processor,
                {"connection": redis_connection}
            )
            
            # Create and start TTS worker
            self.tts_worker = Worker(
                "tts-generation",
                tts_worker_processor,
                {"connection": redis_connection}
            )
            
            self.running = True
            logger.info("Job workers started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start workers: {e}")
            raise
            
    async def stop_workers(self):
        """Stop all job workers."""
        if not self.running:
            logger.warning("Workers are not running")
            return
            
        try:
            if self.lesson_worker:
                await self.lesson_worker.close()
                
            if self.tts_worker:
                await self.tts_worker.close()
                
            self.running = False
            logger.info("Job workers stopped successfully")
            
        except Exception as e:
            logger.error(f"Error stopping workers: {e}")
            raise
            
    async def __aenter__(self):
        await self.start_workers()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop_workers()

# Global worker manager instance
worker_manager = WorkerManager()

async def start_job_workers():
    """Start the job workers."""
    await worker_manager.start_workers()
    
async def stop_job_workers():
    """Stop the job workers."""
    await worker_manager.stop_workers()