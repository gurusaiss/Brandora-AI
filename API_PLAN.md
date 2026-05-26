# Brandora AI — Complete API Specification

> **Stack**: FastAPI (Python 3.11+), PostgreSQL via Supabase, Redis + Celery, OpenAI GPT-4o / Claude Sonnet 3.5 / Gemini Flash 1.5
> **Last Updated**: 2026-05-22
> **Version**: 1.0.0

---

## Table of Contents

1. [API Design Philosophy](#1-api-design-philosophy)
2. [Base URL Structure](#2-base-url-structure)
3. [Authentication](#3-authentication)
4. [Standard Response Format](#4-standard-response-format)
5. [Pagination](#5-pagination)
6. [Endpoint Specifications](#6-endpoint-specifications)
   - [Auth](#61-auth-module-apiv1auth)
   - [Organizations](#62-organizations-apiv1organizations)
   - [Brand Profile](#63-brand-profile-apiv1brand-profile)
   - [Content Generation](#64-content-generation-apiv1content)
   - [Campaigns](#65-campaigns-apiv1campaigns)
   - [Scheduling](#66-scheduling-apiv1schedule)
   - [Social Accounts](#67-social-accounts-apiv1social-accounts)
   - [Hashtags](#68-hashtags-apiv1hashtags)
   - [Festival Calendar](#69-festival-calendar-apiv1festivals)
   - [Analytics](#610-analytics-apiv1analytics)
   - [AI Usage](#611-ai-usage-apiv1ai)
   - [Admin](#612-admin-apiv1admin)
7. [WebSocket Endpoints](#7-websocket-endpoints)
8. [Webhook System](#8-webhook-system)
9. [Rate Limiting Strategy](#9-rate-limiting-strategy)
10. [API Versioning](#10-api-versioning)
11. [SDK Design](#11-sdk-design)
12. [FastAPI Project Structure](#12-fastapi-project-structure)

---

## 1. API Design Philosophy

### Core Principles

**RESTful Resource Modeling**
- Resources are nouns, not verbs. `/content/generate` is intentionally an action endpoint for AI generation; all others follow strict REST noun conventions.
- HTTP verbs carry semantic meaning: GET (read), POST (create), PUT (full replace), PATCH (partial update), DELETE (remove).
- State changes are always explicit and atomic.

**Multi-Tenant Isolation**
- Every authenticated request carries an implicit `org_id` extracted from the JWT. No cross-tenant data can ever be returned.
- Row-Level Security (RLS) in Supabase is the last line of defense; the application layer enforces it as well.
- Super-admin endpoints exist under `/api/v1/admin/` and require an elevated `is_superadmin` claim.

**Consistency Over Cleverness**
- All timestamps are ISO 8601 UTC: `2026-05-22T10:30:00Z`
- All IDs are UUIDs v4 strings
- Booleans are always `true`/`false`, never `1`/`0`
- Empty collections return `[]`, never `null`

**Fail Fast, Fail Loud**
- Validation errors return 422 with field-level details
- Auth errors always return the same shape to prevent enumeration
- 5xx errors never leak stack traces to the client

**Idempotency**
- PUT and DELETE operations are idempotent by design
- POST endpoints that could be called multiple times accept an optional `idempotency_key` header

---

## 2. Base URL Structure

```
Production:   https://api.brandora.ai/api/v1
Staging:      https://api-staging.brandora.ai/api/v1
Local Dev:    http://localhost:8000/api/v1
```

**OpenAPI / Swagger UI**
```
http://localhost:8000/docs          (interactive, development only)
http://localhost:8000/redoc         (read-only reference)
http://localhost:8000/openapi.json  (raw schema)
```

**Health Check** (unauthenticated)
```
GET /health
GET /health/detailed
```

---

## 3. Authentication

### 3.1 JWT Bearer Token (Primary)

All protected endpoints require:
```
Authorization: Bearer <access_token>
```

**JWT Payload Structure**
```json
{
  "sub": "user_uuid",
  "email": "user@org.com",
  "org_id": "org_uuid",
  "role": "admin | editor | viewer",
  "is_superadmin": false,
  "iat": 1748000000,
  "exp": 1748003600,
  "jti": "unique_token_id"
}
```

**Token Lifetimes**
| Token Type    | Lifetime     | Storage           |
|---------------|--------------|-------------------|
| Access Token  | 1 hour       | Memory / httpOnly cookie |
| Refresh Token | 30 days      | httpOnly cookie   |

### 3.2 API Key Authentication (Integrations)

For server-to-server integrations (Zapier, Make, custom webhooks):
```
X-API-Key: bai_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

API keys are:
- Scoped to an organization
- Rate-limited independently
- Revocable at any time
- Logged with every request for audit trail

**Key Format**: `bai_<env>_<32-char random hex>`
- `bai_live_` — production
- `bai_test_` — staging/testing

### 3.3 Tenant Header (Optional Override)

When a superadmin needs to act on behalf of an organization:
```
X-Organization-ID: org_uuid
```

This header is only honored when `is_superadmin: true` in the JWT.

---

## 4. Standard Response Format

### 4.1 Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_01J2K...",
    "timestamp": "2026-05-22T10:30:00Z",
    "version": "1.0.0"
  }
}
```

For paginated responses, `meta` also includes pagination fields (see Section 5).

### 4.2 Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "value": "not-an-email"
      }
    ]
  },
  "meta": {
    "request_id": "req_01J2K...",
    "timestamp": "2026-05-22T10:30:00Z"
  }
}
```

### 4.3 Standard Error Codes

| HTTP Status | Error Code                | Description                              |
|-------------|---------------------------|------------------------------------------|
| 400         | `BAD_REQUEST`             | Malformed request syntax                 |
| 401         | `UNAUTHORIZED`            | Missing or invalid auth token            |
| 403         | `FORBIDDEN`               | Authenticated but insufficient permission|
| 404         | `NOT_FOUND`               | Resource does not exist                  |
| 409         | `CONFLICT`                | Resource already exists / state conflict |
| 422         | `VALIDATION_ERROR`        | Request body/query param validation fail |
| 429         | `RATE_LIMIT_EXCEEDED`     | Too many requests                        |
| 500         | `INTERNAL_ERROR`          | Unexpected server error                  |
| 502         | `AI_SERVICE_UNAVAILABLE`  | Upstream AI API failure                  |
| 503         | `SERVICE_UNAVAILABLE`     | Planned maintenance                      |

---

## 5. Pagination

Brandora AI uses **cursor-based pagination** for all list endpoints. Offset pagination is explicitly avoided because:
- Content can be created between pages, causing duplication or skips with offset
- Cursor pagination is O(1) at the database level regardless of dataset size
- Supports real-time feeds cleanly

### 5.1 Request Parameters

```
GET /api/v1/content/history?limit=20&cursor=eyJpZCI6InV1aWQiLCJkaXJlY3Rpb24iOiJuZXh0In0=&sort=created_at&order=desc
```

| Parameter | Type    | Default | Description                              |
|-----------|---------|---------|------------------------------------------|
| `limit`   | integer | 20      | Items per page (max 100)                 |
| `cursor`  | string  | null    | Base64-encoded cursor from previous page |
| `sort`    | string  | `created_at` | Field to sort by                    |
| `order`   | string  | `desc`  | `asc` or `desc`                          |

### 5.2 Response Shape

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "limit": 20,
      "has_next": true,
      "has_prev": false,
      "next_cursor": "eyJpZCI6InV1aWQiLCJkaXJlY3Rpb24iOiJuZXh0In0=",
      "prev_cursor": null,
      "total_count": 247
    },
    "request_id": "req_01J2K...",
    "timestamp": "2026-05-22T10:30:00Z"
  }
}
```

### 5.3 Cursor Implementation

Cursors are opaque Base64-encoded JSON containing the last seen record's sort field value and ID:
```json
{"id": "uuid", "created_at": "2026-05-22T10:30:00Z", "direction": "next"}
```

The API converts this to a `WHERE (created_at, id) < (cursor_ts, cursor_id)` SQL clause, ensuring stable pagination even with concurrent inserts.

---

## 6. Endpoint Specifications

### 6.1 Auth Module (`/api/v1/auth`)

---

#### `POST /api/v1/auth/register`

**Description**: Register a new user and create their personal organization workspace.

**Auth Required**: No

**Rate Limit**: 10 requests / hour / IP

**Request Body**
```json
{
  "email": "priya@greenearth.org",
  "password": "SecurePass@2026",
  "full_name": "Priya Sharma",
  "organization_name": "Green Earth NGO",
  "organization_type": "ngo",
  "invite_token": "optional_invite_token"
}
```

| Field               | Type   | Required | Validation                                  |
|---------------------|--------|----------|---------------------------------------------|
| `email`             | string | Yes      | Valid email, max 254 chars                  |
| `password`          | string | Yes      | Min 8 chars, 1 uppercase, 1 number, 1 special|
| `full_name`         | string | Yes      | 2–100 chars                                 |
| `organization_name` | string | Yes (if no invite) | 2–100 chars                   |
| `organization_type` | enum   | Yes (if no invite) | `ngo`, `csr`, `agency`, `brand` |
| `invite_token`      | string | No       | If present, joins existing org instead      |

**Response `201 Created`**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "priya@greenearth.org",
      "full_name": "Priya Sharma",
      "created_at": "2026-05-22T10:30:00Z"
    },
    "organization": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Green Earth NGO",
      "type": "ngo",
      "slug": "green-earth-ngo"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
      "token_type": "bearer",
      "expires_in": 3600
    }
  }
}
```

**Error Codes**
- `409 CONFLICT` — Email already registered
- `422 VALIDATION_ERROR` — Invalid field values
- `400 BAD_REQUEST` — Invalid or expired invite token

---

#### `POST /api/v1/auth/login`

**Description**: Authenticate with email/password and receive JWT tokens.

**Auth Required**: No

**Rate Limit**: 20 requests / 15 min / IP (exponential backoff after 5 failed attempts)

**Request Body**
```json
{
  "email": "priya@greenearth.org",
  "password": "SecurePass@2026"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "priya@greenearth.org",
      "full_name": "Priya Sharma",
      "role": "admin",
      "org_id": "660e8400-e29b-41d4-a716-446655440001"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
      "token_type": "bearer",
      "expires_in": 3600
    }
  }
}
```

**Error Codes**
- `401 UNAUTHORIZED` — Invalid credentials (deliberately vague)
- `423 LOCKED` — Account locked after repeated failures (custom extension)

---

#### `POST /api/v1/auth/refresh`

**Description**: Exchange a valid refresh token for a new access/refresh token pair.

**Auth Required**: No (refresh token in body or httpOnly cookie)

**Rate Limit**: 60 requests / hour / user

**Request Body**
```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "bmV3IHJlZnJlc2ggdG9rZW4...",
    "token_type": "bearer",
    "expires_in": 3600
  }
}
```

**Error Codes**
- `401 UNAUTHORIZED` — Expired, revoked, or invalid refresh token

---

#### `POST /api/v1/auth/logout`

**Description**: Revoke the current refresh token (adds `jti` to Redis blocklist).

**Auth Required**: Bearer token

**Rate Limit**: 60 requests / hour / user

**Request Body**
```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

---

#### `POST /api/v1/auth/forgot-password`

**Description**: Send a password reset email. Always returns 200 to prevent email enumeration.

**Auth Required**: No

**Rate Limit**: 5 requests / hour / IP

**Request Body**
```json
{
  "email": "priya@greenearth.org"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "message": "If that email exists, a reset link has been sent."
  }
}
```

---

#### `POST /api/v1/auth/reset-password`

**Description**: Reset password using the token from the email link.

**Auth Required**: No

**Rate Limit**: 10 requests / hour / IP

**Request Body**
```json
{
  "token": "reset_token_from_email",
  "new_password": "NewSecurePass@2026"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": { "message": "Password reset successfully. Please log in." }
}
```

**Error Codes**
- `400 BAD_REQUEST` — Token expired (15 min TTL) or already used
- `422 VALIDATION_ERROR` — Password does not meet requirements

---

#### `GET /api/v1/auth/me`

**Description**: Retrieve the authenticated user's profile and current organization context.

**Auth Required**: Bearer token

**Rate Limit**: 120 requests / minute / user

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "priya@greenearth.org",
    "full_name": "Priya Sharma",
    "avatar_url": "https://cdn.brandora.ai/avatars/priya.jpg",
    "role": "admin",
    "organization": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Green Earth NGO",
      "type": "ngo",
      "plan": "pro",
      "plan_expires_at": "2027-05-22T00:00:00Z"
    },
    "permissions": ["content.generate", "campaigns.manage", "analytics.view"],
    "created_at": "2026-05-22T10:30:00Z",
    "last_login_at": "2026-05-22T10:30:00Z"
  }
}
```

---

### 6.2 Organizations (`/api/v1/organizations`)

---

#### `POST /api/v1/organizations`

**Description**: Create a new organization. The authenticated user becomes the owner.

**Auth Required**: Bearer token

**Rate Limit**: 5 per day / user

**Request Body**
```json
{
  "name": "Clean India Mission",
  "type": "csr",
  "website": "https://cleanindia.org",
  "description": "CSR wing focused on sanitation and WASH programs",
  "industry": "sanitation",
  "country": "IN",
  "logo_url": "https://cdn.brandora.ai/logos/cim.png"
}
```

**Response `201 Created`**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "Clean India Mission",
    "slug": "clean-india-mission",
    "type": "csr",
    "website": "https://cleanindia.org",
    "plan": "free",
    "created_at": "2026-05-22T10:30:00Z",
    "owner": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "priya@greenearth.org"
    }
  }
}
```

---

#### `GET /api/v1/organizations/{org_id}`

**Description**: Get organization details. Members can view; admins see billing info.

**Auth Required**: Bearer token (must be member of org)

**Path Parameters**: `org_id` (UUID)

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "Clean India Mission",
    "slug": "clean-india-mission",
    "type": "csr",
    "website": "https://cleanindia.org",
    "description": "CSR wing focused on sanitation",
    "plan": "pro",
    "member_count": 5,
    "content_generated_this_month": 127,
    "plan_limits": {
      "content_per_month": 500,
      "team_members": 10,
      "social_accounts": 5
    },
    "created_at": "2026-05-22T10:30:00Z"
  }
}
```

---

#### `PATCH /api/v1/organizations/{org_id}`

**Description**: Update organization profile. Requires `admin` role.

**Auth Required**: Bearer token (admin)

**Request Body** (all fields optional)
```json
{
  "name": "Clean India Mission 2.0",
  "website": "https://cleanindia2.org",
  "description": "Updated description",
  "logo_url": "https://cdn.brandora.ai/logos/cim2.png"
}
```

**Response `200 OK`**: Returns updated organization object.

---

#### `DELETE /api/v1/organizations/{org_id}`

**Description**: Permanently delete organization and all associated data. Requires owner role. Soft-deletes first, hard-deletes after 30-day grace period.

**Auth Required**: Bearer token (owner only)

**Request Body**
```json
{
  "confirmation": "DELETE clean-india-mission"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "message": "Organization scheduled for deletion on 2026-06-21T10:30:00Z",
    "deletion_date": "2026-06-21T10:30:00Z"
  }
}
```

---

#### `GET /api/v1/organizations/{org_id}/members`

**Description**: List all members and pending invites for an organization.

**Auth Required**: Bearer token (member)

**Query Parameters**: Standard pagination params

**Response `200 OK`**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "priya@greenearth.org",
      "full_name": "Priya Sharma",
      "role": "admin",
      "joined_at": "2026-05-22T10:30:00Z",
      "last_active_at": "2026-05-22T10:30:00Z",
      "status": "active"
    },
    {
      "invite_id": "inv_123",
      "email": "ravi@greenearth.org",
      "role": "editor",
      "invited_at": "2026-05-22T11:00:00Z",
      "expires_at": "2026-05-29T11:00:00Z",
      "status": "pending"
    }
  ]
}
```

---

#### `POST /api/v1/organizations/{org_id}/members/invite`

**Description**: Invite a user to join the organization via email.

**Auth Required**: Bearer token (admin)

**Rate Limit**: 20 invites / day / org

**Request Body**
```json
{
  "email": "ravi@greenearth.org",
  "role": "editor",
  "message": "Join our team on Brandora AI!"
}
```

**Response `201 Created`**
```json
{
  "success": true,
  "data": {
    "invite_id": "inv_abc123",
    "email": "ravi@greenearth.org",
    "role": "editor",
    "expires_at": "2026-05-29T10:30:00Z",
    "invite_link": "https://app.brandora.ai/invite/tok_xyz"
  }
}
```

---

#### `DELETE /api/v1/organizations/{org_id}/members/{user_id}`

**Description**: Remove a member from the organization. Owner cannot remove themselves.

**Auth Required**: Bearer token (admin)

**Response `200 OK`**
```json
{
  "success": true,
  "data": { "message": "Member removed successfully" }
}
```

---

### 6.3 Brand Profile (`/api/v1/brand-profile`)

All brand-profile endpoints implicitly scope to the org from the JWT.

---

#### `GET /api/v1/brand-profile`

**Description**: Retrieve the organization's brand profile including voice settings, mission, and visual identity.

**Auth Required**: Bearer token (member)

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "org_id": "660e8400-e29b-41d4-a716-446655440001",
    "brand_name": "Green Earth NGO",
    "tagline": "Clean Planet, Better Lives",
    "mission_statement": "Empowering communities with access to clean water and sanitation.",
    "target_audience": "Urban middle-class, CSR decision-makers, women aged 18-45",
    "key_themes": ["menstrual hygiene", "water sanitation", "community empowerment"],
    "tone_keywords": ["empathetic", "inspiring", "data-driven", "hopeful"],
    "avoid_keywords": ["shame", "dirty", "backward"],
    "primary_language": "en",
    "secondary_languages": ["hi", "ta"],
    "voice_profile_id": "vp_abc123",
    "voice_setup_complete": true,
    "updated_at": "2026-05-22T10:30:00Z"
  }
}
```

---

#### `PUT /api/v1/brand-profile`

**Description**: Full replace of brand profile (idempotent).

**Auth Required**: Bearer token (admin/editor)

**Request Body**
```json
{
  "brand_name": "Green Earth NGO",
  "tagline": "Clean Planet, Better Lives",
  "mission_statement": "Empowering communities with access to clean water and sanitation.",
  "target_audience": "Urban middle-class, CSR decision-makers, women aged 18-45",
  "key_themes": ["menstrual hygiene", "water sanitation", "community empowerment"],
  "tone_keywords": ["empathetic", "inspiring", "data-driven", "hopeful"],
  "avoid_keywords": ["shame", "dirty", "backward"],
  "primary_language": "en",
  "secondary_languages": ["hi", "ta"]
}
```

**Response `200 OK`**: Returns updated brand profile.

---

#### `POST /api/v1/brand-profile/voice/setup`

**Description**: Initial brand voice setup wizard — takes answers to guided questions and generates a voice profile using AI.

**Auth Required**: Bearer token (admin)

**Rate Limit**: 5 setups / day / org

**Request Body**
```json
{
  "brand_personality": "We are like a trusted community elder — wise, warm, and action-oriented.",
  "communication_style": "conversational",
  "formality_level": 3,
  "emoji_usage": "minimal",
  "hashtag_style": "concise",
  "content_pillars": [
    "Menstrual health education",
    "WASH (Water, Sanitation, Hygiene) advocacy",
    "Community success stories",
    "CSR partnerships"
  ],
  "sample_posts": [
    "Did you know 1 in 3 girls in India miss school during menstruation? We're changing that, one pad at a time. #MenstrualHygiene",
    "Clean water isn't a luxury — it's a right. Our latest project brought clean water to 500 families in Rajasthan."
  ]
}
```

**Response `201 Created`**
```json
{
  "success": true,
  "data": {
    "voice_profile_id": "vp_abc123",
    "summary": "Warm, authoritative, and mission-driven. Uses storytelling with impact data. Avoids corporate jargon. Prefers inclusive language.",
    "writing_style_guide": {
      "sentence_length": "medium (15-25 words)",
      "paragraph_length": "2-3 sentences",
      "preferred_structures": ["story-first", "data-backed"],
      "cta_style": "soft, community-inviting"
    },
    "content_archetypes": ["impact story", "awareness fact", "call-to-action", "community spotlight"],
    "generated_at": "2026-05-22T10:30:00Z"
  }
}
```

---

#### `GET /api/v1/brand-profile/voice`

**Description**: Retrieve the current voice profile.

**Auth Required**: Bearer token (member)

**Response `200 OK`**: Returns full voice profile object.

---

#### `PUT /api/v1/brand-profile/voice`

**Description**: Update voice profile settings manually.

**Auth Required**: Bearer token (admin/editor)

**Request Body**: Partial or full voice profile fields.

**Response `200 OK`**: Returns updated voice profile.

---

#### `POST /api/v1/brand-profile/voice/analyze-sample`

**Description**: Upload existing content (posts, articles) and let AI analyze and extract the brand voice automatically.

**Auth Required**: Bearer token (admin)

**Rate Limit**: 10 per day / org

**Request Body**
```json
{
  "samples": [
    {
      "platform": "linkedin",
      "content": "Proud to announce our 500th community toilet inauguration in Madhya Pradesh...",
      "engagement_score": 0.87
    },
    {
      "platform": "instagram",
      "content": "Every girl deserves dignity. Our MHM kits reached 2000 girls this month 💜",
      "engagement_score": 0.92
    }
  ],
  "merge_with_existing": true
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "detected_tone": ["empathetic", "celebratory", "data-driven"],
      "detected_style": "conversational with impact numbers",
      "detected_themes": ["community milestone", "girl empowerment", "WASH"],
      "emoji_frequency": "moderate",
      "avg_sentence_length": 18,
      "confidence_score": 0.89
    },
    "voice_profile_updated": true,
    "voice_profile_id": "vp_abc123"
  }
}
```

---

### 6.4 Content Generation (`/api/v1/content`)

Content generation endpoints use Celery for long-running tasks and return either synchronous results (< 5 seconds) or a task ID for polling/WebSocket streaming.

---

#### `POST /api/v1/content/generate`

**Description**: Main universal generation endpoint. Detects platform from request and routes to the appropriate AI model and prompt chain.

**Auth Required**: Bearer token (member with `content.generate` permission)

**Rate Limit**: Per plan tier (Free: 50/day, Pro: 500/day, Enterprise: unlimited)

**Request Body**
```json
{
  "platform": "linkedin",
  "content_type": "awareness_post",
  "topic": "World Menstrual Hygiene Day 2026",
  "additional_context": "Our organization distributed 10,000 MHM kits this month in Bihar",
  "tone_override": null,
  "include_hashtags": true,
  "include_emoji": true,
  "include_cta": true,
  "length": "medium",
  "language": "en",
  "festival_id": null,
  "campaign_id": null,
  "ai_model": "auto",
  "stream": false
}
```

| Field               | Type    | Required | Options / Validation                        |
|---------------------|---------|----------|---------------------------------------------|
| `platform`          | enum    | Yes      | `linkedin`, `instagram`, `twitter`, `facebook` |
| `content_type`      | enum    | Yes      | `awareness_post`, `csr_story`, `founder_post`, `carousel`, `reel_script`, `campaign_post` |
| `topic`             | string  | Yes      | 5–500 chars                                 |
| `additional_context`| string  | No       | Up to 2000 chars                            |
| `tone_override`     | string  | No       | Overrides brand voice for this generation   |
| `include_hashtags`  | boolean | No       | Default `true`                              |
| `include_emoji`     | boolean | No       | Default determined by brand voice           |
| `include_cta`       | boolean | No       | Default `true`                              |
| `length`            | enum    | No       | `short`, `medium`, `long` (platform-specific defaults) |
| `language`          | string  | No       | ISO 639-1 code, default from brand profile  |
| `ai_model`          | enum    | No       | `auto`, `gpt4o`, `claude_sonnet`, `gemini_flash` |
| `stream`            | boolean | No       | If `true`, returns `task_id` for WebSocket  |

**Response `200 OK` (synchronous)**
```json
{
  "success": true,
  "data": {
    "content_id": "cnt_01J2KXY...",
    "platform": "linkedin",
    "content_type": "awareness_post",
    "generated_text": "Tomorrow is World Menstrual Hygiene Day — and this year, we have something incredible to share.\n\nThis month alone, our team distributed 10,000 MHM kits across rural Bihar. That's 10,000 girls who can now stay in school, participate fully, and move through their days with dignity.\n\nBut numbers only tell part of the story. Behind each kit is a family that now has a conversation about health they never had before.\n\nThis is what CSR done right looks like: not charity, but change.\n\n#MenstrualHygieneDay #MHM #GirlsEducation #SanitationIndia #CSRIndia #WomensHealth",
    "hashtags": ["#MenstrualHygieneDay", "#MHM", "#GirlsEducation", "#SanitationIndia", "#CSRIndia", "#WomensHealth"],
    "character_count": 612,
    "estimated_engagement_score": 0.84,
    "ai_model_used": "claude_sonnet",
    "tokens_used": 487,
    "generation_time_ms": 2340,
    "created_at": "2026-05-22T10:30:00Z"
  }
}
```

**Response `202 Accepted` (when `stream: true`)**
```json
{
  "success": true,
  "data": {
    "task_id": "task_01J2KXY...",
    "status": "queued",
    "websocket_url": "wss://api.brandora.ai/ws/tasks/task_01J2KXY..."
  }
}
```

---

#### `POST /api/v1/content/generate/linkedin`

**Description**: LinkedIn-optimized generation. Pre-configured for LinkedIn's character limits, formatting (line breaks, no markdown), and engagement patterns.

**Auth Required**: Bearer token

**Rate Limit**: Same as `/generate`

**Request Body**
```json
{
  "topic": "Impact story from recent field visit",
  "content_subtype": "thought_leadership",
  "word_count_target": 300,
  "include_personal_story": true,
  "tag_people": ["@Priya Sharma", "@Ravi Kumar"],
  "context": "We visited 15 villages in Odisha last week and saw the impact firsthand"
}
```

**Response `200 OK`**: Same shape as `/generate` response.

---

#### `POST /api/v1/content/generate/instagram`

**Description**: Instagram-optimized generation. Returns caption + first-comment hashtag block strategy.

**Request Body**
```json
{
  "topic": "Menstrual hygiene kit distribution success story",
  "caption_style": "storytelling",
  "hashtag_strategy": "split",
  "first_comment_hashtags": true,
  "include_line_breaks": true,
  "image_description": "Women smiling while receiving hygiene kits at a community center"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "content_id": "cnt_01J2KXY...",
    "caption": "Change looks like this. ✨\n\nA smile that says — I no longer have to choose between school and staying home.\n\nThis week, we distributed 500 MHM kits at the Patna Community Center. The room was full of first-generation schoolgirls whose mothers never had this conversation.\n\nThis is why we do what we do. 💜\n\nTag a changemaker in your life 👇",
    "first_comment_hashtags": "#MenstrualHealth #MHM #GirlEmpowerment #SanitationIndia #HygieneMatter #WomensRights #CSRIndia #PeriodPositive #CleanIndia #NGOIndia",
    "character_count": 392,
    "platform": "instagram",
    "ai_model_used": "gpt4o"
  }
}
```

---

#### `POST /api/v1/content/generate/twitter`

**Description**: Twitter/X-optimized content. Handles thread generation and 280-char constraint.

**Request Body**
```json
{
  "topic": "5 myths about menstrual hygiene debunked",
  "format": "thread",
  "thread_length": 6,
  "include_poll": false
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "content_id": "cnt_01J2KXY...",
    "format": "thread",
    "tweets": [
      {
        "position": 1,
        "text": "5 myths about menstrual hygiene that are harming millions of girls in India. A thread 🧵👇",
        "character_count": 89
      },
      {
        "position": 2,
        "text": "MYTH 1: Menstruating women are 'impure'\n\nREALITY: Menstruation is a normal biological process. Cultural stigma — not biology — causes exclusion. #MenstrualHealth",
        "character_count": 163
      }
    ],
    "total_tweets": 6
  }
}
```

---

#### `POST /api/v1/content/generate/reel-script`

**Description**: Generate a short-form video script (Instagram Reel / YouTube Shorts) with hook, body, and CTA.

**Request Body**
```json
{
  "topic": "Why menstrual hygiene education belongs in school curricula",
  "duration_seconds": 30,
  "video_style": "talking_head",
  "include_b_roll_cues": true,
  "language": "en",
  "include_hindi_subtitles": false
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "content_id": "cnt_01J2KXY...",
    "script": {
      "hook": "[0-3s] HOOK: 'Did you know 23 million girls drop out of school every year because of their period?'",
      "body": "[3-22s] BODY: Quick cut to classroom. VO: 'In most Indian schools, menstruation is still a whispered word. But Green Earth NGO is changing that...' [B-ROLL: Teacher conducting MHM session] 'Our school program has reached 1200 schools — and the dropout rate in those schools? Down by 40%.'",
      "cta": "[22-30s] CTA: 'Share this if you believe every girl deserves to stay in school. Link in bio to support our mission.'"
    },
    "word_count": 97,
    "estimated_duration_seconds": 28,
    "b_roll_suggestions": ["classroom setting", "hygiene kit closeup", "smiling students", "impact data graphic"]
  }
}
```

---

#### `POST /api/v1/content/generate/carousel`

**Description**: Generate multi-slide carousel content for LinkedIn or Instagram.

**Request Body**
```json
{
  "topic": "10 facts about WASH access in India",
  "platform": "linkedin",
  "slide_count": 8,
  "visual_style": "data_heavy",
  "include_cover_slide": true,
  "include_cta_slide": true
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "content_id": "cnt_01J2KXY...",
    "slides": [
      {
        "slide_number": 1,
        "type": "cover",
        "headline": "10 Facts About WASH Access in India That Will Change How You See CSR",
        "subheadline": "Green Earth NGO — 2026 Impact Report",
        "visual_suggestion": "Bold typography on deep green background with water drop icon"
      },
      {
        "slide_number": 2,
        "type": "stat",
        "headline": "600 Million",
        "body": "Indians lack access to safe sanitation — that's 1 in 2 people.",
        "source": "WHO/UNICEF Joint Monitoring Programme 2024",
        "visual_suggestion": "Large number with people silhouette infographic"
      }
    ],
    "total_slides": 8,
    "platform": "linkedin"
  }
}
```

---

#### `POST /api/v1/content/generate/csr-story`

**Description**: Generate a long-form CSR impact narrative suitable for annual reports, press releases, and LinkedIn articles.

**Request Body**
```json
{
  "project_name": "Project Dignity — Bihar 2026",
  "impact_data": {
    "beneficiaries": 12000,
    "locations": ["Patna", "Gaya", "Muzaffarpur"],
    "duration_months": 6,
    "budget_inr": 4500000
  },
  "key_testimonial": "I used to stay home 5 days a month. Now I have never missed school — Ankita, 14",
  "format": "linkedin_article",
  "word_count": 600
}
```

**Response `200 OK`**: Returns structured long-form content.

---

#### `POST /api/v1/content/generate/founder-post`

**Description**: Generate a personal, first-person founder voice post. Uses a separate founder voice profile if configured.

**Request Body**
```json
{
  "platform": "linkedin",
  "topic": "Lessons from 5 years of WASH advocacy",
  "personal_anecdote": "I remember the first village we visited where there was no toilet for 300 families",
  "vulnerability_level": "high",
  "include_lessons": true
}
```

---

#### `POST /api/v1/content/repurpose`

**Description**: Transform existing content into formats for other platforms.

**Auth Required**: Bearer token

**Rate Limit**: 100 per day / org

**Request Body**
```json
{
  "source_content_id": "cnt_01J2KXY...",
  "source_text": "Optional: provide text directly instead of content_id",
  "source_platform": "linkedin",
  "target_platforms": ["instagram", "twitter"],
  "preserve_key_message": true
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "repurposed": [
      {
        "platform": "instagram",
        "content_id": "cnt_repurposed_001",
        "text": "Repurposed Instagram caption...",
        "hashtags": ["#MHM", "..."]
      },
      {
        "platform": "twitter",
        "content_id": "cnt_repurposed_002",
        "format": "thread",
        "tweets": [...]
      }
    ]
  }
}
```

---

#### `GET /api/v1/content/history`

**Description**: Paginated list of all generated content for the organization.

**Auth Required**: Bearer token

**Query Parameters**
| Param        | Type   | Description                                 |
|--------------|--------|---------------------------------------------|
| `platform`   | string | Filter by platform                          |
| `content_type` | string | Filter by content type                   |
| `saved_only` | boolean | Only show saved/bookmarked content         |
| `campaign_id`| uuid   | Filter by campaign                          |
| `date_from`  | date   | Filter from date (YYYY-MM-DD)               |
| `date_to`    | date   | Filter to date (YYYY-MM-DD)                 |
| Standard pagination params | | |

**Response `200 OK`**: Paginated list of content objects.

---

#### `GET /api/v1/content/{content_id}`

**Description**: Get a single generated content item.

**Auth Required**: Bearer token

**Response `200 OK`**: Full content object including generation metadata.

---

#### `DELETE /api/v1/content/{content_id}`

**Description**: Delete a content item.

**Auth Required**: Bearer token (editor who created it, or admin)

**Response `200 OK`**: Confirmation message.

---

#### `POST /api/v1/content/{content_id}/save`

**Description**: Toggle save/bookmark status on a content item.

**Auth Required**: Bearer token

**Request Body**
```json
{ "saved": true }
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": { "content_id": "cnt_01J2KXY...", "saved": true }
}
```

---

#### `POST /api/v1/content/{content_id}/feedback`

**Description**: Submit thumbs up/down feedback on a generation to improve AI prompts over time.

**Auth Required**: Bearer token

**Rate Limit**: 1 feedback per content_id per user

**Request Body**
```json
{
  "rating": "thumbs_up",
  "comment": "Great tone, exactly matches our brand voice",
  "issues": []
}
```

| Field    | Type   | Options                                                   |
|----------|--------|-----------------------------------------------------------|
| `rating` | enum   | `thumbs_up`, `thumbs_down`                                |
| `issues` | array  | `wrong_tone`, `off_topic`, `too_long`, `too_short`, `inaccurate_data`, `inappropriate` |

**Response `200 OK`**: Confirmation.

---

### 6.5 Campaigns (`/api/v1/campaigns`)

---

#### `POST /api/v1/campaigns`

**Description**: Create a new content campaign with defined goals, dates, and platform targets.

**Auth Required**: Bearer token (editor/admin)

**Request Body**
```json
{
  "name": "World MHD 2026 Campaign",
  "description": "28-day campaign leading up to May 28 — World Menstrual Hygiene Day",
  "start_date": "2026-05-01",
  "end_date": "2026-05-28",
  "platforms": ["linkedin", "instagram", "twitter"],
  "goals": {
    "impressions_target": 100000,
    "engagement_rate_target": 0.05
  },
  "tags": ["MHD2026", "flagship"],
  "status": "draft"
}
```

**Response `201 Created`**: Returns created campaign object.

---

#### `GET /api/v1/campaigns`

**Description**: List all campaigns for the organization.

**Query Parameters**: `status` (draft/active/completed/archived), standard pagination params.

**Response `200 OK`**: Paginated list of campaign summaries.

---

#### `GET /api/v1/campaigns/{campaign_id}`

**Description**: Get full campaign details including post count and performance summary.

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "id": "camp_01J2KXY...",
    "name": "World MHD 2026 Campaign",
    "status": "active",
    "start_date": "2026-05-01",
    "end_date": "2026-05-28",
    "platforms": ["linkedin", "instagram", "twitter"],
    "post_count": 14,
    "scheduled_count": 8,
    "published_count": 6,
    "performance": {
      "total_impressions": 47200,
      "total_engagements": 2380,
      "avg_engagement_rate": 0.050,
      "best_performing_post_id": "cnt_01J2KXY..."
    },
    "created_at": "2026-04-20T10:30:00Z"
  }
}
```

