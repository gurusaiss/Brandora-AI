"""
SQLAlchemy ORM model for Organizations.
"""
import uuid
from typing import List, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.schemas.base import Base, TimestampMixin


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    sector: Mapped[str] = mapped_column(
        String(50), nullable=False, default="other"
    )  # sanitation / menstrual_hygiene / csr / wash / other
    subscription_tier: Mapped[str] = mapped_column(
        String(20), nullable=False, default="free"
    )  # free / pro / growth / enterprise
    ai_generations_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ai_generations_limit: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    members: Mapped[List["UserOrganizationMembership"]] = relationship(  # type: ignore[name-defined]
        "UserOrganizationMembership",
        back_populates="organization",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    brand_profile: Mapped[Optional["BrandProfile"]] = relationship(  # type: ignore[name-defined]
        "BrandProfile",
        back_populates="organization",
        uselist=False,
        cascade="all, delete-orphan",
    )
    social_accounts: Mapped[List["SocialAccount"]] = relationship(  # type: ignore[name-defined]
        "SocialAccount",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    campaigns: Mapped[List["Campaign"]] = relationship(  # type: ignore[name-defined]
        "Campaign",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    content_generations: Mapped[List["ContentGeneration"]] = relationship(  # type: ignore[name-defined]
        "ContentGeneration",
        back_populates="organization",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Organization id={self.id} name={self.name}>"
