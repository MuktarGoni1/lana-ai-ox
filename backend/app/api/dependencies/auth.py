from typing import Optional
from fastapi import Depends, HTTPException, status, Request
import jwt
from jwt import PyJWKClient
from pydantic import BaseModel
from app.settings import Settings, load_settings
import logging

logger = logging.getLogger(__name__)


class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None


def get_settings() -> Settings:
    # Simple non-cached settings loader; FastAPI will reuse in process
    return load_settings()


def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        logger.warning(
            "auth_missing_bearer",
            extra={"path": request.url.path, "method": request.method, "ip": request.client.host if request.client else "unknown"},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = auth.split(" ", 1)[1]
    # First try local API secret (HS256) tokens
    data = None
    try:
        data = jwt.decode(token, settings.api_secret_key, algorithms=["HS256"], options={"verify_aud": False})
    except Exception:
        logger.debug("auth_hs256_decode_failed", extra={"path": request.url.path})
        data = None

    # If HS256 failed, attempt Supabase JWT via JWKs (RS256)
    if data is None and settings.supabase_url:
        jwks_url = settings.supabase_url.rstrip("/") + "/auth/v1/jwks"
        try:
            jwk_client = PyJWKClient(jwks_url)
            signing_key = jwk_client.get_signing_key_from_jwt(token)
            data = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False},  # Supabase uses aud="authenticated"
            )
        except Exception as e:
            logger.warning("auth_rs256_decode_failed", extra={"path": request.url.path, "error": str(e)})
            data = None

    if data is None:
        logger.warning("auth_invalid_token", extra={"path": request.url.path})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    uid = (data.get("sub") or data.get("user_id") or "").strip()
    if not uid:
        logger.warning("auth_invalid_payload", extra={"path": request.url.path})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return CurrentUser(id=uid, email=data.get("email"))