import os
from typing import List, Optional
from pydantic import BaseModel, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    # App
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_debug: bool = False
    api_secret_key: str = "change_me_in_prod"

    # CORS and rate limit
    cors_origins: List[str] = ["*"]
    rate_limit_per_minute: int = 60
    rate_limit_per_hour: int = 1000

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""

    # External APIs
    groq_api_key: str = ""
    google_api_key: str = ""

    # Database and Redis
    database_url: str = ""
    redis_url: str = ""
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: Optional[str] = None

    @field_validator("cors_origins", mode="before")
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


def load_settings() -> Settings:
    # Load .env from backend/.env or repo-root .env (same policy as app.config)
    from dotenv import load_dotenv
    env_dir = Path(__file__).resolve().parents[1]
    backend_env = env_dir / ".env"
    root_env = env_dir.parents[1] / ".env"
    if backend_env.exists():
        load_dotenv(backend_env)
    elif root_env.exists():
        load_dotenv(root_env)

    # Map legacy env names to typed fields
    values = {
        "api_host": os.getenv("API_HOST", "0.0.0.0"),
        "api_port": int(os.getenv("API_PORT", "8000")),
        "api_debug": os.getenv("API_DEBUG", "False").lower() in ("true", "1", "t"),
        "api_secret_key": os.getenv("API_SECRET_KEY", "change_me_in_prod"),
        "cors_origins": os.getenv("CORS_ORIGINS", "*") or "*",
        "rate_limit_per_minute": int(os.getenv("RATE_LIMIT_PER_MINUTE", "60")),
        "groq_api_key": os.getenv("GROQ_API_KEY", ""),
        "google_api_key": os.getenv("GOOGLE_API_KEY", ""),
        "database_url": os.getenv("DATABASE_URL", ""),
        "supabase_url": os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""),
        "supabase_service_role_key": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
        "redis_url": os.getenv("REDIS_URL", ""),
        "redis_host": os.getenv("REDIS_HOST", "localhost"),
        "redis_port": int(os.getenv("REDIS_PORT", "6379")),
        "redis_db": int(os.getenv("REDIS_DB", "0")),
        "redis_password": os.getenv("REDIS_PASSWORD"),
    }
    return Settings(**values)