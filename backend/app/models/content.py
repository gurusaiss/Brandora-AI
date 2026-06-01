"""
Pydantic request/response models for content generation.
"""
import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ── Request Models ────────────────────────────────────────────────────────────

class ContentGenerateRequest(BaseModel):
    # Allow fields that start with "model_" without Pydantic namespace warnings
    model_config = {"protected_namespaces": ()}

    topic: str = Field(..., min_length=10, max_length=500, description="The topic or subject for content generation")
    platform: Literal[
        "linkedin", "instagram", "twitter", "reel_script", "carousel", "csr_story", "founder_post"
    ] = Field(..., description="Target social media platform")
    context: Optional[str] = Field(None, max_length=1000, description="Additional context or background information")
    tone: Optional[
        Literal["professional", "inspirational", "educational", "urgent", "conversational"]
    ] = Field("professional", description="Desired tone for the content")
    campaign_brief: Optional[str] = Field(None, max_length=2000, description="Campaign brief to inform the content")
    campaign_id: Optional[uuid.UUID] = Field(None, description="Optional campaign to associate this generation with")
    include_hashtags: bool = Field(True, description="Whether to generate hashtags")
    language: Optional[Literal["en", "hi", "bn", "ta", "kn"]] = Field("en", description="Output language code")
    model_override: Optional[str] = Field(None, description="Force a specific AI model (advanced)")


class ContentRepurposeRequest(BaseModel):
    content_id: uuid.UUID = Field(..., description="ID of the source content to repurpose")
    target_platforms: List[
        Literal["linkedin", "instagram", "twitter", "reel_script", "carousel", "csr_story", "founder_post"]
    ] = Field(..., min_length=1, max_length=6, description="Platforms to repurpose content for")


class ContentFeedbackRequest(BaseModel):
    feedback: Literal["thumbs_up", "thumbs_down"] = Field(..., description="User feedback on generated content")


# ── Response Models ───────────────────────────────────────────────────────────

class ContentGenerateResponse(BaseModel):
    id: uuid.UUID
    platform: str
    generated_content: str
    hashtags: List[str]
    quality_score: Optional[float] = None
    ai_model_used: str
    tokens_used: int
    is_saved: bool = False
    feedback: Optional[str] = None
    parent_generation_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentRepurposeResponse(BaseModel):
    original_id: uuid.UUID
    repurposed: List[ContentGenerateResponse]


class ContentListResponse(BaseModel):
    items: List[ContentGenerateResponse]
    total: int
    page: int
    page_size: int


# ── Filter / Query Models ─────────────────────────────────────────────────────

class ContentListFilter(BaseModel):
    platform: Optional[str] = None
    saved: Optional[bool] = None
    campaign_id: Optional[uuid.UUID] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
