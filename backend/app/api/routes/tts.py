"""
Text-to-Speech API routes.
"""
import logging
from fastapi import APIRouter, HTTPException, Request
from app.schemas import TTSRequest, TTSResponse, StructuredLessonTTSRequest
from app.services.tts_service import TTSService
import base64
import io
import wave
from typing import Optional
from fastapi.responses import StreamingResponse
from app.config import TTS_CHUNK_SIZE
from app.middleware.rate_limit_middleware import RateLimitMiddleware

router = APIRouter()

# Create a singleton TTSService so its cache/client are reused across requests
_TTS_SERVICE = TTSService()
rate_limiter = RateLimitMiddleware(None)

def _get_tts_service():
    return _TTS_SERVICE


def _extract_lesson_text(lesson: dict, mode: str = "full", section_index: Optional[int] = None) -> str:
    """Extract text from structured lesson based on mode. Quiz data is intentionally excluded from TTS generation."""
    if not lesson:
        return ""
    
    texts = []
    
    # Handle different modes
    if mode == "summary":
        # Extract only introduction and section titles for a summary
        if lesson.get("introduction"):
            texts.append(lesson["introduction"])
        if lesson.get("sections"):
            for section in lesson["sections"]:
                if section.get("title"):
                    texts.append(section["title"])
    elif mode == "section":
        # Extract only a specific section
        if lesson.get("sections") and section_index is not None:
            sections = lesson["sections"]
            if 0 <= section_index < len(sections):
                section = sections[section_index]
                if section.get("title"):
                    texts.append(section["title"])
                if section.get("content"):
                    texts.append(section["content"])
    else:  # full mode
        # Extract the complete lesson content
        if lesson.get("introduction"):
            texts.append(lesson["introduction"])
        if lesson.get("sections"):
            for section in lesson["sections"]:
                if section.get("title"):
                    texts.append(section["title"])
                if section.get("content"):
                    texts.append(section["content"])
    
    # Join all texts with appropriate spacing
    return "\n\n".join(texts)

# Main TTS endpoint used by frontend - Convert text to speech and return audio/wav as streaming response.
@router.post("/")
async def synthesize_wav(request: TTSRequest, http_request: Request):
    """Convert text to speech and return audio/wav as streaming response."""
    # Apply rate limiting through middleware
    pass  # Rate limiting is handled by middleware now
    
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    tts_service = _get_tts_service()
    try:
        # Default to 'leda' voice when not provided
        audio_bytes = await tts_service.generate_speech(request.text, request.voice or "leda")

        async def chunker():
            # Increased chunk size for faster streaming
            chunk_size = TTS_CHUNK_SIZE  # Configurable chunk size
            for i in range(0, len(audio_bytes), chunk_size):
                yield audio_bytes[i:i + chunk_size]

        return StreamingResponse(
            chunker(),
            media_type="audio/wav",
            headers={
                "Cache-Control": "no-store",
                "Content-Disposition": "inline; filename=\"speech.wav\"",
                "Accept-Ranges": "bytes",
                "X-Accel-Buffering": "no",
                # Add streaming optimization headers
                "Connection": "keep-alive",
                "Transfer-Encoding": "chunked",
            },
        )
    except RuntimeError as e:
        # Handle TTS service errors with proper HTTP status
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(status_code=500, detail=f"Internal TTS error: {str(e)}")


# New endpoint for structured lesson TTS
@router.post("/lesson")
async def synthesize_lesson_wav(request: StructuredLessonTTSRequest, http_request: Request):
    """Convert structured lesson to speech and return audio/wav as streaming response."""
    # Apply rate limiting through middleware
    pass  # Rate limiting is handled by middleware now
    
    if not request.lesson:
        raise HTTPException(status_code=400, detail="Lesson content cannot be empty")

    # Extract text from lesson based on mode
    text = _extract_lesson_text(request.lesson, request.mode, request.section_index)
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text content found in lesson")

    tts_service = _get_tts_service()
    try:
        # Default to 'leda' voice when not provided
        audio_bytes = await tts_service.generate_speech(text, request.voice or "leda")

        async def chunker():
            # Increased chunk size for faster streaming
            chunk_size = TTS_CHUNK_SIZE  # Configurable chunk size
            for i in range(0, len(audio_bytes), chunk_size):
                yield audio_bytes[i:i + chunk_size]

        return StreamingResponse(
            chunker(),
            media_type="audio/wav",
            headers={
                "Cache-Control": "no-store",
                "Content-Disposition": "inline; filename=\"lesson_speech.wav\"",
                "Accept-Ranges": "bytes",
                "X-Accel-Buffering": "no",
                # Add streaming optimization headers
                "Connection": "keep-alive",
                "Transfer-Encoding": "chunked",
            },
        )
    except RuntimeError as e:
        # Handle TTS service errors with proper HTTP status
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(status_code=500, detail=f"Internal TTS error: {str(e)}")
