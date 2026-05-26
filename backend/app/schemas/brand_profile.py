"""
SQLAlchemy ORM model for BrandProfile.
"""
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.schemas.base import Base, TimestampMixin


class BrandProfile(Base, TimestampMixin):
    __tablename__ = "brand_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Core identity
    organization_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tagline: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    mission_statement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    about: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Sector & audience
    sector_focus: Mapped[Optional[List[str]]] = mapped_column(
        JSON, nullable=True, default=list
    )  # menstrual_hygiene / sanitation / wash / csr / sustainability
    target_audience: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    geographic_focus: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sdg_alignment: Mapped[Optional[List[int]]] = mapped_column(
        JSON, nullable=True, default=list
    )  # SDG numbers 1-17

    # Tone dimensions (1-10 scale)
    tone_professional: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    tone_warm: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    tone_inspirational: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    tone_educational: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    tone_urgent: Mapped[int] = mapped_column(Integer, default=4, nullable=False)

    # Founder voice
    founder_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    founder_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    founder_bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Brand vocabulary
    custom_vocabulary: Mapped[Optional[List[str]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    avoid_words: Mapped[Optional[List[str]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    sample_posts: Mapped[Optional[List[str]]] = mapped_column(
        JSON, nullable=True, default=list
    )

    # Social handles
    linkedin_handle: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    instagram_handle: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    twitter_handle: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationship
    organization: Mapped["Organization"] = relationship(  # type: ignore[name-defined]
        "Organization", back_populates="brand_profile"
    )

    def __repr__(self) -> str:
        return f"<BrandProfile id={self.id} org={self.organization_id}>"
