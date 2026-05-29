"""
Team management routes (members, invites, roles).
"""
from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_active_user

router = APIRouter()


@router.get("/members")
async def list_members(current_user=Depends(get_current_active_user)):
    """List team members for the user's organization."""
    return {"items": [], "total": 0}


@router.post("/invite")
async def invite_member(
    data: dict,
    current_user=Depends(get_current_active_user),
):
    """Invite a new team member by email."""
    return {"message": "Invitation sent (feature coming soon)"}


@router.patch("/members/{member_id}")
async def update_member_role(
    member_id: str,
    data: dict,
    current_user=Depends(get_current_active_user),
):
    """Update a team member's role."""
    return {"message": "Role updated (feature coming soon)"}


@router.delete("/members/{member_id}", status_code=204)
async def remove_member(
    member_id: str,
    current_user=Depends(get_current_active_user),
):
    """Remove a team member."""
    return None
