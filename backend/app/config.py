"""
Configuration module for the application.
Loads environment variables and provides configuration settings.
"""
import os
from pathlib import Path

# Try to import dotenv, but handle if it's not available
try:
    from dotenv import load_dotenv
except ImportError:
    # Fallback if dotenv is not available
    def load_dotenv(*args, **kwargs):
        pass

"""
Environment loading policy:
- Prefer backend/.env, but gracefully fall back to repo-root .env if present.
- This ensures deployments where env is stored at the project root still work.
"""
env_dir = Path(__file__).parent.parent  # backend/
backend_env = env_dir / ".env"
root_env = Path(__file__).resolve().parents[2] / ".env"

# Load backend .env first
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env)
else:
    # Fallback to repo-root .env
    if root_env.exists():
        load_dotenv(dotenv_path=root_env)

# API Configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
API_DEBUG = os.getenv("API_DEBUG", "False").lower() in ("true", "1", "t")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "default_secret_key_change_in_production")

# Primary API keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Supabase Configuration (service-side only)
# Support projects where vars are named with NEXT_PUBLIC_* by mapping fallbacks.
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
# Prefer service role on server; never expose to frontend
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

# Service Configurations (legacy names for compatibility)
TTS_API_KEY = os.getenv("TTS_API_KEY", GOOGLE_API_KEY)
MATH_SOLVER_API_KEY = os.getenv("MATH_SOLVER_API_KEY", "")

# TTS Optimization Settings
TTS_MODEL = os.getenv("TTS_MODEL", "gemini-2.5-flash-preview-tts")
TTS_SAMPLE_RATE = int(os.getenv("TTS_SAMPLE_RATE", "22050"))
TTS_CHUNK_SIZE = int(os.getenv("TTS_CHUNK_SIZE", "32768"))
TTS_CONCURRENT_LIMIT = int(os.getenv("TTS_CONCURRENT_LIMIT", "10"))
TTS_CACHE_TTL = int(os.getenv("TTS_CACHE_TTL", "7200"))

# Application Settings
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))