---

#### `PATCH /api/v1/campaigns/{campaign_id}`

**Description**: Update campaign metadata. Cannot change `start_date` if campaign is active.

**Request Body**: Any subset of campaign fields.

**Response `200 OK`**: Updated campaign object.

---

#### `DELETE /api/v1/campaigns/{campaign_id}`

**Description**: Archive or permanently delete a campaign. Scheduled posts are unscheduled.

**Response `200 OK`**: Confirmation.

---

#### `POST /api/v1/campaigns/{campaign_id}/posts`

**Description**: Add an existing content item to a campaign, or generate new content directly within the campaign context.

**Request Body**
```json
{
  "content_id": "cnt_01J2KXY...",
  "scheduled_for": "2026-05-10T09:00:00Z",
  "platform": "linkedin"
}
```

**Response `201 Created`**: Campaign post object.

---

#### `GET /api/v1/campaigns/{campaign_id}/posts`

**Description**: List all posts within a campaign.

**Response `200 OK`**: Paginated list of campaign posts with scheduling and performance data.

---

#### `POST /api/v1/campaigns/{campaign_id}/publish-all`

**Description**: Publish all draft posts in a campaign that have a scheduled time. Returns a task_id for progress tracking.

**Request Body**
```json
{
  "confirm": true,
  "skip_past_scheduled": true
}
```

