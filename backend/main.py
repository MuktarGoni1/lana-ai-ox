# backend/main.py
import os
import logging
import asyncio
from typing import List, Dict, Any, Optional
from functools import lru_cache
import hashlib

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Request, status
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware  # NEW: compression
from fastapi.responses import JSONResponse, StreamingResponse, ORJSONResponse  # NEW: faster JSON
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel, Field, validator, root_validator
import re
import html
from groq import AsyncGroq  # CHANGED: async client
from dotenv import load_dotenv
from google import genai
from google.genai import types
import io
import wave
from supabase import create_client, Client
import orjson  # NEW: faster JSON parsing
from cachetools import TTLCache  # NEW: caching
import httpx  # NEW: better async HTTP
from sympy import sympify, Eq, solve, simplify  # NEW: math solving

# Import async Supabase client
from async_supabase import get_async_supabase, cleanup_async_supabase

logging.getLogger("asyncio").setLevel(logging.ERROR)

# ---------- env ----------
load_dotenv()
GROQ_API_KEY   = os.getenv("GROQ_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
SUPABASE_URL   = os.getenv("SUPABASE_URL")
SUPABASE_KEY   = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not (GROQ_API_KEY and GOOGLE_API_KEY and SUPABASE_URL and SUPABASE_KEY):
    raise RuntimeError("Missing required env vars")

# Environment-driven logging level
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
_level = getattr(logging, LOG_LEVEL, logging.INFO)
logging.basicConfig(level=_level)

# ---------- Optimized clients with connection pooling ----------
groq_client = AsyncGroq(
    api_key=GROQ_API_KEY,
    http_client=httpx.AsyncClient(
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        timeout=30.0
    )
)
gemini_client = genai.Client(api_key=GOOGLE_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------- Enhanced Cache setup with intelligent TTL and warming ----------
# Redis-based distributed caching
from aiocache import Cache
from aiocache.serializers import PickleSerializer
import time

# Cache configuration with optimized TTL strategies
CACHE_CONFIG = {
    "lessons": {"ttl": 7200, "max_size": 1000},      # 2 hours for lessons
    "tts": {"ttl": 3600, "max_size": 500},           # 1 hour for TTS
    "history": {"ttl": 300, "max_size": 100},        # 5 minutes for history
    "popular": {"ttl": 86400, "max_size": 50},       # 24 hours for popular topics
    "math": {"ttl": 1800, "max_size": 200},          # 30 minutes for math solutions
}

# Cache hit/miss statistics for monitoring
cache_stats = {
    "hits": 0,
    "misses": 0,
    "errors": 0,
    "last_reset": time.time()
}

# Fallback to in-memory cache if Redis is not available
try:
    redis_cache = Cache(Cache.REDIS, 
                      endpoint="localhost", 
                      port=6379,
                      namespace="lana_ai",
                      serializer=PickleSerializer(),
                      timeout=2)
    
    # ✅ Don't test connection here - test during first use
    logging.info("✅ Redis cache configured (connection will be tested on first use)")
    
    # Enhanced cache functions with statistics and intelligent TTL
    async def get_cache(key, namespace="lessons"):
        try:
            full_key = f"{namespace}:{key}"
            result = await redis_cache.get(full_key)
            if result is not None:
                cache_stats["hits"] += 1
                logging.debug(f"✅ Cache hit: {namespace}:{key[:16]}...")
            else:
                cache_stats["misses"] += 1
                logging.debug(f"❌ Cache miss: {namespace}:{key[:16]}...")
            return result
        except Exception as e:
            cache_stats["errors"] += 1
            logging.warning(f"Redis get failed, using fallback: {e}")
            return None
            
    async def set_cache(key, value, ttl=None, namespace="lessons"):
        try:
            # Use intelligent TTL based on namespace
            if ttl is None:
                ttl = CACHE_CONFIG.get(namespace, {"ttl": 7200})["ttl"]
            
            full_key = f"{namespace}:{key}"
            await redis_cache.set(full_key, value, ttl=ttl)
            logging.debug(f"💾 Cached: {namespace}:{key[:16]}... (TTL: {ttl}s)")
            return True
        except Exception as e:
            cache_stats["errors"] += 1
            logging.warning(f"Redis set failed, using fallback: {e}")
            return False
    
    async def warm_cache(namespace, keys_values):
        """Warm cache with multiple key-value pairs"""
        try:
            ttl = CACHE_CONFIG.get(namespace, {"ttl": 7200})["ttl"]
            for key, value in keys_values.items():
                full_key = f"{namespace}:{key}"
                await redis_cache.set(full_key, value, ttl=ttl)
            logging.info(f"🔥 Warmed {len(keys_values)} items in {namespace} cache")
            return True
        except Exception as e:
            logging.warning(f"Cache warming failed: {e}")
            return False
            
    async def get_cache_stats():
        """Get cache performance statistics"""
        total_requests = cache_stats["hits"] + cache_stats["misses"]
        hit_rate = (cache_stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        return {
            "hit_rate": f"{hit_rate:.1f}%",
            "total_requests": total_requests,
            "errors": cache_stats["errors"],
            "uptime": time.time() - cache_stats["last_reset"]
        }
            
except Exception as e:
    logging.warning(f"⚠️ Redis not available, using in-memory cache: {e}")
    # Enhanced fallback to in-memory cache with TTL
    from cachetools import TTLCache
    
    # Create separate caches for different namespaces
    caches = {
        namespace: TTLCache(
            maxsize=config["max_size"], 
            ttl=config["ttl"]
        ) for namespace, config in CACHE_CONFIG.items()
    }
    
    async def get_cache(key, namespace="lessons"):
        cache = caches.get(namespace)
        if cache:
            result = cache.get(key)
            if result is not None:
                cache_stats["hits"] += 1
            else:
                cache_stats["misses"] += 1
            return result
        return None
        
    async def set_cache(key, value, ttl=None, namespace="lessons"):
        cache = caches.get(namespace)
        if cache:
            cache[key] = value
            return True
        return False
    
    async def warm_cache(namespace, keys_values):
        cache = caches.get(namespace)
        if cache:
            for key, value in keys_values.items():
                cache[key] = value
            return True
        return False
        
    async def get_cache_stats():
        total_requests = cache_stats["hits"] + cache_stats["misses"]
        hit_rate = (cache_stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        return {
            "hit_rate": f"{hit_rate:.1f}%",
            "total_requests": total_requests,
            "errors": cache_stats["errors"],
            "uptime": time.time() - cache_stats["last_reset"]
        }

# Permanent cache for common topics (always in memory for fastest access)
precomputed_cache = {}

# ---------- Rate Limiting Implementation ----------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses
    """
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Content Security Policy
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "media-src 'self'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "frame-ancestors 'none'; "
            "upgrade-insecure-requests"
        )
        response.headers["Content-Security-Policy"] = csp_policy
        
        # HSTS (HTTP Strict Transport Security) - only for HTTPS
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Cache control for API responses
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Advanced rate limiting middleware with Redis backend and fallback to in-memory"""
    
    def __init__(self, app, calls_per_minute: int = 60, calls_per_hour: int = 1000):
        super().__init__(app)
        self.calls_per_minute = calls_per_minute
        self.calls_per_hour = calls_per_hour
        
        # Rate limit configurations per endpoint
        is_prod = os.getenv("NODE_ENV", "development").lower() == "production"
        self.endpoint_limits = (
            {
                "/api/structured-lesson": {"per_minute": 20, "per_hour": 300},
                "/api/structured-lesson/stream": {"per_minute": 20, "per_hour": 300},
                "/api/tts": {"per_minute": 15, "per_hour": 150},
                "/api/solve-math": {"per_minute": 30, "per_hour": 400},
                "/api/social": {"per_minute": 50, "per_hour": 500},
            }
            if is_prod
            else
            {
                "/api/structured-lesson": {"per_minute": 30, "per_hour": 500},
                "/api/structured-lesson/stream": {"per_minute": 30, "per_hour": 500},
                "/api/tts": {"per_minute": 20, "per_hour": 200},
                "/api/solve-math": {"per_minute": 40, "per_hour": 600},
                "/api/social": {"per_minute": 100, "per_hour": 1000},
            }
        )
        
        # In-memory fallback for rate limiting
        self.memory_store = {}
        self.cleanup_interval = 300  # Clean up old entries every 5 minutes
        self.last_cleanup = time.time()
    
    async def get_client_ip(self, request: Request) -> str:
        """Extract client IP with proxy support"""
        # Check for forwarded headers (common in production)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct client IP
        return request.client.host if request.client else "unknown"
    
    async def check_rate_limit_redis(self, key: str, limit: int, window: int) -> tuple[bool, int]:
        """Check rate limit using Redis with sliding window"""
        try:
            current_time = int(time.time())
            window_start = current_time - window
            
            # Use Redis pipeline for atomic operations
            pipe = redis_cache._client.pipeline()
            
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current requests
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(current_time): current_time})
            
            # Set expiration
            pipe.expire(key, window)
            
            results = await pipe.execute()
            current_count = results[1]
            
            return current_count < limit, current_count
            
        except Exception as e:
            logging.warning(f"Redis rate limit check failed: {e}")
            return await self.check_rate_limit_memory(key, limit, window)
    
    async def check_rate_limit_memory(self, key: str, limit: int, window: int) -> tuple[bool, int]:
        """Fallback in-memory rate limiting"""
        current_time = time.time()
        
        # Cleanup old entries periodically
        if current_time - self.last_cleanup > self.cleanup_interval:
            await self.cleanup_memory_store()
            self.last_cleanup = current_time
        
        if key not in self.memory_store:
            self.memory_store[key] = []
        
        # Remove old entries
        window_start = current_time - window
        self.memory_store[key] = [
            timestamp for timestamp in self.memory_store[key] 
            if timestamp > window_start
        ]
        
        current_count = len(self.memory_store[key])
        
        if current_count < limit:
            self.memory_store[key].append(current_time)
            return True, current_count + 1
        
        return False, current_count
    
    async def cleanup_memory_store(self):
        """Clean up old entries from memory store"""
        current_time = time.time()
        keys_to_remove = []
        
        for key, timestamps in self.memory_store.items():
            # Remove entries older than 1 hour
            self.memory_store[key] = [
                timestamp for timestamp in timestamps 
                if current_time - timestamp < 3600
            ]
            
            # Remove empty keys
            if not self.memory_store[key]:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.memory_store[key]
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and static files
        if request.url.path in ["/health", "/api/health", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        client_ip = await self.get_client_ip(request)
        endpoint = request.url.path
        
        # Get endpoint-specific limits or use defaults
        limits = self.endpoint_limits.get(endpoint, {
            "per_minute": self.calls_per_minute,
            "per_hour": self.calls_per_hour
        })
        
        # Check minute and hour limits
        minute_key = f"rate_limit:{client_ip}:{endpoint}:minute:{int(time.time() // 60)}"
        hour_key = f"rate_limit:{client_ip}:{endpoint}:hour:{int(time.time() // 3600)}"
        
        try:
            # Check Redis first, fallback to memory
            if 'redis_cache' in globals():
                minute_ok, minute_count = await self.check_rate_limit_redis(
                    minute_key, limits["per_minute"], 60
                )
                hour_ok, hour_count = await self.check_rate_limit_redis(
                    hour_key, limits["per_hour"], 3600
                )
            else:
                minute_ok, minute_count = await self.check_rate_limit_memory(
                    minute_key, limits["per_minute"], 60
                )
                hour_ok, hour_count = await self.check_rate_limit_memory(
                    hour_key, limits["per_hour"], 3600
                )
            
            if not minute_ok:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "Rate limit exceeded",
                        "message": f"Too many requests per minute. Limit: {limits['per_minute']}/min",
                        "retry_after": 60
                    },
                    headers={
                        "Retry-After": "60",
                        "X-RateLimit-Limit": str(limits["per_minute"]),
                        "X-RateLimit-Remaining": str(max(0, limits["per_minute"] - minute_count)),
                        "X-RateLimit-Reset": str(int(time.time()) + 60)
                    }
                )
            
            if not hour_ok:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "Rate limit exceeded",
                        "message": f"Too many requests per hour. Limit: {limits['per_hour']}/hour",
                        "retry_after": 3600
                    },
                    headers={
                        "Retry-After": "3600",
                        "X-RateLimit-Limit": str(limits["per_hour"]),
                        "X-RateLimit-Remaining": str(max(0, limits["per_hour"] - hour_count)),
                        "X-RateLimit-Reset": str(int(time.time()) + 3600)
                    }
                )
            
            # Add rate limit headers to successful responses
            response = await call_next(request)
            
            response.headers["X-RateLimit-Limit-Minute"] = str(limits["per_minute"])
            response.headers["X-RateLimit-Remaining-Minute"] = str(max(0, limits["per_minute"] - minute_count))
            response.headers["X-RateLimit-Limit-Hour"] = str(limits["per_hour"])
            response.headers["X-RateLimit-Remaining-Hour"] = str(max(0, limits["per_hour"] - hour_count))
            
            return response
            
        except Exception as e:
            logging.error(f"Rate limiting error: {e}")
            # On error, allow the request to proceed
            return await call_next(request)

