"""
API key management routes.
"""
from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_active_user

router = APIRouter()


@router.get("")
async def list_api_keys(current_user=Depends(get_current_active_user)):
    """List API keys for the current user."""
    return {"items": [], "total": 0}


@router.post("")
async def create_api_key(
    data: dict,
    current_user=Depends(get_current_active_user),
):
    """Create a new API key."""
    return {"message": "API key creation coming soon"}


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: str,
    current_user=Depends(get_current_active_user),
):
    """Revoke an API key."""
    return None