**Response `202 Accepted`**
```json
{
  "success": true,
  "data": {
    "task_id": "task_publish_all_01J2K...",
    "posts_queued": 8,
    "estimated_completion": "2026-05-22T10:32:00Z"
  }
}
```

---

#### `GET /api/v1/campaigns/{campaign_id}/analytics`

**Description**: Aggregated analytics for all posts within a campaign, broken down by platform.

**Response `200 OK`**: Campaign analytics object (see Analytics section for shape).

---

### 6.6 Scheduling (`/api/v1/schedule`)

---

#### `POST /api/v1/schedule`

**Description**: Schedule a content item for future publication on a connected social account.

**Auth Required**: Bearer token (editor/admin)

**Rate Limit**: 500 scheduled posts / day / org

**Request Body**
```json
{
  "content_id": "cnt_01J2KXY...",
  "social_account_id": "sa_linkedin_001",
  "platform": "linkedin",
  "scheduled_at": "2026-05-28T09:00:00Z",
  "timezone": "Asia/Kolkata",
  "campaign_id": "camp_01J2KXY...",
  "first_comment": "What are your thoughts? Share below 👇",
  "notify_on_publish": true
}
```

**Response `201 Created`**
```json
{
  "success": true,
  "data": {
    "schedule_id": "sch_01J2KXY...",
    "content_id": "cnt_01J2KXY...",
    "platform": "linkedin",
    "social_account": {
      "id": "sa_linkedin_001",
      "handle": "Green Earth NGO",
      "platform": "linkedin"
    },
    "scheduled_at": "2026-05-28T09:00:00Z",
    "status": "scheduled",
    "created_at": "2026-05-22T10:30:00Z"
  }
}
```

