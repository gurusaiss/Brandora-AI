"""
Auth route tests: register, login, token refresh, me endpoint.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """Test successful user registration creates user, org, and returns tokens."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "securepassword123",
            "full_name": "Jane Doe",
            "organization_name": "Clean Future NGO",
            "sector": "sanitation",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["full_name"] == "Jane Doe"
    assert data["organization"]["name"] == "Clean Future NGO"
    assert data["organization"]["sector"] == "sanitation"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Test that registering with an existing email returns 422."""
    payload = {
        "email": "duplicate@example.com",
        "password": "password123",
        "full_name": "First User",
        "organization_name": "NGO One",
    }
    # First registration should succeed
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    # Second registration with same email should fail
    payload["organization_name"] = "NGO Two"
    r2 = await client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code in (422, 400)


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    """Test that a password shorter than 8 characters is rejected."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "weakpass@example.com",
            "password": "short",
            "full_name": "Test",
            "organization_name": "Test Org",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """Test successful login returns tokens."""
    # Register first
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "logintest@example.com",
            "password": "loginpassword123",
            "full_name": "Login User",
            "organization_name": "Login Org",
        },
    )

    # Then login
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "logintest@example.com", "password": "loginpassword123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Test that wrong password returns 401."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "wrongpass@example.com",
            "password": "correctpassword123",
            "full_name": "Wrong Pass User",
            "organization_name": "Wrong Pass Org",
        },
    )

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpass@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """Test that login with unknown email returns 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "somepassword123"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, auth_headers: dict):
    """Test /me returns the authenticated user's profile."""
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "email" in data
    assert "full_name" in data


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    """Test that /me returns 401 without a token."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_token_refresh(client: AsyncClient):
    """Test that a valid refresh token yields a new access token."""
    # Register to get tokens
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "refreshtest@example.com",
            "password": "refreshpassword123",
            "full_name": "Refresh User",
            "organization_name": "Refresh Org",
        },
    )
    refresh_token = reg.json()["refresh_token"]

    # Use refresh token
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_token_refresh_invalid_token(client: AsyncClient):
    """Test that an invalid refresh token returns 401."""
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "this.is.not.valid"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test the health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_forgot_password(client: AsyncClient):
    """Test forgot password always returns 202 (prevents email enumeration)."""
    # With existing email
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "forgottest@example.com",
            "password": "password123",
            "full_name": "Forgot User",
            "organization_name": "Forgot Org",
        },
    )
    r1 = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "forgottest@example.com"},
    )
    assert r1.status_code == 202

    # With non-existing email — should still return 202
    r2 = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "doesnotexist@example.com"},
    )
    assert r2.status_code == 202
