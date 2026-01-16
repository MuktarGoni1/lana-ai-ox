import redis
from bullmq import Queue, Worker
from app.settings import Settings, load_settings
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Global queue instances
lesson_queue = None
tts_queue = None
redis_connection = None

def init_queues():
    """Initialize Redis connection and job queues."""
    global lesson_queue, tts_queue, redis_connection
    
    try:
        settings = load_settings()
        
        # Parse redis_url to extract connection parameters
        redis_options = {}
        if settings.redis_url:
            parsed = urlparse(settings.redis_url)
            redis_options["host"] = parsed.hostname or "localhost"
            redis_options["port"] = parsed.port or 6379
            redis_options["db"] = int(parsed.path.lstrip('/')) if parsed.path else 0
            if parsed.username:
                redis_options["username"] = parsed.username
            if parsed.password:
                redis_options["password"] = parsed.password
        else:
            # Fallback to individual settings if redis_url is not provided
            redis_options = {
                "host": getattr(settings, 'redis_host', 'localhost'),
                "port": getattr(settings, 'redis_port', 6379),
                "db": getattr(settings, 'redis_db', 0),
            }
            if hasattr(settings, 'redis_password') and settings.redis_password:
                redis_options["password"] = settings.redis_password
        
        redis_connection = redis.Redis(**redis_options)
        
        # Create queues
        lesson_queue = Queue("lesson-generation", redis_connection)
        tts_queue = Queue("tts-generation", redis_connection)
        
        logger.info("Job queues initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize job queues: {e}")
        raise


def get_lesson_queue():
    """Get the lesson generation queue."""
    global lesson_queue
    if lesson_queue is None:
        init_queues()
    return lesson_queue

def get_tts_queue():
    """Get the TTS generation queue."""
    global tts_queue
    if tts_queue is None:
        init_queues()
    return tts_queue

def get_redis_connection():
    """Get the Redis connection."""
    global redis_connection
    if redis_connection is None:
        init_queues()
    return redis_connection