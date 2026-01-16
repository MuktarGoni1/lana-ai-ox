from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class MathStep(BaseModel):
    """A step in a math solution."""
    description: str
    expression: Optional[str] = None


class MathProblemRequest(BaseModel):
    """Request model for math problem solving."""
    problem: str
    grade_level: Optional[int] = None
    show_steps: bool = True


class MathSolutionResponse(BaseModel):
    """Response model for math problem solution."""
    problem: str
    solution: str
    steps: Optional[List[MathStep]] = None
    error: Optional[str] = None


class TTSRequest(BaseModel):
    """Request model for text-to-speech synthesis."""
    text: str
    voice: Optional[str] = "default"


class TTSResponse(BaseModel):
    """Response model for text-to-speech synthesis."""
    audio_base64: str
    duration_seconds: float
    error: Optional[str] = None


class StructuredLessonTTSRequest(BaseModel):
    """Request model for text-to-speech synthesis from structured lesson."""
    lesson: dict  # The complete lesson object
    mode: Optional[str] = "full"  # full, summary, or section
    section_index: Optional[int] = None  # Specific section index for section mode
    voice: Optional[str] = "default"


class LessonRequest(BaseModel):
    """Request model for lesson generation."""
    topic: str
    difficulty: str = "medium"
    lesson_type: str = "explanation"


class LessonResponse(BaseModel):
    """Response model for lesson data."""
    id: str
    topic: str
    content: str
    difficulty: str
    lesson_type: str
    created_at: str
    error: Optional[str] = None