---

#### `GET /api/v1/schedule`

**Description**: List all scheduled posts. Supports filtering by status, platform, and date range.

**Query Parameters**
| Param        | Type   | Description                              |
|--------------|--------|------------------------------------------|
| `status`     | enum   | `scheduled`, `published`, `failed`, `cancelled` |
| `platform`   | string | Filter by platform                       |
| `from_date`  | date   | Start of date range                      |
| `to_date`    | date   | End of date range                        |
| Standard pagination params | | |

**Response `200 OK`**: Paginated list of scheduled post objects.

---

#### `GET /api/v1/schedule/{schedule_id}`

**Description**: Get details for a specific scheduled post.

**Response `200 OK`**: Full scheduled post object.

---

#### `PATCH /api/v1/schedule/{schedule_id}`

**Description**: Reschedule or update a scheduled post. Only allowed if status is `scheduled`.

**Request Body**
```json
{
  "scheduled_at": "2026-05-29T11:00:00Z",
  "timezone": "Asia/Kolkata"
}
```

**Response `200 OK`**: Updated schedule object.

---

#### `DELETE /api/v1/schedule/{schedule_id}`

**Description**: Cancel a scheduled post. Sets status to `cancelled`; does not delete the content.

**Response `200 OK`**: Confirmation.

---