# Precompute popular topics for instant responses
POPULAR_TOPICS = [
    "python programming", "machine learning", "data science", "javascript", 
    "react", "artificial intelligence", "web development", "algorithms",
    "database design", "cybersecurity", "cloud computing", "blockchain"
]

async def precompute_popular_topics():
    """Precompute responses for popular topics with cache warming"""
    warm_data = {}
    
    for topic in POPULAR_TOPICS:
        cache_key = get_cache_key(topic)
        
        # Check if already cached
        cached = await get_cache(cache_key, namespace="popular")
        if cached:
            continue
            
        try:
            # Generate response
            res = await groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Topic: {topic}"}
                ],
                temperature=0.2,
                max_tokens=800,
                top_p=0.8,
                stream=False,
            )
            
            content = res.choices[0].message.content
            if content:
                # Process and validate JSON content
                processed_data = await process_lesson_content(content, topic)
                if processed_data:
                    warm_data[cache_key] = processed_data
                    precomputed_cache[topic.lower()] = processed_data
                    logging.info(f"✅ Precomputed topic: {topic}")
                    
        except Exception as e:
            logging.warning(f"Failed to precompute {topic}: {e}")
            # Create fallback data structure
            fallback_data = create_fallback_lesson(topic)
            warm_data[cache_key] = fallback_data
            precomputed_cache[topic.lower()] = fallback_data
    
    # Warm cache with all precomputed data
    if warm_data:
        await warm_cache("popular", warm_data)
        logging.info(f"🔥 Cache warmed with {len(warm_data)} popular topics")

