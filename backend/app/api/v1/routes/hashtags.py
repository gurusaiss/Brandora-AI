"""
Hashtag generation and set management routes.

generate_hashtags is a pure rule-based generator — zero AI / API cost.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.campaign import HashtagSet
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class HashtagGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=300)
    platform: str = Field("linkedin", description="Target platform")
    count: int = Field(10, ge=1, le=30, description="Number of hashtags to return")


class HashtagGenerateResponse(BaseModel):
    hashtags: List[str]
    platform: str
    topic: str


class HashtagSetCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    hashtags: List[str] = Field(..., min_length=1)
    platform: Optional[str] = None


class HashtagSetResponse(BaseModel):
    id: uuid.UUID
    name: str
    hashtags: List[str]
    platform: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Rule-based hashtag generator
# ---------------------------------------------------------------------------

_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "its", "it", "this",
    "that", "these", "those", "we", "our", "us", "my", "your", "their",
    "about", "up", "out", "into", "over", "after", "how", "why", "what",
    "when", "where", "which", "who", "all", "more", "also", "as", "so",
    "not", "no", "if", "then", "than", "just", "very", "get", "got",
}

# Sector-specific hashtag banks
_NGO_CSR_BANK = [
    "#NGO", "#CSR", "#SocialImpact", "#NonProfit", "#GrassrootsChange",
    "#CorporateResponsibility", "#SDGs", "#SustainableDevelopment",
    "#ImpactInvesting", "#CommunityDevelopment", "#SocialEnterprise",
    "#ChangeMakers", "#MissionDriven", "#DevelopmentSector", "#Philanthropy",
]

_MENSTRUAL_HEALTH_BANK = [
    "#MenstrualHealth", "#MenstrualHygiene", "#PeriodPositive", "#BreakTheTaboo",
    "#PeriodHealth", "#MHDay", "#EndPeriodPoverty", "#PeriodEquity",
    "#MenstrualHygieneMgmt", "#GirlsEducation", "#WomenHealth",
    "#HealthyPeriods", "#PeriodStigma", "#MenstrualCup", "#PadMan",
]

_WASH_SANITATION_BANK = [
    "#WASH", "#Sanitation", "#CleanWater", "#WaterAndSanitation",
    "#SDG6", "#WorldToiletDay", "#OpenDefecationFree", "#ODF",
    "#SwachhBharat", "#CleanIndia", "#WaterForAll", "#HandHygiene",
    "#SafeWater", "#CommunityLed", "#TotalSanitation",
]

_PLATFORM_BANKS = {
    "instagram": [
        "#Explore", "#ReelsIndia", "#InstaGood", "#ForYou",
        "#ViralReels", "#InstagramIndia", "#ContentCreator",
    ],
    "linkedin": [
        "#Leadership", "#Innovation", "#ProfessionalDevelopment",
        "#ThoughtLeadership", "#LinkedInIndia", "#GrowthMindset",
    ],
    "twitter": [
        "#Thread", "#Trending",
    ],
}

# Platform-specific hard limits on total hashtag count
_PLATFORM_LIMITS = {
    "instagram": 20,
    "twitter": 3,
    "linkedin": 5,
}

# Keywords that trigger each domain bank
_MH_KEYWORDS = {
    "menstrual", "period", "menstruation", "hygiene", "women", "girl",
    "pad", "tampon", "sanitary", "mhm", "mhday",
}
_WASH_KEYWORDS = {
    "water", "sanitation", "toilet", "wash", "latrine", "defecation",
    "handwash", "swachh", "odf", "sewage", "drainage", "clean",
}
_NGO_KEYWORDS = {
    "ngo", "csr", "nonprofit", "impact", "social", "community", "charity",
    "development", "campaign", "awareness", "mission", "foundation",
}


def _tokenize(topic: str) -> List[str]:
    """Return lowercase tokens from topic, stripped of punctuation."""
    import re
    raw = re.sub(r"[^a-zA-Z0-9 ]", " ", topic)
    return [t.lower() for t in raw.split() if len(t) > 2 and t.lower() not in _STOPWORDS]


def _topic_hashtags(tokens: List[str]) -> List[str]:
    """Convert meaningful tokens directly into hashtags."""
    tags = []
    for token in tokens:
        if len(token) >= 3:
            tags.append("#" + token.capitalize())
    return tags


def _detect_banks(tokens: List[str]) -> List[List[str]]:
    """Return the relevant domain banks based on token overlap."""
    token_set = set(tokens)
    active_banks: List[List[str]] = []

    if token_set & _MH_KEYWORDS:
        active_banks.append(_MENSTRUAL_HEALTH_BANK)
    if token_set & _WASH_KEYWORDS:
        active_banks.append(_WASH_SANITATION_BANK)
    if token_set & _NGO_KEYWORDS or not active_banks:
        # Always include NGO/CSR if nothing else matched, or when explicitly relevant
        active_banks.append(_NGO_CSR_BANK)

    return active_banks


def generate_hashtags_rule_based(
    topic: str,
    platform: str,
    count: int = 10,
) -> List[str]:
    """
    Pure rule-based hashtag generator.

    1. Tokenize topic -> topic-derived tags
    2. Detect relevant domain banks from keywords
    3. Add platform-specific tags
    4. Apply platform limit (overrides count for instagram/twitter/linkedin)
    5. Deduplicate, preserve insertion order
    """
    platform = platform.lower()
    limit = _PLATFORM_LIMITS.get(platform, count)

    tokens = _tokenize(topic)

    # Build ordered candidate list
    candidates: List[str] = []

    # 1. Topic-derived hashtags (highest relevance)
    candidates.extend(_topic_hashtags(tokens))

    # 2. Domain-bank hashtags
    active_banks = _detect_banks(tokens)
    for bank in active_banks:
        candidates.extend(bank)

    # 3. Platform-specific tags
    platform_tags = _PLATFORM_BANKS.get(platform, [])
    candidates.extend(platform_tags)

    # 4. Deduplicate (case-insensitive key), preserve order
    seen: set = set()
    unique: List[str] = []
    for tag in candidates:
        key = tag.lower()
        if key not in seen:
            seen.add(key)
            unique.append(tag)

    return unique[:limit]


# ---------------------------------------------------------------------------
# Helper: resolve user's active organization
# ---------------------------------------------------------------------------


async def _get_user_org(user: User, db: AsyncSession) -> Organization:
    m = await db.execute(
        select(UserOrganizationMembership)
        .where(
            UserOrganizationMembership.user_id == user.id,
            UserOrganizationMembership.is_active == True,  # noqa: E712
        )
        .limit(1)
    )
    membership = m.scalar_one_or_none()
    if not membership:
        raise NotFoundError("No active organization.")
    org_result = await db.execute(
        select(Organization).where(Organization.id == membership.organization_id)
    )
    return org_result.scalar_one()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/generate", response_model=HashtagGenerateResponse)
async def generate_hashtags(payload: HashtagGenerateRequest):
    """
    Generate relevant hashtags for a topic and platform.
    No authentication required. Zero AI / API cost — pure rule-based logic.
    """
    hashtags = generate_hashtags_rule_based(
        topic=payload.topic,
        platform=payload.platform,
        count=payload.count,
    )
    return HashtagGenerateResponse(
        hashtags=hashtags,
        platform=payload.platform,
        topic=payload.topic,
    )


@router.get("/sets", response_model=List[HashtagSetResponse])
async def list_hashtag_sets(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all saved hashtag sets for the current user's organization."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(HashtagSet)
        .where(HashtagSet.organization_id == org.id)
        .order_by(HashtagSet.created_at.desc())
    )
    items = result.scalars().all()
    return [HashtagSetResponse.model_validate(h) for h in items]


@router.post("/sets", response_model=HashtagSetResponse, status_code=status.HTTP_201_CREATED)
async def create_hashtag_set(
    payload: HashtagSetCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a named hashtag set for the current user's organization."""
    org = await _get_user_org(current_user, db)
    hs = HashtagSet(
        id=uuid.uuid4(),
        organization_id=org.id,
        name=payload.name,
        platform=payload.platform,
        hashtags=payload.hashtags,
    )
    db.add(hs)
    await db.flush()
    return HashtagSetResponse.model_validate(hs)


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hashtag_set(
    set_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved hashtag set (must belong to the user's organization)."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(HashtagSet).where(
            HashtagSet.id == set_id,
            HashtagSet.organization_id == org.id,
        )
    )
    hs = result.scalar_one_or_none()
    if not hs:
        raise NotFoundError(f"Hashtag set {set_id} not found.")
    await db.delete(hs)
    await db.flush()