#### `POST /api/v1/schedule/bulk`

**Description**: Schedule multiple posts at once. Useful for campaign launches.

**Request Body**
```json
{
  "posts": [
    {
      "content_id": "cnt_001",
      "social_account_id": "sa_linkedin_001",
      "scheduled_at": "2026-05-01T09:00:00Z"
    },
    {
      "content_id": "cnt_002",
      "social_account_id": "sa_instagram_001",
      "scheduled_at": "2026-05-01T11:00:00Z"
    }
  ],
  "timezone": "Asia/Kolkata"
}
```

**Response `201 Created`**
```json
{
  "success": true,
  "data": {
    "scheduled_count": 2,
    "failed_count": 0,
    "schedule_ids": ["sch_001", "sch_002"]
  }
}
```

---

#### `GET /api/v1/schedule/calendar`

**Description**: Return calendar-view data for a given month — all scheduled posts grouped by date.

**Query Parameters**
| Param  | Type    | Description                              |
|--------|---------|------------------------------------------|
| `year` | integer | Calendar year (default: current)         |
| `month`| integer | Calendar month 1-12 (default: current)   |

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "year": 2026,
    "month": 5,
    "days": {
      "2026-05-01": [
        {
          "schedule_id": "sch_001",
          "platform": "linkedin",
          "content_preview": "Tomorrow is World Menstrual Hygiene Day...",
          "scheduled_at": "2026-05-01T09:00:00Z",
          "status": "scheduled"
        }
      ],
      "2026-05-10": [...]
    },
    "total_this_month": 14
  }
}
```

---

### 6.7 Social Accounts (`/api/v1/social-accounts`)

---

#### `GET /api/v1/social-accounts`

**Description**: List all connected social media accounts for the organization.

**Auth Required**: Bearer token

**Response `200 OK`**
```json
{
  "success": true,
  "data": [
    {
      "id": "sa_linkedin_001",
      "platform": "linkedin",
      "handle": "Green Earth NGO",
      "profile_url": "https://linkedin.com/company/green-earth-ngo",
      "avatar_url": "https://media.licdn.com/...",
      "status": "connected",
      "followers": 12400,
      "token_expires_at": "2026-11-22T10:30:00Z",
      "last_synced_at": "2026-05-22T09:00:00Z",
      "connected_at": "2026-01-15T10:30:00Z"
    },
    {
      "id": "sa_instagram_001",
      "platform": "instagram",
      "handle": "@greenearth_ngo",
      "status": "token_expired",
      "followers": 8200
    }
  ]
}
```

---

#### `POST /api/v1/social-accounts/connect/{platform}`

**Description**: Initiate OAuth flow for connecting a social media account. Returns the OAuth authorization URL.

**Auth Required**: Bearer token (admin)

**Path Parameters**: `platform` — `linkedin`, `instagram`, `twitter`, `facebook`

**Request Body**
```json
{
  "redirect_uri": "https://app.brandora.ai/settings/social-accounts",
  "scopes": ["w_member_social", "r_organization_social"]
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://www.linkedin.com/oauth/v2/authorization?client_id=...&state=csrf_token...",
    "state": "csrf_state_token",
    "expires_in_seconds": 600
  }
}
```

---

#### `GET /api/v1/social-accounts/callback/{platform}`

**Description**: OAuth callback handler. Called by the social platform after user authorization. Exchanges the code for tokens and saves the account.

**Auth Required**: State token in query (CSRF protection)

**Query Parameters**: `code`, `state`, `error` (if OAuth was denied)

**Response `302 Redirect`**: Redirects to frontend with success/error params.

---

#### `DELETE /api/v1/social-accounts/{account_id}`

**Description**: Disconnect a social media account. Cancels all pending scheduled posts for this account.

**Auth Required**: Bearer token (admin)

**Response `200 OK`**: Confirmation with count of cancelled scheduled posts.

---

#### `POST /api/v1/social-accounts/{account_id}/test`

**Description**: Verify the OAuth tokens are still valid and the account is accessible.

**Auth Required**: Bearer token

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "account_id": "sa_linkedin_001",
    "status": "connected",
    "api_response_ms": 342,
    "token_valid": true,
    "token_expires_at": "2026-11-22T10:30:00Z"
  }
}
```

---

#### `GET /api/v1/social-accounts/optimal-times`

**Description**: AI-powered analysis of historical engagement data to recommend optimal posting times per platform.

**Auth Required**: Bearer token

**Query Parameters**: `platform` (optional, returns all platforms if omitted)

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "linkedin": {
      "optimal_times": [
        { "day": "Tuesday", "time": "09:00", "timezone": "Asia/Kolkata", "confidence": 0.91 },
        { "day": "Wednesday", "time": "08:30", "timezone": "Asia/Kolkata", "confidence": 0.87 }
      ],
      "analysis_based_on": "Last 90 days, 47 posts"
    },
    "instagram": {
      "optimal_times": [
        { "day": "Friday", "time": "19:00", "timezone": "Asia/Kolkata", "confidence": 0.88 }
      ]
    }
  }
}
```

---

### 6.8 Hashtags (`/api/v1/hashtags`)

---

#### `POST /api/v1/hashtags/generate`

**Description**: Generate contextually relevant hashtags for given content using AI + platform trend data.

**Auth Required**: Bearer token

**Rate Limit**: 200 per day / org

**Request Body**
```json
{
  "content": "Today we completed our 1000th school MHM session in Bihar...",
  "platform": "instagram",
  "count": 25,
  "strategy": "mixed",
  "include_branded": true,
  "language": "en"
}
```

| Field            | Type    | Options                                                 |
|------------------|---------|---------------------------------------------------------|
| `strategy`       | enum    | `mixed` (niche+broad), `niche_only`, `trending_only`    |
| `include_branded`| boolean | Include org's branded hashtags from profile             |

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "hashtags": {
      "high_reach": ["#MenstrualHealth", "#GirlsEducation", "#India"],
      "medium_reach": ["#MHM", "#SanitationIndia", "#PeriodPositive"],
      "niche": ["#MenstrualHygieneManagement", "#WASHIndia", "#SchoolSanitation"],
      "branded": ["#GreenEarthNGO", "#Project1000"]
    },
    "recommended_set": "#MenstrualHealth #MHM #GirlsEducation #SanitationIndia #PeriodPositive #MenstrualHygieneManagement #WASHIndia #SchoolSanitation #GreenEarthNGO",
    "total_count": 9,
    "estimated_reach_multiplier": 2.4
  }
}
```