async def process_lesson_content(content: str, topic: str) -> Optional[Dict[str, Any]]:
    """Process and validate lesson content with better error handling"""
    try:
        # Clean and extract JSON from content
        content = content.strip()
        
        # Find JSON block if wrapped in markdown
        if '```json' in content:
            start = content.find('```json') + 7
            end = content.find('```', start)
            if end != -1:
                content = content[start:end].strip()
        elif '```' in content:
            start = content.find('```') + 3
            end = content.find('```', start)
            if end != -1:
                content = content[start:end].strip()
        
        # Try to find JSON object boundaries
        if not (content.startswith('{') and content.endswith('}')):
            # Look for the first { and last }
            start_idx = content.find('{')
            end_idx = content.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                content = content[start_idx:end_idx + 1]
        
        # Remove any leading/trailing non-JSON characters
        if content.startswith('{') and content.endswith('}'):
            try:
                data = orjson.loads(content)
                return data
            except orjson.JSONDecodeError as e:
                logging.warning(f"JSON parse error for {topic}: {e}")
                # Try to fix common JSON issues
                import re
                
                # Remove control characters that cause JSON parsing issues
                content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)
                
                # Fix common escape sequence issues
                content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                
                # Remove trailing commas before closing braces/brackets
                content = re.sub(r',(\s*[}\]])', r'\1', content)
                
                try:
                    data = orjson.loads(content)
                    return data
                except orjson.JSONDecodeError as e2:
                    logging.error(f"Failed to parse JSON for {topic} after cleanup: {e2}")
                    return None
        return None
    except Exception as e:
        logging.error(f"Content processing error for {topic}: {e}")
        return None

def create_fallback_lesson(topic: str) -> Dict[str, Any]:
    """Create fallback lesson structure for failed generations"""
    return {
        "introduction": {"definition": f"Learn about {topic}"},
        "sections": [{"title": f"Introduction to {topic}", "content": f"This covers the basics of {topic}."}],
        "classifications": [],
        "quiz_questions": [{"question": f"What is {topic}?", "options": ["A) A concept", "B) A skill", "C) Both"], "correct_answer": "C) Both"}]
    }

def clean_and_extract_json(content: str) -> str:
    """Clean and extract JSON from content"""
    # Clean and extract JSON from content
    content = content.strip()
    
    # Find JSON block if wrapped in markdown
    if '```json' in content:
        start = content.find('```json') + 7
        end = content.find('```', start)
        if end != -1:
            content = content[start:end].strip()
    elif '```' in content:
        start = content.find('```') + 3
        end = content.find('```', start)
        if end != -1:
            content = content[start:end].strip()
    
    # Try to find JSON object boundaries
    if not (content.startswith('{') and content.endswith('}')):
        # Look for the first { and last }
        start_idx = content.find('{')
        end_idx = content.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            content = content[start_idx:end_idx + 1]
    
    # Remove any leading/trailing non-JSON characters
    if content.startswith('{') and content.endswith('}'):
        return content
    
    return content

def parse_lesson_content(content: str, topic: str) -> Dict[str, Any]:
    """Parse lesson content with error handling"""
    try:
        data = orjson.loads(content)
    except orjson.JSONDecodeError as e:
        logging.warning(f"JSON parse error for {topic}: {e}")
        # Try to fix common JSON issues
        import re
        
        # Remove control characters that cause JSON parsing issues
        content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)
        
        # Fix common escape sequence issues
        content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
        
        # Remove trailing commas before closing braces/brackets
        content = re.sub(r',(\s*[}\]])', r'\1', content)
        
        try:
            data = orjson.loads(content)
        except orjson.JSONDecodeError as e2:
            logging.error(f"Failed to parse JSON for {topic} after cleanup: {e2}")
            logging.error(f"Problematic content: {content[:200]}...")
            # Create fallback data structure
            data = create_fallback_lesson(topic)
    
    return data

# ---------- Cache Management Functions ----------
async def get_cached_lesson(cache_key: str, topic: str) -> Optional[Dict[str, Any]]:
    """Get cached lesson with fallback handling"""
    cached = await get_cache(cache_key, namespace="lessons")
    if cached:
        return cached
    
    # Check precomputed cache
    topic_key = topic.lower().strip()
    if topic_key in precomputed_cache:
        content = precomputed_cache[topic_key]
        content = clean_and_extract_json(content)
        data = parse_lesson_content(content, topic)
        
        # Simple lesson structure for precomputed cache
        lesson = {
            "introduction": data.get("introduction", {}).get("definition", f"Learn about {topic}"),
            "classifications": data.get("classifications", []),
            "sections": data.get("sections", []),
            "diagram": data.get("diagram_description", ""),
            "quiz": data.get("quiz", [])
        }
        
        return lesson
    
    return None

