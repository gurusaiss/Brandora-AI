"""
Pydantic request/response models for Brand Profile.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Request Models ────────────────────────────────────────────────────────────

class BrandProfileUpdateRequest(BaseModel):
    organization_name: Optional[str] = Field(None, max_length=255)
    tagline: Optional[str] = Field(None, max_length=512)
    mission_statement: Optional[str] = None
    about: Optional[str] = None
    sector_focus: Optional[List[str]] = Field(
        None,
        description="List of sectors: menstrual_hygiene/sanitation/wash/csr/sustainability",
    )
    target_audience: Optional[str] = Field(None, max_length=512)
    geographic_focus: Optional[str] = Field(None, max_length=255)
    sdg_alignment: Optional[List[int]] = Field(None, description="SDG numbers 1-17")

    # Tone dimensions (1-10)
    tone_professional: Optional[int] = Field(None, ge=1, le=10)
    tone_warm: Optional[int] = Field(None, ge=1, le=10)
    tone_inspirational: Optional[int] = Field(None, ge=1, le=10)
    tone_educational: Optional[int] = Field(None, ge=1, le=10)
    tone_urgent: Optional[int] = Field(None, ge=1, le=10)

    # Founder voice
    founder_name: Optional[str] = Field(None, max_length=255)
    founder_title: Optional[str] = Field(None, max_length=255)
    founder_bio: Optional[str] = None

    # Brand vocabulary
    custom_vocabulary: Optional[List[str]] = None
    avoid_words: Optional[List[str]] = None
    sample_posts: Optional[List[str]] = None

    # Social handles
    linkedin_handle: Optional[str] = Field(None, max_length=100)
    instagram_handle: Optional[str] = Field(None, max_length=100)
    twitter_handle: Optional[str] = Field(None, max_length=100)


class VoiceAnalyzeRequest(BaseModel):
    sample_posts: List[str] = Field(
        ..., min_length=1, max_length=20, description="List of sample posts to analyze"
    )


# ── Response Models ───────────────────────────────────────────────────────────

class ToneDimensions(BaseModel):
    professional: int
    warm: int
    inspirational: int
    educational: int
    urgent: int


class BrandProfileResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str
    tagline: Optional[str] = None
    mission_statement: Optional[str] = None
    about: Optional[str] = None
    sector_focus: Optional[List[str]] = None
    target_audience: Optional[str] = None
    geographic_focus: Optional[str] = None
    sdg_alignment: Optional[List[int]] = None
    tone_professional: int
    tone_warm: int
    tone_inspirational: int
    tone_educational: int
    tone_urgent: int
    founder_name: Optional[str] = None
    founder_title: Optional[str] = None
    founder_bio: Optional[str] = None
    custom_vocabulary: Optional[List[str]] = None
    avoid_words: Optional[List[str]] = None
    sample_posts: Optional[List[str]] = None
    linkedin_handle: Optional[str] = None
    instagram_handle: Optional[str] = None
    twitter_handle: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VoiceAnalysisResponse(BaseModel):
    tone_professional: int
    tone_warm: int
    tone_inspirational: int
    tone_educational: int
    tone_urgent: int
    vocabulary_suggestions: List[str]
    avoid_words: List[str]
    summary: str
