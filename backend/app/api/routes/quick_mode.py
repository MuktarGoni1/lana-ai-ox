"""
Quick Mode API routes.
Generates concise, clear, and easily understandable structured lessons with quiz.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import json
import logging

try:
    from groq import Groq
except Exception:
    Groq = None

from pydantic import BaseModel, Field, field_validator
from app.services.lesson_service import LessonService
from app.services.llm_client import get_groq_client
from app.repositories.memory_cache_repository import MemoryCacheRepository
from app.repositories.memory_lesson_repository import MemoryLessonRepository
from app.repositories.supabase_repository import SupabaseRepository
from app.config import SUPABASE_URL, SUPABASE_KEY, GROQ_API_KEY
from app.middleware.rate_limit_middleware import RateLimitMiddleware

logger = logging.getLogger(__name__)

router = APIRouter()

# Import and reuse the sanitize_text function from main.py
def sanitize_text(text: str) -> str:
    import re
    if not text:
        return ""
    # Only escape the most dangerous HTML characters, preserve readable text
    # Instead of using html.escape() which encodes apostrophes as &#x27;
    # manually escape only <, >, & that could lead to XSS, preserve readable text characters
    text = text.replace("&", "&amp;")  # Must be first to avoid double-encoding
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    # For quotes, only escape when they might be in dangerous contexts
    # For now, we'll still escape them but decode in frontend - more sophisticated approach would be context-aware
    text = text.replace("\"", "&quot;")
    text = text.replace("'", "&#x27;")
    text = re.sub(r"\s+", " ", text).strip()
    return text


class ClassificationItem(BaseModel):
    type: str
    description: str

    @field_validator("type", "description")
    def _san(cls, v):
        return sanitize_text(v)


class SectionItem(BaseModel):
    title: str
    content: str

    @field_validator("title", "content")
    def _san(cls, v):
        return sanitize_text(v)


class QuizItem(BaseModel):
    question: str
    options: List[str]
    answer: str

    @field_validator("question", "answer")
    def _san(cls, v):
        return sanitize_text(v)

    @field_validator("options")
    def _san_opts(cls, v):
        return [sanitize_text(o) for o in v]


class QuickModeRequest(BaseModel):
    topic: str
    age: Optional[int] = None

    @field_validator("topic")
    def _val_topic(cls, v):
        v = sanitize_text(v.strip())
        if len(v) < 2:
            raise ValueError("Topic too short")
        return v


class QuickModeResponse(BaseModel):
    introduction: Optional[str] = None
    classifications: List[ClassificationItem] = []
    sections: List[SectionItem]
    diagram: str = ""
    quiz: List[QuizItem]


@router.post("/generate", response_model=QuickModeResponse)
async def generate_quick_lesson(req: QuickModeRequest):
    """
    Create a quick, concise lesson for rapid understanding.
    Generates a brief introduction, key points, and simplified quiz.
    """
    def _stub(topic: str) -> QuickModeResponse:
        """Fallback stub response when LLM is not available."""
        intro = f"Quick overview of {topic} - essential concepts in simple terms."
        classifications = [
            ClassificationItem(type="Core Concept", description=topic.title()),
            ClassificationItem(type="Importance", description="Key idea to understand"),
        ]
        sections = [
            SectionItem(title="Essential Points", content=f"Main ideas about {topic} explained simply."),
            SectionItem(title="Key Takeaway", content=f"The most important thing to remember about {topic}."),
        ]
        quiz = [
            QuizItem(
                question=f"What is the main idea of {topic}?",
                options=[f"It's about {topic}", "It's complicated", "It's boring", "None of the above"],
                answer=f"It's about {topic}"
            ),
        ]
        return QuickModeResponse(
            introduction=intro,
            classifications=classifications,
            sections=sections,
            diagram="",
            quiz=quiz,
        )

    topic = req.topic
    age = req.age

    # Use LLM if configured; otherwise fall back to stub
    groq_client = get_groq_client()
    if groq_client:
        try:
            system_prompt = (
                "You are an expert educator creating concise, easy-to-understand lessons. "
                "Return only JSON with keys: introduction (brief, clear string), "
                "classifications (array of 2-3 {type, description} pairs), "
                "sections (array of 2-3 {title, content} pairs with simple language), "
                "diagram (string; optional ASCII or description), "
                "quiz (array of 1-2 {question, options, answer} objects with simple questions). "
                "Keep explanations very simple and clear. Make content age-appropriate if age is provided."
            )
            
            user_prompt = {
                "topic": topic,
                "age": age,
                "requirements": "Concise, clear, simple language, educational, quick understanding"
            }
            
            completion = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                temperature=0.3,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_prompt)},
                ],
            )
            
            content = completion.choices[0].message.content
            data = json.loads(content)
            
            # Validate and construct response
            resp = QuickModeResponse(
                introduction=data.get("introduction", ""),
                classifications=[ClassificationItem(**c) for c in data.get("classifications", [])],
                sections=[SectionItem(**s) for s in data.get("sections", [])],
                diagram=data.get("diagram", ""),
                quiz=[QuizItem(**q) for q in data.get("quiz", [])],
            )
            
            # Ensure minimum content
            if not resp.sections:
                return _stub(topic)
                
            return resp
            
        except json.JSONDecodeError as e:
            logger.error(f"Quick mode JSON decode error: {e}")
            return _stub(topic)
        except Exception as e:
            logger.warning(f"Quick mode LLM error: {e}")
            return _stub(topic)
    else:
        # Fallback to stub if Groq is not configured
        return _stub(topic)


@router.post("/stream", tags=["Quick Mode"])
async def stream_quick_mode_lesson(req: QuickModeRequest):
    """Stream a quick mode lesson as a single SSE 'done' event."""
    from fastapi.responses import StreamingResponse
    
    try:
        lesson = await generate_quick_lesson(req)  # FIXED: Changed from create_quick_mode_lesson to generate_quick_lesson
        async def event_generator():
            try:
                # Use model_dump for Pydantic v2 compatibility
                try:
                    payload_lesson = lesson.model_dump()
                except AttributeError:
                    payload_lesson = lesson.dict()
                    
                payload = {"type": "done", "lesson": payload_lesson}
                yield f"data: {json.dumps(payload)}\n\n"
            except Exception:
                # Silently ignore any errors during serialization/streaming
                pass
                # Use model_dump for Pydantic v2 compatibility
                try:
                    payload_lesson = lesson.model_dump()
                except AttributeError:
                    payload_lesson = lesson.dict()
                    
                payload = {"type": "done", "lesson": payload_lesson}
                yield f"data: {json.dumps(payload)}\n\n"
                
        return StreamingResponse(event_generator(), media_type="text/event-stream")
        
    except Exception as e:
        err = {"type": "error", "message": str(e)}
        async def error_stream():
            yield f"data: {json.dumps(err)}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")