---

#### `POST /api/v1/hashtags/analyze`

**Description**: Analyze the performance potential and reach of a given set of hashtags.

**Request Body**
```json
{
  "hashtags": ["#MenstrualHealth", "#PeriodPositive", "#SanitationIndia"],
  "platform": "instagram"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "analysis": [
      {
        "hashtag": "#MenstrualHealth",
        "post_count": 2400000,
        "avg_daily_posts": 1200,
        "competitiveness": "high",
        "recommended": true
      }
    ],
    "overall_score": 7.2,
    "recommendation": "Good mix. Consider replacing #SanitationIndia with a more niche variant."
  }
}
```

---

#### `GET /api/v1/hashtags/trending/{platform}`

**Description**: Get currently trending hashtags relevant to sanitation/MHM/CSR topics on the given platform.

**Path Parameters**: `platform` — `instagram`, `linkedin`, `twitter`

**Query Parameters**: `category` (optional) — `mhm`, `wash`, `csr`, `ngo`, `general`

**Response `200 OK`**: List of trending hashtags with post counts.

---

#### `GET /api/v1/hashtags/sets`

**Description**: List all saved hashtag sets for the organization.

**Response `200 OK`**: Paginated list of hashtag sets.

---

#### `POST /api/v1/hashtags/sets`

**Description**: Save a hashtag set for reuse.

**Request Body**
```json
{
  "name": "MHM Core Set",
  "description": "Core hashtags for menstrual hygiene content",
  "hashtags": ["#MenstrualHealth", "#MHM", "#PeriodPositive", "#GirlEmpowerment"],
  "platform": "instagram",
  "tags": ["mhm", "default"]
}
```

**Response `201 Created`**: Created hashtag set object.

---

#### `PUT /api/v1/hashtags/sets/{set_id}`

**Description**: Update a saved hashtag set.

**Response `200 OK`**: Updated hashtag set.

---

#### `DELETE /api/v1/hashtags/sets/{set_id}`

**Description**: Delete a saved hashtag set.

**Response `200 OK`**: Confirmation.

---

#### `GET /api/v1/hashtags/suggestions`

**Description**: Context-aware hashtag suggestions based on recent content and platform performance.

**Query Parameters**: `context` (string, optional), `platform`

**Response `200 OK`**: List of suggested hashtags with relevance scores.

---

### 6.9 Festival Calendar (`/api/v1/festivals`)

The festival calendar is pre-populated with global and India-specific awareness days, health observances, CSR dates, and social causes.

---

#### `GET /api/v1/festivals`

**Description**: List all festivals, awareness days, and observances relevant to the organization's themes.

**Query Parameters**
| Param       | Type   | Description                                     |
|-------------|--------|-------------------------------------------------|
| `month`     | integer| Filter by month                                 |
| `year`      | integer| Filter by year (default: current)               |
| `category`  | string | `mhm`, `wash`, `health`, `environment`, `women`, `csr`, `national`, `international` |
| `relevance` | float  | Minimum relevance score (0-1) for org's themes  |

**Response `200 OK`**
```json
{
  "success": true,
  "data": [
    {
      "id": "fest_mhd_2026",
      "name": "World Menstrual Hygiene Day",
      "date": "2026-05-28",
      "category": "mhm",
      "relevance_score": 1.0,
      "description": "Global awareness day to break taboos around menstruation",
      "recommended_content_types": ["awareness_post", "carousel", "reel_script"],
      "recommended_platforms": ["instagram", "linkedin", "twitter"],
      "hashtags": ["#MenstrualHygieneDay", "#MHD2026", "#MenstrualHealth"],
      "content_generated_count": 3,
      "days_until": 6
    }
  ]
}
```

---

#### `GET /api/v1/festivals/{festival_id}`

**Description**: Get full details for a specific festival or awareness day.

**Response `200 OK`**: Full festival object with history, statistics, and content ideas.

---

#### `POST /api/v1/festivals/{festival_id}/generate-content`

**Description**: One-click content generation specifically optimized for this festival. Generates content for all configured platforms.

**Auth Required**: Bearer token

**Request Body**
```json
{
  "platforms": ["linkedin", "instagram"],
  "include_campaign": true,
  "campaign_name": "MHD 2026 Campaign"
}
```

**Response `201 Created`**
```json
{
  "success": true,
  "data": {
    "generated_count": 2,
    "content_ids": ["cnt_001", "cnt_002"],
    "campaign_id": "camp_mhd2026",
    "content": [
      {
        "platform": "linkedin",
        "content_id": "cnt_001",
        "preview": "Today, the world observes Menstrual Hygiene Day..."
      }
    ]
  }
}
```

---

#### `GET /api/v1/festivals/upcoming`

**Description**: Get the next 30 days of awareness days and festivals, sorted by date.

**Response `200 OK`**: List of upcoming festival objects.

---

#### `POST /api/v1/festivals/custom`

**Description**: Add a custom organizational milestone or date to the calendar (product launches, event anniversaries, etc.).

**Auth Required**: Bearer token (admin)

**Request Body**
```json
{
  "name": "Organization Founding Anniversary",
  "date": "2026-07-15",
  "is_recurring": true,
  "recurrence": "annually",
  "category": "organizational",
  "notes": "Celebrate our 8th anniversary with impact stories"
}
```

**Response `201 Created`**: Created custom festival object.

---

### 6.10 Analytics (`/api/v1/analytics`)

---

#### `GET /api/v1/analytics/overview`

**Description**: Dashboard-level metrics overview for the last 30 days (default).

**Auth Required**: Bearer token

**Query Parameters**: `from_date`, `to_date`, `platform` (optional)

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2026-04-22",
      "to": "2026-05-22"
    },
    "summary": {
      "total_posts_published": 47,
      "total_impressions": 284700,
      "total_engagements": 14230,
      "avg_engagement_rate": 0.050,
      "total_reach": 198000,
      "follower_growth": 1240
    },
    "by_platform": {
      "linkedin": {
        "posts": 18,
        "impressions": 142000,
        "engagement_rate": 0.063
      },
      "instagram": {
        "posts": 21,
        "impressions": 98000,
        "engagement_rate": 0.041
      },
      "twitter": {
        "posts": 8,
        "impressions": 44700,
        "engagement_rate": 0.028
      }
    },
    "content_generated_count": 127,
    "top_performing_post": {
      "content_id": "cnt_01J2KXY...",
      "platform": "linkedin",
      "preview": "Tomorrow is World Menstrual Hygiene Day...",
      "engagement_rate": 0.112
    }
  }
}
```

---

#### `GET /api/v1/analytics/content-performance`

**Description**: Performance data for individual content items, sortable by engagement, reach, or clicks.

**Query Parameters**: `sort_by` (impressions/engagement_rate/reach/clicks), `from_date`, `to_date`, `platform`, standard pagination.

**Response `200 OK`**: Paginated list of content items with performance metrics.

---

#### `GET /api/v1/analytics/platform/{platform}`

**Description**: Deep-dive analytics for a specific platform.

**Path Parameters**: `platform`

**Response `200 OK`**: Platform-specific metrics including follower demographics, best posting times, content type breakdown.

---

#### `GET /api/v1/analytics/campaigns/{campaign_id}`

**Description**: Aggregated analytics for all posts in a campaign.

**Response `200 OK`**: Campaign analytics object.

---

#### `POST /api/v1/analytics/sync`

**Description**: Trigger a manual sync of analytics from connected social platforms. Returns a task_id.

**Auth Required**: Bearer token (admin)

**Rate Limit**: 1 manual sync per platform per 15 minutes

**Request Body**
```json
{
  "platforms": ["linkedin", "instagram"],
  "from_date": "2026-05-01"
}
```

**Response `202 Accepted`**
```json
{
  "success": true,
  "data": {
    "task_id": "task_sync_analytics_01J2K...",
    "platforms_syncing": ["linkedin", "instagram"],
    "estimated_duration_seconds": 45
  }
}
```

---

#### `GET /api/v1/analytics/insights`

**Description**: AI-generated natural language insights about content performance trends.

**Auth Required**: Bearer token

**Rate Limit**: 10 per day / org

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "generated_at": "2026-05-22T10:30:00Z",
    "insights": [
      {
        "type": "trend_positive",
        "title": "LinkedIn Engagement Surging",
        "body": "Your LinkedIn engagement rate increased by 34% this month. Posts that include specific impact numbers (e.g., '10,000 kits distributed') consistently outperform posts without data by 2.3x.",
        "actionable_recommendation": "Include a specific impact metric in every LinkedIn post."
      },
      {
        "type": "opportunity",
        "title": "Instagram Posting Frequency Below Optimal",
        "body": "Accounts in your category that post 5-7 times/week see 28% higher follower growth. You're currently averaging 2.4 posts/week.",
        "actionable_recommendation": "Increase Instagram posting frequency to at least 4-5 times per week."
      }
    ],
    "period_analyzed": "Last 90 days"
  }
}
```

---

### 6.11 AI Usage (`/api/v1/ai`)

---

#### `GET /api/v1/ai/usage`

**Description**: Token usage and estimated costs for the current billing period.

