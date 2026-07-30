"""
Team management routes (members, invites, roles).
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import AuthorizationError, NotFoundError
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TeamMemberResponse(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    role: str
    joined_at: datetime
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "editor"


class UpdateRoleRequest(BaseModel):
    role: str


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_user_org(user: User, db: AsyncSession) -> Organization:
    """Return the user's primary active organization, raising 404 if none exists."""
    membership_result = await db.execute(
        select(UserOrganizationMembership)
        .where(
            UserOrganizationMembership.user_id == user.id,
            UserOrganizationMembership.is_active == True,
        )
        .limit(1)
    )
    membership = membership_result.scalar_one_or_none()
    if not membership:
        raise NotFoundError("No active organization found for the current user.")

    org_result = await db.execute(
        select(Organization).where(Organization.id == membership.organization_id)
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise NotFoundError("Organization not found.")
    return org


async def _get_current_user_role(user: User, org: Organization, db: AsyncSession) -> str:
    """Return the current user's role within the given organization."""
    result = await db.execute(
        select(UserOrganizationMembership).where(
            UserOrganizationMembership.user_id == user.id,
            UserOrganizationMembership.organization_id == org.id,
            UserOrganizationMembership.is_active == True,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise AuthorizationError("You are not a member of this organization.")
    return membership.role


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/members", response_model=dict)
async def list_members(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active team members for the current user's organization."""
    org = await _get_user_org(current_user, db)

    result = await db.execute(
        select(UserOrganizationMembership, User)
        .join(User, User.id == UserOrganizationMembership.user_id)
        .where(
            UserOrganizationMembership.organization_id == org.id,
            UserOrganizationMembership.is_active == True,
        )
    )
    rows = result.all()

    members: List[TeamMemberResponse] = []
    for row in rows:
        membership: UserOrganizationMembership = row[0]
        user: User = row[1]
        members.append(
            TeamMemberResponse(
                id=str(membership.id),
                user_id=str(user.id),
                email=user.email,
                full_name=user.full_name,
                role=membership.role,
                joined_at=membership.created_at,
                avatar_url=user.avatar_url,
            )
        )

    return {"members": [m.model_dump() for m in members]}


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_member(
    payload: InviteRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite an existing user to the organization by email (admin only)."""
    org = await _get_user_org(current_user, db)
    role = await _get_current_user_role(current_user, org, db)
    if role != "admin":
        raise AuthorizationError("Only organization admins can invite new members.")

    # Verify the invited user exists
    user_result = await db.execute(
        select(User).where(User.email == payload.email)
    )
    invitee = user_result.scalar_one_or_none()
    if invitee is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No account found for '{payload.email}'. "
                "Please ask them to register first before being invited."
            ),
        )

    # Check for an existing membership record
    existing_result = await db.execute(
        select(UserOrganizationMembership).where(
            UserOrganizationMembership.user_id == invitee.id,
            UserOrganizationMembership.organization_id == org.id,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing is not None:
        if existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This user is already an active member of the organization.",
            )
        # Reactivate a previously removed membership
        existing.is_active = True
        existing.role = payload.role
        await db.flush()
        import asyncio
        from app.services.email_service import send_team_invite_email
        asyncio.create_task(
            send_team_invite_email(
                to=invitee.email,
                inviter_name=current_user.full_name or current_user.email,
                org_name=org.name,
                role=payload.role,
                invitee_name=invitee.full_name or "",
            )
        )
        return {"message": "Team member reactivated successfully.", "user_id": str(invitee.id)}

    # Create a new membership
    new_membership = UserOrganizationMembership(
        id=uuid.uuid4(),
        user_id=invitee.id,
        organization_id=org.id,
        role=payload.role,
        is_active=True,
    )
    db.add(new_membership)
    await db.flush()

    # Send notification email (fire-and-forget)
    import asyncio
    from app.services.email_service import send_team_invite_email
    asyncio.create_task(
        send_team_invite_email(
            to=invitee.email,
            inviter_name=current_user.full_name or current_user.email,
            org_name=org.name,
            role=payload.role,
            invitee_name=invitee.full_name or "",
        )
    )

    return {"message": "Team member invited successfully.", "user_id": str(invitee.id)}


@router.patch("/members/{member_id}")
async def update_member_role(
    member_id: str,
    payload: UpdateRoleRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a team member's role (admin only)."""
    org = await _get_user_org(current_user, db)
    role = await _get_current_user_role(current_user, org, db)
    if role != "admin":
        raise AuthorizationError("Only organization admins can update member roles.")

    membership_result = await db.execute(
        select(UserOrganizationMembership).where(
            UserOrganizationMembership.id == uuid.UUID(member_id),
            UserOrganizationMembership.organization_id == org.id,
            UserOrganizationMembership.is_active == True,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError(f"Team member with id '{member_id}' not found in your organization.")

    membership.role = payload.role
    await db.flush()

    return {"message": "Role updated successfully.", "member_id": member_id, "new_role": payload.role}


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a team member from the organization (admin only)."""
    org = await _get_user_org(current_user, db)
    role = await _get_current_user_role(current_user, org, db)
    if role != "admin":
        raise AuthorizationError("Only organization admins can remove members.")

    membership_result = await db.execute(
        select(UserOrganizationMembership).where(
            UserOrganizationMembership.id == uuid.UUID(member_id),
            UserOrganizationMembership.organization_id == org.id,
            UserOrganizationMembership.is_active == True,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError(f"Team member with id '{member_id}' not found in your organization.")

    # Prevent self-removal
    if membership.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove yourself from the organization.",
        )

    # Prevent removal of the last admin
    if membership.role == "admin":
        admin_count_result = await db.execute(
            select(UserOrganizationMembership).where(
                UserOrganizationMembership.organization_id == org.id,
                UserOrganizationMembership.role == "admin",
                UserOrganizationMembership.is_active == True,
            )
        )
        admins = admin_count_result.scalars().all()
        if len(admins) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last admin of the organization. Promote another member to admin first.",
            )

    membership.is_active = False
    await db.flush()
    return None
