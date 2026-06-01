"""
SQLAlchemy ORM model for ContentGeneration (AI-generated posts).
"""
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.schemas.base import Base, TimestampMixin


class ContentGeneration(Base, TimestampMixin):
    __tablename__ = "content_generations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    input_topic: Mapped[str] = mapped_column(String(500), nullable=False)
    input_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    campaign_brief: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    platform: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # linkedin/instagram/twitter/reel_script/carousel/csr_story/founder_post
    tone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="professional"
    )  # professional/inspirational/educational/urgent/conversational
    generated_content: Mapped[str] = mapped_column(Text, nullable=False)
    hashtags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, default=list)
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_repurposed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    parent_generation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_generations.id", ondelete="SET NULL"),
        nullable=True,
    )
    feedback: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )  # thumbs_up / thumbs_down
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")

    # Relationships
    organization: Mapped["Organization"] = relationship(  # type: ignore[name-defined]
        "Organization", back_populates="content_generations"
    )
    children: Mapped[List["ContentGeneration"]] = relationship(
        "ContentGeneration",
        foreign_keys=[parent_generation_id],
        remote_side=[id],
    )

    def __repr__(self) -> str:
        return f"<ContentGeneration id={self.id} platform={self.platform}>"