**Auth Required**: Bearer token (admin)

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "billing_period": {
      "from": "2026-05-01",
      "to": "2026-05-31"
    },
    "total_tokens_used": 847200,
    "estimated_cost_usd": 4.24,
    "plan_token_limit": 5000000,
    "usage_percentage": 16.9,
    "by_model": {
      "gpt4o": { "tokens": 423600, "cost_usd": 2.12 },
      "claude_sonnet": { "tokens": 312400, "cost_usd": 1.56 },
      "gemini_flash": { "tokens": 111200, "cost_usd": 0.56 }
    }
  }
}
```

---

#### `GET /api/v1/ai/usage/breakdown`

**Description**: Detailed token usage breakdown by feature, user, and day.

**Query Parameters**: `group_by` (feature/user/day/model), `from_date`, `to_date`

**Response `200 OK`**: Detailed breakdown object matching the grouping requested.

---

#### `POST /api/v1/ai/feedback/{generation_id}`

**Description**: Submit detailed feedback on a specific AI generation to improve model routing and prompts.

**Request Body**
```json
{
  "quality_score": 4,
  "issues": ["slightly_off_tone"],
  "preferred_model": "claude_sonnet",
  "notes": "GPT-4o was more creative but Claude Sonnet matched our tone better"
}
```

**Response `200 OK`**: Confirmation.

---

### 6.12 Admin (`/api/v1/admin`)

All admin endpoints require `is_superadmin: true` in the JWT. They are rate-limited and fully audited.

---

#### `GET /api/v1/admin/organizations`

**Description**: List all organizations across the platform with usage stats.

**Query Parameters**: Standard pagination, `plan`, `status`, `type`

**Response `200 OK`**: Paginated list of organization objects with usage metrics.

---

#### `GET /api/v1/admin/users`

**Description**: List all users across the platform.

**Query Parameters**: Standard pagination, `org_id`, `role`

**Response `200 OK`**: Paginated list of user objects.

---

#### `GET /api/v1/admin/ai-usage`

**Description**: Platform-wide AI usage and cost aggregation.

**Query Parameters**: `from_date`, `to_date`, `group_by` (org/model/day)

**Response `200 OK`**: Aggregated AI usage report.

---

#### `GET /api/v1/admin/system-health`

**Description**: System health dashboard — database, Redis, Celery workers, external API status.

**Response `200 OK`**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checked_at": "2026-05-22T10:30:00Z",
    "services": {
      "database": { "status": "healthy", "latency_ms": 8, "connections_active": 12 },
      "redis": { "status": "healthy", "latency_ms": 2, "memory_used_mb": 142 },
      "celery_workers": { "status": "healthy", "workers_active": 3, "queue_length": 7 },
      "openai_api": { "status": "healthy", "latency_ms": 423 },
      "anthropic_api": { "status": "healthy", "latency_ms": 387 },
      "google_ai_api": { "status": "degraded", "latency_ms": 1240, "note": "Elevated latency" }
    },
    "uptime_seconds": 1847293
  }
}
```

---

## 7. WebSocket Endpoints

WebSockets are used exclusively for real-time AI content generation streaming (Server-Sent Events would also work but WebSocket allows bidirectional communication for cancellation).

### 7.1 Task Streaming

```
WSS /ws/tasks/{task_id}
```

**Auth**: `token` query parameter (short-lived WebSocket token obtained from `/auth/me`)

**Connection Flow**
```
Client  →  Server: Connect with auth token
Server  →  Client: {"type": "connected", "task_id": "task_01J2K..."}
Server  →  Client: {"type": "status", "status": "generating", "progress": 0}
Server  →  Client: {"type": "chunk", "text": "Today marks a ", "cumulative": "Today marks a "}
Server  →  Client: {"type": "chunk", "text": "milestone for", "cumulative": "Today marks a milestone for"}
...
Server  →  Client: {"type": "complete", "content_id": "cnt_01J2K...", "full_text": "...", "metadata": {...}}
```

**Cancellation**
```
Client  →  Server: {"type": "cancel"}
Server  →  Client: {"type": "cancelled", "partial_content_id": "cnt_partial_01J2K..."}
```

### 7.2 Message Types

| Type             | Direction     | Description                              |
|------------------|---------------|------------------------------------------|
| `connected`      | Server→Client | Connection established                   |
| `status`         | Server→Client | Task status update                       |
| `chunk`          | Server→Client | Streamed text chunk                      |
| `complete`       | Server→Client | Generation complete with full content    |
| `error`          | Server→Client | Generation failed                        |
| `cancel`         | Client→Server | Request cancellation                     |
| `cancelled`      | Server→Client | Cancellation confirmed                   |
| `heartbeat`      | Server→Client | Keep-alive every 15 seconds              |

---

## 8. Webhook System

Brandora AI sends outgoing webhooks for key events, enabling integrations with Zapier, Make, Slack, and custom systems.

### 8.1 Webhook Configuration

```
POST /api/v1/webhooks          — Register webhook endpoint
GET /api/v1/webhooks           — List registered webhooks
GET /api/v1/webhooks/{id}      — Get webhook details
PATCH /api/v1/webhooks/{id}    — Update webhook
DELETE /api/v1/webhooks/{id}   — Delete webhook
GET /api/v1/webhooks/{id}/logs — View recent deliveries
POST /api/v1/webhooks/{id}/test — Send test event
```

### 8.2 Event Types

| Event                          | Description                              |
|-------------------------------|------------------------------------------|
| `content.generated`           | New content was generated                |
| `content.saved`               | Content was bookmarked                   |
| `post.scheduled`              | Post was scheduled                       |
| `post.published`              | Post was successfully published          |
| `post.failed`                 | Post publishing failed                   |
| `campaign.started`            | Campaign became active                   |
| `campaign.completed`          | Campaign end date reached                |
| `analytics.synced`            | Analytics sync completed                 |
| `member.invited`              | Team member invited                      |
| `member.joined`               | Team member accepted invite              |
| `plan.upgraded`               | Organization upgraded plan               |

### 8.3 Webhook Payload

```json
{
  "webhook_id": "wh_01J2KXY...",
  "event": "post.published",
  "org_id": "660e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2026-05-22T10:30:00Z",
  "data": {
    "schedule_id": "sch_01J2KXY...",
    "content_id": "cnt_01J2KXY...",
    "platform": "linkedin",
    "published_url": "https://linkedin.com/posts/green-earth-ngo_abc123"
  },
  "signature": "sha256=hmac_signature_here"
}
```

### 8.4 Signature Verification

Every webhook is signed with HMAC-SHA256 using the webhook secret:
```
X-Brandora-Signature: sha256=<hmac-sha256(payload_body, webhook_secret)>
X-Brandora-Timestamp: 1748000000
```

Recipients should verify both the signature and timestamp (reject if > 5 minutes old).

### 8.5 Retry Policy

- Failed deliveries (non-2xx or timeout) are retried with exponential backoff
- Retry schedule: 1 min, 5 min, 30 min, 2 hours, 12 hours
- Maximum 5 retry attempts
- Webhook is automatically paused after 10 consecutive failures

---

## 9. Rate Limiting Strategy

### 9.1 Rate Limiting Architecture

Rate limiting is implemented in two layers:
1. **Nginx/Traefik** — IP-level rate limiting (DDoS protection)
2. **FastAPI middleware + Redis** — Application-level per-user/per-org rate limiting

### 9.2 Rate Limit Headers

Every response includes:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1748003600
X-RateLimit-Window: 3600
Retry-After: 1748003600   (only on 429 responses)
```

### 9.3 Rate Limits by Tier

| Endpoint Category        | Free Plan   | Pro Plan    | Enterprise  |
|--------------------------|-------------|-------------|-------------|
| Auth (login/register)    | 20/15min IP | 20/15min IP | 20/15min IP |
| Content Generation       | 20/day      | 200/day     | 2000/day    |
| Content Repurpose        | 10/day      | 100/day     | 1000/day    |
| AI Endpoints (combined)  | 50/day      | 500/day     | 5000/day    |
| Analytics Sync           | 3/day       | 10/day      | Unlimited   |
| Social Account Connect   | 3/day       | 10/day      | Unlimited   |
| Hashtag Generation       | 30/day      | 200/day     | 2000/day    |
| API Keys (integration)   | 1000/day    | 10000/day   | 100000/day  |
| Webhooks                 | N/A         | 5 webhooks  | Unlimited   |
| General Read Endpoints   | 1000/hour   | 5000/hour   | 50000/hour  |

### 9.4 Rate Limit Keys

```python
# Per user
f"rl:user:{user_id}:{endpoint_group}"

# Per organization
f"rl:org:{org_id}:{endpoint_group}"

# Per IP (unauthenticated)
f"rl:ip:{ip_address}:{endpoint_group}"

