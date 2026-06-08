"""
SQLAlchemy ORM models for Campaigns and Campaign Posts.
"""
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.schemas.base import Base, TimestampMixin


class Campaign(Base, TimestampMixin):
    __tablename__ = "campaigns"

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
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    campaign_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="awareness"
    )  # awareness/festival/product/csr_report/founder/custom
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # draft/active/completed/archived
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    platforms: Mapped[Optional[List[str]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    target_hashtags: Mapped[Optional[List[str]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    brief: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    festival_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("festivals.id", ondelete="SET NULL"),
        nullable=True,
    )
    total_posts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    published_posts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── Auto-scheduler fields ────────────────────────────────────────────────
    topic: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    social_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    frequency: Mapped[str] = mapped_column(String(20), nullable=False, default="daily")
    post_time: Mapped[str] = mapped_column(String(5), nullable=False, default="09:00")
    post_days: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, default=list)
    is_scheduled: Mapped[bool] = mapped_column(default=False, nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship(  # type: ignore[name-defined]
        "Organization", back_populates="campaigns"
    )
    posts: Mapped[List["CampaignPost"]] = relationship(
        "CampaignPost",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="CampaignPost.sequence_order",
    )

    def __repr__(self) -> str:
        return f"<Campaign id={self.id} name={self.name}>"


class CampaignPost(Base, TimestampMixin):
    __tablename__ = "campaign_posts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_generation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_generations.id", ondelete="SET NULL"),
        nullable=True,
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    hashtags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, default=list)
    media_urls: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, default=list)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # draft/scheduled/published/failed
    sequence_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationship
    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="posts")

    def __repr__(self) -> str:
        return f"<CampaignPost id={self.id} platform={self.platform} status={self.status}>"


class Festival(Base, TimestampMixin):
    """Calendar of festivals and awareness days relevant to WASH/hygiene sector."""

    __tablename__ = "festivals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="festival"
    )  # festival/awareness_day/national_day/un_day
    relevant_sectors: Mapped[Optional[List[str]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    suggested_hashtags: Mapped[Optional[List[str]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    country: Mapped[str] = mapped_column(String(50), nullable=False, default="IN")
    is_recurring: Mapped[bool] = mapped_column(default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Festival id={self.id} name={self.name} date={self.date}>"


class SocialAccount(Base, TimestampMixin):
    """Connected social media accounts for an organization."""

    __tablename__ = "social_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    platform: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # linkedin/instagram/twitter
    account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    account_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationship
    organization: Mapped["Organization"] = relationship(  # type: ignore[name-defined]
        "Organization", back_populates="social_accounts"
    )

    def __repr__(self) -> str:
        return f"<SocialAccount platform={self.platform} account={self.account_name}>"


class HashtagSet(Base, TimestampMixin):
    """Saved hashtag sets for an organization."""

    __tablename__ = "hashtag_sets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    platform: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    hashtags: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    def __repr__(self) -> str:
        return f"<HashtagSet id={self.id} name={self.name}>"
