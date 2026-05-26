"""
Pydantic request/response models for authentication.
"""
import uuid
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ── Request Models ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    full_name: str = Field(..., min_length=2, max_length=255, description="Full name")
    organization_name: str = Field(..., min_length=2, max_length=255, description="Organization name")
    sector: Optional[str] = Field(
        "other",
        description="Organization sector: sanitation/menstrual_hygiene/csr/wash/other",
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., description="Valid refresh token")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Password reset token from email")
    new_password: str = Field(..., min_length=8, description="New password")


# ── Response Models ───────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    is_verified: bool

    model_config = {"from_attributes": True}


class OrganizationBriefResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    sector: str
    subscription_tier: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserResponse
    organization: OrganizationBriefResponse