# Per API key
f"rl:apikey:{api_key_hash}:{endpoint_group}"
```

### 9.5 Graduated Response on Repeated 429s

After a client receives 5 consecutive 429s within an hour, the window is extended:
- 6th request: 2x backoff window
- 10th request: Temporary IP block (1 hour)
- Abuse detection: Alert sent to admin, possible account review

---

## 10. API Versioning

### 10.1 Versioning Strategy

Brandora AI uses **URL path versioning**: `/api/v1/`, `/api/v2/`, etc.

This is chosen over header versioning because:
- URLs are cacheable and shareable
- Easier to test with browsers and curl
- Clearer mental model for API consumers

### 10.2 Compatibility Policy

| Change Type                          | Version Bump? | Notice Period |
|--------------------------------------|---------------|---------------|
| Add new endpoint                     | No            | None          |
| Add optional field to request        | No            | None          |
| Add new field to response            | No            | None          |
| Change field type or semantics       | Yes (major)   | 6 months      |
| Remove endpoint                      | Yes (major)   | 6 months      |
| Remove or rename response field      | Yes (major)   | 6 months      |
| Change authentication mechanism      | Yes (major)   | 6 months      |
| New required request field           | Yes (major)   | 6 months      |
| Change error codes/shapes            | Yes (major)   | 6 months      |

### 10.3 Deprecation Process

1. Annotate deprecated endpoints with `X-Deprecated: true` header and `deprecation_notice` in response meta
2. Publish migration guide in docs
3. Send email notification to all API key holders
4. Sunset date in `Sunset` response header: `Sunset: Sat, 22 May 2027 00:00:00 GMT`
5. After sunset: return `410 Gone` with helpful error message pointing to new endpoint

### 10.4 Version Negotiation

```
GET /api/v1/content/history   → Uses v1 explicitly
GET /api/content/history      → Not supported (always use versioned path)
GET /api/latest/content/history → Not supported (use explicit version)
```

---

## 11. SDK Design

### 11.1 TypeScript SDK (Future)

```typescript
// Installation
// npm install @brandora/sdk

import { BrandoraClient } from '@brandora/sdk';

const client = new BrandoraClient({
  apiKey: process.env.BRANDORA_API_KEY,
  baseUrl: 'https://api.brandora.ai',
  timeout: 30000,
  retries: 3,
});

// Generate content
const content = await client.content.generate({
  platform: 'linkedin',
  contentType: 'awareness_post',
  topic: 'World Menstrual Hygiene Day',
  stream: false,
});

// Streaming generation
const stream = client.content.generateStream({
  platform: 'instagram',
  topic: 'MHM kit distribution story',
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}

// Campaign management
const campaign = await client.campaigns.create({
  name: 'MHD 2026',
  startDate: new Date('2026-05-01'),
  endDate: new Date('2026-05-28'),
  platforms: ['linkedin', 'instagram'],
});

// Schedule a post
await client.schedule.create({
  contentId: content.data.contentId,
  socialAccountId: 'sa_linkedin_001',
  scheduledAt: new Date('2026-05-28T09:00:00Z'),
  timezone: 'Asia/Kolkata',
});
```

**SDK Features**
- Full TypeScript types generated from OpenAPI schema
- Automatic token refresh
- Configurable retry with exponential backoff
- WebSocket streaming helpers
- React hooks package: `@brandora/react`
- Pagination helpers with `AsyncIterator` support

### 11.2 Python SDK (Future)

```python
# pip install brandora-sdk

from brandora import BrandoraClient, ContentType, Platform

client = BrandoraClient(
    api_key=os.environ["BRANDORA_API_KEY"],
    base_url="https://api.brandora.ai",
)

# Synchronous generation
content = client.content.generate(
    platform=Platform.LINKEDIN,
    content_type=ContentType.AWARENESS_POST,
    topic="World Menstrual Hygiene Day",
)

# Async streaming
async def generate_async():
    async with client.content.generate_stream(
        platform=Platform.INSTAGRAM,
        topic="Impact story",
    ) as stream:
        async for chunk in stream:
            print(chunk.text, end="", flush=True)

# Pagination helpers
for page in client.content.history.paginate(limit=50):
    for item in page:
        print(item.content_id)
```

---

## 12. FastAPI Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── routes/
│   │           ├── __init__.py          # APIRouter aggregation
│   │           ├── auth.py              # /auth/* endpoints
│   │           ├── organizations.py     # /organizations/* endpoints
│   │           ├── brand_profile.py     # /brand-profile/* endpoints
│   │           ├── content.py           # /content/* endpoints
│   │           ├── campaigns.py         # /campaigns/* endpoints
│   │           ├── schedule.py          # /schedule/* endpoints
│   │           ├── social_accounts.py   # /social-accounts/* endpoints
│   │           ├── hashtags.py          # /hashtags/* endpoints
│   │           ├── festivals.py         # /festivals/* endpoints
│   │           ├── analytics.py         # /analytics/* endpoints
│   │           ├── ai_usage.py          # /ai/* endpoints
│   │           ├── admin.py             # /admin/* endpoints
│   │           └── webhooks.py          # /webhooks/* endpoints
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                    # Pydantic Settings, env var loading
│   │   ├── security.py                  # JWT creation/validation, password hashing
│   │   ├── dependencies.py              # FastAPI Depends() — current_user, db, redis
│   │   ├── exceptions.py                # Custom exception classes + handlers
│   │   ├── middleware.py                # Rate limiting, request logging, tenant isolation
│   │   └── database.py                  # SQLAlchemy async engine + session factory
│   ├── models/
│   │   ├── __init__.py
│   │   ├── auth.py                      # Pydantic request/response models for auth
│   │   ├── organization.py
│   │   ├── brand_profile.py
│   │   ├── content.py
│   │   ├── campaign.py
│   │   ├── schedule.py
│   │   ├── social_account.py
│   │   ├── hashtag.py
│   │   ├── festival.py
│   │   ├── analytics.py
│   │   └── common.py                    # Shared Pydantic models (pagination, responses)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py                      # SQLAlchemy ORM models
│   │   ├── organization.py
│   │   ├── brand_profile.py
│   │   ├── content.py
│   │   ├── campaign.py
│   │   ├── schedule.py
│   │   ├── social_account.py
│   │   ├── hashtag.py
│   │   ├── festival.py
│   │   ├── analytics.py
│   │   └── ai_usage.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ai_service.py                # Multi-model AI router (GPT-4o/Claude/Gemini)
│   │   ├── content_service.py           # Content generation orchestration
│   │   ├── campaign_service.py          # Campaign CRUD + analytics aggregation
│   │   ├── scheduler_service.py         # Post scheduling logic + Celery coordination
│   │   ├── analytics_service.py         # Analytics aggregation + AI insights
│   │   ├── social_publisher_service.py  # Platform-specific publishing (LinkedIn/IG/Twitter)
│   │   ├── hashtag_service.py           # Hashtag generation + analysis
│   │   ├── festival_service.py          # Calendar management + content hooks
│   │   ├── organization_service.py      # Org CRUD + member management
│   │   ├── auth_service.py              # Login/register/token management
│   │   ├── brand_profile_service.py     # Brand voice + profile management
│   │   └── webhook_service.py           # Outgoing webhook dispatch + retry
│   ├── workers/
│   │   ├── __init__.py
│   │   ├── celery_app.py                # Celery app configuration
│   │   ├── content_tasks.py             # generate_content_async, repurpose_content
│   │   ├── scheduler_tasks.py           # publish_scheduled_post, check_due_posts
│   │   ├── analytics_tasks.py           # sync_platform_analytics, generate_insights
│   │   └── maintenance_tasks.py         # Cleanup, token refresh, health checks
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── prompt_builder.py            # Builds AI prompts from brand profile + context
│   │   ├── model_router.py              # Selects optimal AI model per request type
│   │   ├── voice_injector.py            # Injects brand voice into prompts
│   │   ├── platform_formatter.py        # Platform-specific content formatting rules
│   │   ├── token_counter.py             # Estimate token counts before API calls
│   │   └── cursor_pagination.py         # Cursor encoding/decoding utilities
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── openai_client.py             # OpenAI API wrapper with retry + cost tracking
│   │   ├── anthropic_client.py          # Anthropic API wrapper
│   │   ├── gemini_client.py             # Google Gemini API wrapper
│   │   ├── linkedin_api.py              # LinkedIn OAuth + Publishing API
│   │   ├── instagram_api.py             # Instagram Graph API
│   │   └── twitter_api.py               # Twitter API v2
│   └── main.py                          # FastAPI app factory, middleware registration
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 001_initial_schema.py
├── tests/
│   ├── conftest.py                       # Shared fixtures
│   ├── unit/
│   │   ├── test_auth_service.py
│   │   ├── test_content_service.py
│   │   ├── test_prompt_builder.py
│   │   └── test_model_router.py
│   └── integration/
│       ├── test_auth_endpoints.py
│       ├── test_content_endpoints.py
│       └── test_campaign_endpoints.py
├── .env.example
├── alembic.ini
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
└── README.md
```

### 12.1 Key Module Descriptions

**`app/core/config.py`** — Uses `pydantic-settings` to load all environment variables with type validation. Single source of truth for all config.

**`app/core/dependencies.py`** — FastAPI dependency injection:
- `get_db()` — Async database session
- `get_redis()` — Redis connection
- `get_current_user()` — Validates JWT, fetches user
- `get_current_active_user()` — Ensures user is not suspended
- `require_org_admin()` — Validates admin role
- `require_superadmin()` — Validates superadmin claim

**`app/utils/model_router.py`** — Selects the optimal AI model based on:
- Content type (creative → Claude, structured → GPT-4o, fast/cheap → Gemini Flash)
- Current model availability and latency
- Organization's model preferences
- Estimated cost vs. quality trade-off

**`app/workers/scheduler_tasks.py`** — Beat schedule task `check_due_posts` runs every minute to query for posts where `scheduled_at <= now()` and status = `scheduled`, then enqueues `publish_scheduled_post` tasks.

---

*End of API_PLAN.md*