# ---------- fastapi with optimizations ----------
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize precomputed cache on startup"""
    logging.info("🚀 Starting precomputation of popular topics...")
    await precompute_popular_topics()
    logging.info("✅ Precomputation complete!")
    
    try:
        # Warm up Groq client (async call)
        await groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=1,
            stream=False
        )
        logging.info("✅ Groq client warmed up")
    except Exception as e:
        logging.warning(f"⚠️ Groq warmup failed: {e}")
    
    yield
    
    logging.info("🔄 Shutting down...")

app = FastAPI(
    title="Lana AI Backend", 
    version="3.0.0",
    default_response_class=ORJSONResponse,  # Faster JSON serialization
    lifespan=lifespan
)

# ---------- Global Exception Handlers ----------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with secure, user-friendly messages"""
    logging.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    
    # Create user-friendly error messages without exposing internal details
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        msg = error["msg"]
        
        # Sanitize error messages to avoid information leakage
        if "value_error" in error["type"]:
            msg = "Invalid input format"
        elif "missing" in error["type"]:
            msg = f"Required field '{field}' is missing"
        elif "type_error" in error["type"]:
            msg = f"Invalid data type for field '{field}'"
        
        errors.append({"field": field, "message": msg})
    
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "message": "The request contains invalid data",
            "details": errors,
            "request_id": id(request)
        }
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with secure error messages"""
    logging.warning(f"HTTP exception on {request.url.path}: {exc.status_code} - {exc.detail}")
    
    # Sanitize error messages for production
    detail = exc.detail
    if exc.status_code == 500:
        detail = "Internal server error occurred"
    elif exc.status_code == 404:
        detail = "Resource not found"
    elif exc.status_code == 403:
        detail = "Access forbidden"
    elif exc.status_code == 401:
        detail = "Authentication required"
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": f"HTTP {exc.status_code}",
            "message": detail,
            "request_id": id(request)
        }
    )

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle ValueError exceptions from validation functions"""
    logging.warning(f"Value error on {request.url.path}: {str(exc)}")
    
    return JSONResponse(
        status_code=400,
        content={
            "error": "Invalid Input",
            "message": str(exc),
            "request_id": id(request)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions with secure error messages"""
    logging.exception(f"Unhandled exception on {request.url.path}: {type(exc).__name__}")
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Please try again later.",
            "request_id": id(request)
        }
    )

# Middleware order matters - compression should be first
app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=6)  # Optimized compression

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add rate limiting middleware
app.add_middleware(RateLimitMiddleware, calls_per_minute=60, calls_per_hour=1000)

# Configure CORS using environment variable ALLOWED_ORIGINS (comma-separated)
# In development, include the machine's LAN IP to allow access over the network
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
is_prod_env = os.getenv("NODE_ENV", "development").lower() == "production"

if allowed_origins_env:
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    # Base defaults for local development
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]
    # Add LAN IP variants in non-production to support access via network IP
    if not is_prod_env:
        try:
            import socket
            local_ip = socket.gethostbyname(socket.gethostname())
            if local_ip and local_ip not in ["127.0.0.1", "0.0.0.0"]:
                allowed_origins.extend([
                    f"http://{local_ip}:3000",
                    f"http://{local_ip}:3001",
                ])
        except Exception:
            # If IP detection fails, proceed with localhost defaults
            pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Requested-With",
        "X-Real-IP",
        "X-Forwarded-For",
    ],
)

# ---------- models (unchanged) ----------
# ---------- Input Sanitization Functions ----------
def sanitize_text(text: str) -> str:
    """Sanitize text input to prevent XSS and other security vulnerabilities"""
    if not text:
        return ""
    
    # HTML escape to prevent XSS
    text = html.escape(text)
    
    # Remove potentially dangerous characters
    text = re.sub(r'[<>"\'\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def validate_topic(topic: str) -> str:
    """Validate and sanitize topic input"""
    if not topic or not topic.strip():
        raise ValueError("Topic cannot be empty")
    
    topic = sanitize_text(topic.strip())
    
    # Check for minimum meaningful length
    if len(topic) < 2:
        raise ValueError("Topic must be at least 2 characters long")
    
    # Check for maximum length
    if len(topic) > 300:
        raise ValueError("Topic must be less than 300 characters")
    
    # Prevent common injection patterns
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'data:text/html',
        r'vbscript:',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, topic, re.IGNORECASE):
            raise ValueError("Topic contains potentially dangerous content")
    
    return topic

def validate_math_question(question: str) -> str:
    """Validate and sanitize math question input"""
    if not question or not question.strip():
        raise ValueError("Math question cannot be empty")
    
    question = sanitize_text(question.strip())
    
    # Check length limits
    if len(question) < 1:
        raise ValueError("Math question must not be empty")
    if len(question) > 1000:
        raise ValueError("Math question must be less than 1000 characters")
    
    # Allow mathematical symbols and operations
    allowed_pattern = r'^[a-zA-Z0-9\s\+\-\*\/\=\(\)\.\,\^\{\}\[\]\\]+$'
    if not re.match(allowed_pattern, question):
        raise ValueError("Math question contains invalid characters")
    
    return question

def validate_tts_text(text: str) -> str:
    """Validate and sanitize TTS text input"""
    if not text or not text.strip():
        raise ValueError("TTS text cannot be empty")
    
    text = sanitize_text(text.strip())
    
    # Check length limits (TTS has practical limits)
    if len(text) < 1:
        raise ValueError("TTS text must not be empty")
    if len(text) > 5000:
        raise ValueError("TTS text must be less than 5000 characters for optimal performance")
    
    # Remove excessive repetition that could cause TTS issues
    text = re.sub(r'(.)\1{10,}', r'\1\1\1', text)  # Limit character repetition
    
    return text

# ---------- Enhanced Pydantic Models with Comprehensive Validation ----------
class QuizItem(BaseModel):
    q: str = Field(..., min_length=5, max_length=500, description="Quiz question")
    options: List[str] = Field(..., min_items=2, max_items=6, description="Answer options")
    answer: str = Field(..., min_length=1, max_length=200, description="Correct answer")
    
    @validator('q')
    def validate_question(cls, v):
        return sanitize_text(v)
    
    @validator('options')
    def validate_options(cls, v):
        if not v or len(v) < 2:
            raise ValueError("Must have at least 2 options")
        return [sanitize_text(option) for option in v if option.strip()]
    
    @validator('answer')
    def validate_answer(cls, v):
        return sanitize_text(v)

class ClassificationItem(BaseModel):
    type: str = Field(..., min_length=1, max_length=100, description="Classification type")
    description: str = Field(..., min_length=1, max_length=500, description="Classification description")
    
    @validator('type', 'description')
    def sanitize_fields(cls, v):
        return sanitize_text(v)

class SectionItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Section title")
    content: str = Field(..., min_length=10, max_length=5000, description="Section content")
    
    @validator('title', 'content')
    def sanitize_fields(cls, v):
        return sanitize_text(v)

class StructuredLessonRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=300, description="Learning topic")
    age: Optional[int] = Field(None, ge=5, le=100, description="User's age for age-appropriate content")
    
    @validator('topic')
    def validate_topic_field(cls, v):
        return validate_topic(v)
    
    @validator('age')
    def validate_age_field(cls, v):
        if v is not None and (v < 5 or v > 100):
            raise ValueError("Age must be between 5 and 100")
        return v

class StructuredLessonResponse(BaseModel):
    introduction: Optional[str] = Field(None, max_length=2000)
    classifications: List[ClassificationItem] = Field(default_factory=list, max_items=10)
    sections: List[SectionItem] = Field(..., min_items=1, max_items=20)
    diagram: str = Field("", max_length=2000)
    quiz: List[QuizItem] = Field(..., min_items=1, max_items=10)
    
    @validator('introduction', 'diagram')
    def sanitize_text_fields(cls, v):
        return sanitize_text(v) if v else v

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to convert to speech")
    sid: str = Field("", max_length=100, description="Session ID")
    
    @validator('text')
    def validate_tts_text_field(cls, v):
        return validate_tts_text(v)
    
    @validator('sid')
    def validate_session_id(cls, v):
        if v:
            # Session ID should only contain alphanumeric characters and hyphens
            if not re.match(r'^[a-zA-Z0-9\-_]{0,100}$', v):
                raise ValueError("Invalid session ID format")
        return sanitize_text(v)

# Math solver models with enhanced validation
class MathStep(BaseModel):
    explanation: str = Field(..., min_length=1, max_length=1000, description="Step explanation")
    expression: str = Field("", max_length=500, description="Mathematical expression")
    result: str = Field("", max_length=500, description="Step result")
    
    @validator('explanation', 'expression', 'result')
    def sanitize_fields(cls, v):
        return sanitize_text(v)

class MathSolutionResponse(BaseModel):
    final_answer: str = Field(..., min_length=1, max_length=1000)
    steps: List[MathStep] = Field(default_factory=list, max_items=50)
    
    @validator('final_answer')
    def sanitize_answer(cls, v):
        return sanitize_text(v)

class MathProblemRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000, description="Mathematical problem to solve")
    
    @validator('question')
    def validate_math_question_field(cls, v):
        return validate_math_question(v)

# ---------- constants ----------
SOCIAL_REPLY = "Hey dear! 👋 I'm Lana — what would you like to learn today?"

# ---------- Optimized system prompt ----------
SYSTEM_PROMPT = """\
Generate JSON lesson for topic. Structure:
{
  "introduction": {"definition": "Brief definition", "relevance": "Why important"},
  "sections": [{"title": "Title", "content": "• Point 1\\n• Point 2\\n• Point 3"}],
  "classifications": [{"type": "Type", "description": "Description"}],
  "quiz_questions": [{"question": "Q?", "options": ["A) opt1", "B) opt2", "C) opt3", "D) opt4"], "correct_answer": "B) opt2"}]
}
Rules: 3 sections, 3-5 bullets each, 4 quiz questions, plain text, <600 tokens. Adapt content for age @age years.
Section order: 1) Introduction, 2) Classifications/Types (if applicable), 3) Detailed sections, 4) Importance/Applications. Place classifications early to establish context before diving into details."""

# Math solver system prompt
MATH_SYSTEM_PROMPT = """\
Return strictly JSON in this shape:
{
  "steps": [
    {"explanation": "", "expression": "", "result": ""}
  ],
  "final_answer": ""
}
Rules:
- Show clear, correct, minimal steps.
- Prefer numeric computations and exact forms where appropriate.
- Keep expressions parseable; avoid prose in fields.
- If word problem: define variables, set up equation(s), solve, and verify.
- Output only valid JSON (no markdown, no commentary)."""

# ---------- Helper functions ----------
# Smart cache key with fuzzy matching
@lru_cache(maxsize=100)  # Cache the cache key generation itself
def get_smart_cache_key(topic: str) -> str:
    """Generate cache key with fuzzy matching for similar topics"""
    topic_lower = topic.lower().strip()
    
    # Check for exact precomputed match
    if topic_lower in precomputed_cache:
        return f"precomputed:{topic_lower}"
    
    # Check for partial matches in popular topics (optimized)
    for popular in POPULAR_TOPICS:
        popular_lower = popular.lower()
        if popular_lower in topic_lower or topic_lower in popular_lower:
            if popular_lower in precomputed_cache:
                return f"precomputed:{popular_lower}"
    
    # Standard cache key with better hashing
    return f"topic:{hashlib.md5(topic_lower.encode()).hexdigest()[:16]}"  # Shorter hash

@lru_cache(maxsize=100)  # Cache this too
def get_cache_key(topic: str) -> str:
    """Generate cache key for a topic"""
    topic_clean = topic.lower().strip()
    return f"lesson:{hashlib.md5(topic_clean.encode()).hexdigest()[:16]}"  # Shorter hash

@lru_cache(maxsize=10)
def is_social_greeting(topic: str) -> bool:
    """Check if topic is a social greeting (cached)"""
    social_words = {
        "hello", "hi", "hey", "thank", "thanks",
        "good morning", "good afternoon", "good evening", "how are you"
    }
    return topic.lower().strip() in social_words

# ---------- Optimized history endpoint with async client ----------
@app.get("/history")
async def history(sid: str = Query(...), background_tasks: BackgroundTasks = None):
    cache_key = f"history_{sid}"
    
    # Check cache first using the proper cache function
    cached_result = await get_cache(cache_key, namespace="history")
    if cached_result:
        return cached_result
    
    try:
        # Use async Supabase client for better performance
        async_client = await get_async_supabase()
        searches = await async_client.select_searches(uid=sid, limit=50)
        
        result = [
            {
                "id": str(r["id"]),
                "title": r["title"],
                "timestamp": r["created_at"],
            }
            for r in searches
        ]
        
        # Cache the result using the proper cache function
        await set_cache(cache_key, result, ttl=300, namespace="history")  # 5 min cache
        return result
        
    except Exception as e:
        logging.exception("history error")
        raise HTTPException(status_code=500, detail=str(e))

# Explicit CORS-friendly preflight handler for history route
@app.options("/history")
async def history_options(request: Request):
    # Echo back the requesting origin for stricter CORS checks when credentials are involved
    origin = request.headers.get("Origin", "*")
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
        },
    )

# ---------- Social endpoint ----------
@app.post("/api/social")
async def social_chat():
    return {"reply": SOCIAL_REPLY}

# ---------- Optimized structured lesson endpoint ----------
@app.post("/api/structured-lesson", response_model=StructuredLessonResponse)
# function structured_lesson
async def structured_lesson(body: StructuredLessonRequest):
    """Generate structured lesson with enhanced caching"""
    topic = body.topic.strip()
    age = body.age
    
    # Check cache first
    cache_key = get_cache_key(topic)
    cached_result = await get_cache(cache_key, namespace="lessons")
    if cached_result:
        logging.info(f"📦 Cache hit for: {topic}")
        return cached_result
    
    # Handle social greetings
    if is_social_greeting(topic):
        response = StructuredLessonResponse(
            introduction=SOCIAL_REPLY,
            classifications=[],
            sections=[
                SectionItem(title="Friendly Note", content=SOCIAL_REPLY)
            ],
            diagram="No diagram needed for a friendly chat.",
            quiz=[{
                "q": "What would you like to learn next?",
                "options": ["A) Science", "B) History", "C) Anything"],
                "answer": "C) Anything"
            }]
        )
        await set_cache(cache_key, response, ttl=7200, namespace="lessons")
        return response

    try:
        # Create age-aware system prompt
        system_prompt = SYSTEM_PROMPT.replace("@age", str(age) if age else "general audience")
        
        # Optimized Groq call with better parameters
        res = await groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Topic: {topic}"}  # More direct
            ],
            temperature=0.3,  # Lower for more consistent output
            max_tokens=1200,  # Reduced for faster response
            top_p=0.9,       # Focus on high-probability tokens
            stream=False,
        )
        
        content = res.choices[0].message.content or ""
        content = content.strip()

        if '```json' in content:
            start = content.find('```json') + 7
            end = content.find('```', start)
            if end != -1:
                content = content[start:end].strip()
        elif '```' in content:
            start = content.find('```') + 3
            end = content.find('```', start)
            if end != -1:
                content = content[start:end].strip()

        if not (content.startswith('{') and content.endswith('}')):
            start_idx = content.find('{')
            end_idx = content.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                content = content[start_idx:end_idx + 1]

        try:
            data = orjson.loads(content)
        except orjson.JSONDecodeError:
            import re
            content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)
            content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
            content = re.sub(r',(\s*[}\]])', r'\1', content)
            try:
                data = orjson.loads(content)
            except orjson.JSONDecodeError:
                t = body.topic
                data = {
                    "introduction": {"definition": f"Learn about {t}", "relevance": ""},
                    "sections": [{"title": f"Introduction to {t}", "content": f"Overview of {t}."}],
                    "classifications": [],
                    "quiz": []
                }
    
        # Parallel processing of data with better error handling
        async def safe_process_sections():
            try:
                return await process_sections(data)
            except Exception as e:
                logging.warning(f"Section processing error: {e}")
                return []
        
        async def safe_process_quiz():
            try:
                return await process_quiz(data)
            except Exception as e:
                logging.warning(f"Quiz processing error: {e}")
                return []
        
        sections_task = asyncio.create_task(safe_process_sections())
        quiz_task = asyncio.create_task(safe_process_quiz())
        
        sections = await sections_task
        quiz = await quiz_task
        
        intro_str = None
        if "introduction" in data and isinstance(data["introduction"], dict):
            intro = data["introduction"]
            intro_str = f"{intro.get('definition', '')}\n{intro.get('relevance', '')}".strip()

        response = StructuredLessonResponse(
            introduction=intro_str,
            classifications=[
                ClassificationItem(type=c["type"], description=c["description"])
                for c in data.get("classifications", [])
                if isinstance(c, dict) and "type" in c and "description" in c
            ],
            sections=sections,
            diagram=data.get("diagram_description", ""),
            quiz=quiz
        )
        
        # Cache the response
        await set_cache(cache_key, response, ttl=7200, namespace="lessons")
        logging.info(f"💾 Cached lesson for: {topic}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logging.exception("structured-lesson error")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Helper async functions ----------
async def process_sections(data: dict) -> List[SectionItem]:
    """Process sections in parallel"""
    sections = []
    for sec in data.get("sections", []):
        if isinstance(sec, dict) and "title" in sec and "content" in sec:
            sections.append(SectionItem(title=sec["title"], content=sec["content"]))
    
    # Classifications are handled separately in the frontend, no need to add as section
    
    if data.get("diagram_description"):
        sections.append(SectionItem(title="Diagram Description", content=data["diagram_description"]))
    
    return sections

async def process_quiz(data: dict) -> List[dict]:
    """Process quiz questions"""
    return [
        {
            "q": q["question"],
            "options": q["options"],
            "answer": q["correct_answer"]
        }
        for q in data.get("quiz_questions", [])
        if isinstance(q, dict) and all(k in q for k in ("question", "options", "correct_answer"))
    ]

# ---------- ULTRA-FAST streaming endpoint ----------
@app.post("/api/structured-lesson/stream")
async def structured_lesson_stream(body: StructuredLessonRequest):
    topic = body.topic.strip()
    age = body.age
    
    # Check cache for instant response
    cache_key = get_smart_cache_key(topic)
    
    async def event_generator():
        try:
            # Handle social greetings instantly
            if is_social_greeting(topic):
                lesson = {
                    "introduction": SOCIAL_REPLY,
                    "sections": [],
                    "quiz": [{"q": "What would you like to learn next?", "options": ["A) Science", "B) History", "C) Anything"], "answer": "C) Anything"}]
                }
                yield f"data: {orjson.dumps({'type':'done','lesson':lesson}).decode()}\n\n"
                return

            # INSTANT precomputed response
            if cache_key.startswith("precomputed:"):
                topic_key = cache_key.replace("precomputed:", "")
                if topic_key in precomputed_cache:
                    logging.info(f"⚡ INSTANT precomputed lesson for: {topic}")
                    lesson = precomputed_cache[topic_key]
                    yield f"data: {orjson.dumps({'type':'done','lesson':lesson}).decode()}\n\n"
                    return

            # INSTANT cached response - no streaming delay
            cached = await get_cache(cache_key, namespace="lessons")
            if cached:
                logging.info(f"📦 Instant cached lesson for: {topic}")
                lesson = {
                    "introduction": cached.introduction,
                    "classifications": [c.dict() for c in cached.classifications],
                    "sections": [s.dict() for s in cached.sections],
                    "diagram": cached.diagram,
                    "quiz": [q.dict() for q in cached.quiz]
                }
                yield f"data: {orjson.dumps({'type':'done','lesson':lesson}).decode()}\n\n"
                return

            # Create age-aware system prompt
            system_prompt = SYSTEM_PROMPT.replace("@age", str(age) if age else "general audience")

            # Generate new content with minimal streaming
            res = await groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Topic: {topic}"}
                ],
                temperature=0.2,  # Even lower for speed
                max_tokens=800,   # Reduced further
                top_p=0.8,       # More focused
                stream=False,    # NO STREAMING - get complete response
            )
            
            content = res.choices[0].message.content
            if not content:
                yield f"data: {orjson.dumps({'type':'error','message':'Empty response'}).decode()}\n\n"
                return
            
            # Parse and send immediately - with robust JSON sanitization
            content = content.strip()
            
            # Find JSON block if wrapped in markdown
            if '```json' in content:
                start = content.find('```json') + 7
                end = content.find('```', start)
                if end != -1:
                    content = content[start:end].strip()
            elif '```' in content:
                start = content.find('```') + 3
                end = content.find('```', start)
                if end != -1:
                    content = content[start:end].strip()
            
            # Try to find JSON object boundaries
            if not (content.startswith('{') and content.endswith('}')):
                start_idx = content.find('{')
                end_idx = content.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    content = content[start_idx:end_idx + 1]
            
            try:
                data = orjson.loads(content)
            except orjson.JSONDecodeError:
                import re
                # Remove control characters that cause JSON parsing issues
                content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)
                # Fix common escape sequence issues
                content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                # Remove trailing commas before closing braces/brackets
                content = re.sub(r',(\s*[}\]])', r'\1', content)
                try:
                    data = orjson.loads(content)
                except orjson.JSONDecodeError:
                    # Create fallback data structure
                    data = {
                        "introduction": {"definition": f"Learn about {topic}", "relevance": ""},
                        "sections": [{"title": f"Introduction to {topic}", "content": f"Overview of {topic}."}],
                        "classifications": [],
                        "quiz_questions": []
                    }
            
            # Process in parallel
            sections_task = asyncio.create_task(process_sections(data))
            quiz_task = asyncio.create_task(process_quiz(data))
            
            sections = await sections_task
            quiz = await quiz_task
            
            intro_str = None
            if data.get("introduction") and isinstance(data["introduction"], dict):
                intro = data["introduction"]
                intro_str = f"{intro.get('definition', '')}\n{intro.get('relevance', '')}".strip()

            lesson = {
                "introduction": intro_str,
                "classifications": data.get("classifications", []),
                "sections": [s.dict() for s in sections],
                "diagram": data.get("diagram_description", ""),
                "quiz": quiz
            }
            
            # Cache for future requests
            response = StructuredLessonResponse(
                introduction=intro_str,
                classifications=[
                    ClassificationItem(type=c["type"], description=c["description"])
                    for c in data.get("classifications", [])
                    if isinstance(c, dict) and "type" in c and "description" in c
                ],
                sections=sections,
                diagram=data.get("diagram_description", ""),
                quiz=[QuizItem(q=q["q"], options=q["options"], answer=q["answer"]) for q in quiz]
            )
            await set_cache(cache_key, response, ttl=7200, namespace="lessons")

            yield f"data: {orjson.dumps({'type':'done','lesson':lesson}).decode()}\n\n"

        except Exception as e:
            yield f"data: {orjson.dumps({'type':'error','message':str(e)}).decode()}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
            "Access-Control-Expose-Headers": "*",  # Better CORS handling
            "X-Content-Type-Options": "nosniff",   # Security header
        },
    )

# ---------- Math solver endpoint ----------
@app.post("/api/solve-math")
async def solve_math(body: MathProblemRequest):
    """Solve math problems with step-by-step workings"""
    question = body.question.strip()
    
    try:
        # Try deterministic solving with SymPy first
        try:
            # Handle equations
            if "=" in question:
                lhs, rhs = question.split("=", 1)
                lhs = lhs.strip()
                rhs = rhs.strip()
                
                # Parse expressions
                lhs_expr = sympify(lhs)
                rhs_expr = sympify(rhs)
                
                # Create equation
                equation = Eq(lhs_expr, rhs_expr)
                
                # Solve
                solutions = solve(equation)
                
                # Build steps
                steps = [
                    MathStep(explanation="Parse the equation", expression=f"{lhs} = {rhs}"),
                    MathStep(explanation="Simplify both sides", expression=str(equation)),
                    MathStep(explanation="Solve for the variable", result=str(solutions))
                ]
                
                final_answer = str(solutions[0]) if solutions else "No solution"
                
            else:
                # Handle expressions
                expr = sympify(question)
                simplified = simplify(expr)
                
                steps = [
                    MathStep(explanation="Parse the expression", expression=question),
                    MathStep(explanation="Simplify", result=str(simplified))
                ]
                
                final_answer = str(simplified)
            
            return MathSolutionResponse(final_answer=final_answer, steps=steps)
            
        except Exception as sympy_error:
            # Fall back to LLM for complex problems
            logging.info(f"SymPy failed, falling back to LLM: {sympy_error}")
            
            res = await groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": MATH_SYSTEM_PROMPT},
                    {"role": "user", "content": question}
                ],
                temperature=0.1,  # Very low for accuracy
                max_tokens=800,
                top_p=0.9,
                stream=False,
            )
            
            content = res.choices[0].message.content
            if not content:
                return MathSolutionResponse(final_answer="Unable to solve", steps=[])
            
            # Sanitize and parse JSON response
            content = content.strip()
            
            # Find JSON block if wrapped in markdown
            if '```json' in content:
                start = content.find('```json') + 7
                end = content.find('```', start)
                if end != -1:
                    content = content[start:end].strip()
            elif '```' in content:
                start = content.find('```') + 3
                end = content.find('```', start)
                if end != -1:
                    content = content[start:end].strip()
            
            # Try to find JSON object boundaries
            if not (content.startswith('{') and content.endswith('}')):
                start_idx = content.find('{')
                end_idx = content.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    content = content[start_idx:end_idx + 1]
            
            try:
                data = orjson.loads(content)
                
                # Convert to response format
                steps = []
                for step_data in data.get("steps", []):
                    steps.append(MathStep(
                        explanation=step_data.get("explanation", ""),
                        expression=step_data.get("expression", ""),
                        result=step_data.get("result", "")
                    ))
                
                return MathSolutionResponse(
                    final_answer=data.get("final_answer", "No answer provided"),
                    steps=steps
                )
                
            except orjson.JSONDecodeError:
                import re
                # Remove control characters that cause JSON parsing issues
                content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)
                # Fix common escape sequence issues
                content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                # Remove trailing commas before closing braces/brackets
                content = re.sub(r',(\s*[}\]])', r'\1', content)
                
                try:
                    data = orjson.loads(content)
                    
                    steps = []
                    for step_data in data.get("steps", []):
                        steps.append(MathStep(
                            explanation=step_data.get("explanation", ""),
                            expression=step_data.get("expression", ""),
                            result=step_data.get("result", "")
                        ))
                    
                    return MathSolutionResponse(
                        final_answer=data.get("final_answer", "No answer provided"),
                        steps=steps
                    )
                    
                except orjson.JSONDecodeError:
                    # Final fallback
                    return MathSolutionResponse(
                        final_answer=content.strip(),
                        steps=[MathStep(explanation="LLM response", result=content.strip())]
                    )
                    
    except Exception as e:
        logging.error(f"Math solver error: {e}")
        return MathSolutionResponse(
            final_answer=f"Error solving problem: {str(e)}",
            steps=[MathStep(explanation="Error occurred", result=str(e))]
        )

# ---------- Health check endpoint ----------
# ---------- TTS endpoint (Gemini) with streaming and compression ----------
@app.post("/api/tts")
async def tts(req: TTSRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    voice_name = os.getenv("GOOGLE_TTS_VOICE", "Leda")
    
    # Check cache first for faster response
    cache_key = f"tts:{hashlib.md5(f'{text}:{voice_name}'.encode()).hexdigest()}"
    cached_audio = await get_cache(cache_key, namespace="tts")
    if cached_audio:
        logging.info(f"✅ TTS cache hit for key: {cache_key[:16]}...")
        # NOTE: Do NOT set Content-Encoding to gzip unless actually compressed.
        # Cached audio is raw WAV; advertise it without misleading encoding.
        return StreamingResponse(
            io.BytesIO(cached_audio), 
            media_type="audio/wav",
            headers={
                "Cache-Control": "public, max-age=3600"
            }
        )

    try:
        # Generate TTS with optimized config
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash-preview-tts",
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name,
                        )
                    )
                ),
            ),
        )
    except Exception as e:
        logging.error(f"TTS generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    try:
        parts = response.candidates[0].content.parts
        inline = parts[0].inline_data
        pcm = inline.data
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid TTS response")

    if isinstance(pcm, str):
        import base64
        try:
            pcm = base64.b64decode(pcm)
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to decode audio")

    # Create optimized WAV with compression
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(pcm)
    
    audio_data = buf.getvalue()
    
    # Cache the audio for future requests (1 hour TTL)
    await set_cache(cache_key, audio_data, ttl=3600, namespace="tts")
    
    # Apply compression for large audio files
    headers = {"Cache-Control": "public, max-age=3600"}
    if len(audio_data) > 1024*1024:  # 1MB threshold
        import gzip
        compressed_data = gzip.compress(audio_data)
        if len(compressed_data) < len(audio_data) * 0.8:  # Only use if 20%+ savings
            headers["Content-Encoding"] = "gzip"
            audio_data = compressed_data
    
    buf = io.BytesIO(audio_data)
    buf.seek(0)

    return StreamingResponse(buf, media_type="audio/wav", headers=headers)

@app.get("/health")
async def health_check():
    """Enhanced health check endpoint with cache and database status"""
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "3.0.0",
        "cache": {"status": "unknown", "type": "unknown"},
        "database": {"status": "unknown"},
        "services": {}
    }
    
    try:
        # Check cache status
        try:
            await set_cache("health_check", "ok", ttl=10, namespace="health")
            test_value = await get_cache("health_check", namespace="health")
            if test_value == "ok":
                health_status["cache"]["status"] = "healthy"
                health_status["cache"]["type"] = "redis"
            else:
                health_status["cache"]["status"] = "degraded"
                health_status["cache"]["type"] = "memory"
        except Exception as e:
            health_status["cache"]["status"] = "unhealthy"
            health_status["cache"]["error"] = str(e)
            health_status["cache"]["type"] = "memory"
        
        # Check database status
        try:
            async_client = await get_async_supabase()
            if async_client:
                health_status["database"]["status"] = "healthy"
        except Exception as e:
            health_status["database"]["status"] = "unhealthy"
            health_status["database"]["error"] = str(e)
        
        # Check external services
        health_status["services"]["groq"] = "configured" if groq_client else "not_configured"
        health_status["services"]["gemini"] = "configured" if gemini_client else "not_configured"
        
        # Overall status
        if (health_status["cache"]["status"] in ["healthy", "degraded"] and 
            health_status["database"]["status"] == "healthy"):
            health_status["status"] = "healthy"
        else:
            health_status["status"] = "degraded"
            
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["error"] = str(e)
    
    return health_status

@app.get("/api/cache/stats")
async def get_cache_statistics():
    """Get cache performance statistics"""
    try:
        stats = await get_cache_stats()
        
        # Add in-memory cache sizes
        memory_stats = {}
        if precomputed_cache:
            memory_stats["precomputed_cache_size"] = len(precomputed_cache)
        
        stats["memory_caches"] = memory_stats
        
        return stats
    except Exception as e:
        return {"error": str(e), "stats": await get_cache_stats()}

# ---------- Server startup ----------
if __name__ == "__main__":
    import uvicorn
    
    # Run with single worker for development to avoid worker process issues
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
        access_log=False,
        server_header=False,
        date_header=False,
        workers=1,  # Single worker to avoid process issues
        limit_concurrency=100,
        backlog=2048,
        timeout_keep_alive=5
    )