# Brandora AI — Feature Prioritization Framework
**Version:** 1.0 | **Last Updated:** May 2026

---

## 1. Prioritization Framework

### RICE Scoring — Adapted for Brandora AI

RICE = (Reach × Impact × Confidence) / Effort

**Reach** — How many of our users (or future users) does this feature affect per month?
- 5: All active users
- 4: > 75% of users
- 3: 50–75% of users
- 2: 25–50% of users
- 1: < 25% of users (power users, enterprise only)

**Impact** — How much does this feature move our North Star Metric (weekly active content generators)?
- 5: Massive — directly creates or retains users at scale
- 4: High — significantly improves activation or retention
- 3: Medium — noticeable improvement in engagement or satisfaction
- 2: Low — small improvement, mostly nice-to-have
- 1: Minimal — marginal or indirect benefit

**Confidence** — How confident are we that this feature will deliver the stated impact?
- 5: We have direct user evidence (quotes, survey data, behavioral data)
- 4: We have strong analogous evidence (similar products, industry data)
- 3: We have reasonable assumptions supported by domain knowledge
- 2: We are mostly guessing based on intuition
- 1: Speculative — no evidence, high uncertainty

**Effort** — How many engineer-weeks does this take end-to-end (design + build + test + deploy)?
- 1: > 8 engineer-weeks (massive)
- 2: 5–8 engineer-weeks (large)
- 3: 3–4 engineer-weeks (medium)
- 4: 1–2 engineer-weeks (small)
- 5: < 1 engineer-week (tiny)

**Priority Tiers:**
- **P0:** Core MVP — must ship for the product to exist. RICE score is secondary.
- **P1:** High value — RICE > 20. Ship in Phase 2 or Phase 3.
- **P2:** Medium value — RICE 10–20. Ship when capacity allows.
- **P3:** Low value or speculative — RICE < 10 or Confidence ≤ 2. Revisit quarterly.

---

## 2. Complete Feature Inventory and Priority Matrix

### Category: Authentication & Organization Management

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 1 | Email + Google OAuth signup/login | Core | P0 | 5 | 5 | 5 | 4 | 125 | None | 1 | Buy (Supabase Auth) |
| 2 | Organization creation wizard | Core | P0 | 5 | 5 | 5 | 4 | 125 | Feature 1 | 1 | Build |
| 3 | Role-based access (Owner/Admin/Member) | Core | P1 | 4 | 4 | 4 | 3 | 21 | Feature 2 | 3 | Build |
| 4 | Team member invitation via email | Growth | P1 | 3 | 4 | 4 | 4 | 19 | Feature 3 | 3 | Build |
| 5 | SSO / SAML enterprise login | Enterprise | P3 | 1 | 3 | 3 | 2 | 4.5 | Feature 3 | 4 | Buy (Auth0/Supabase) |
| 6 | Multi-org support (one user, many orgs) | Enterprise | P2 | 2 | 3 | 3 | 2 | 9 | Feature 2 | 4 | Build |
| 7 | Organization audit log | Enterprise | P3 | 1 | 2 | 3 | 3 | 2 | Feature 3 | 4 | Build |

---

### Category: Brand Identity & Voice

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 8 | Brand profile form (mission, audience, sector) | Core | P0 | 5 | 5 | 5 | 4 | 125 | Feature 2 | 1 | Build |
| 9 | Brand tone sliders (3 dimensions) | Core | P0 | 5 | 5 | 5 | 4 | 125 | Feature 8 | 1 | Build |
| 10 | Brand keywords & avoid-words | Core | P0 | 5 | 4 | 5 | 5 | 100 | Feature 8 | 1 | Build |
| 11 | Voice preview (sample paragraph on demand) | Core | P0 | 5 | 4 | 5 | 4 | 100 | Feature 8,9,10 | 1 | Build |
| 12 | Example content upload (paste old posts) | Core | P0 | 5 | 4 | 4 | 4 | 80 | Feature 8 | 1 | Build |
| 13 | Logo upload (brand asset storage) | Core | P0 | 5 | 3 | 5 | 4 | 75 | Feature 2 | 1 | Build+Buy (Supabase Storage) |
| 14 | Brand voice cloning (AI fingerprint from bulk posts) | Growth | P1 | 4 | 5 | 3 | 2 | 30 | Feature 8 | 3 | Build |
| 15 | Multiple voice profiles per org | Growth | P2 | 2 | 4 | 3 | 3 | 8 | Feature 14 | 3 | Build |
| 16 | Brand voice version history & rollback | Growth | P2 | 3 | 3 | 3 | 3 | 9 | Feature 8 | 3 | Build |
| 17 | Voice drift detection & alerts | Growth | P2 | 3 | 3 | 3 | 3 | 9 | Feature 14 | 3 | Build |
| 18 | Brand tone dimension expansion (6 sliders) | Growth | P2 | 3 | 3 | 3 | 4 | 6.75 | Feature 9 | 2 | Build |

---

### Category: Core AI Content Generation

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 19 | LinkedIn post generation | Core | P0 | 5 | 5 | 5 | 3 | 41 | Feature 8 | 1 | Build |
| 20 | Instagram caption generation | Core | P0 | 5 | 5 | 5 | 4 | 31 | Feature 8 | 1 | Build |
| 21 | Twitter/X thread & single-tweet generation | Core | P0 | 4 | 4 | 5 | 4 | 20 | Feature 8 | 1 | Build |
| 22 | Streaming response display (token-by-token) | Core | P0 | 5 | 4 | 5 | 4 | 25 | Feature 19 | 1 | Build |
| 23 | Regenerate (new variation of same brief) | Core | P0 | 5 | 4 | 5 | 5 | 100 | Feature 19 | 1 | Build |
| 24 | Tone override per generation | Core | P0 | 5 | 4 | 4 | 5 | 80 | Feature 9 | 1 | Build |
| 25 | Copy to clipboard | Core | P0 | 5 | 3 | 5 | 5 | 75 | Feature 19 | 1 | Build |
| 26 | AI model fallback chain (GPT-4o → Claude → Gemini) | Core | P0 | 5 | 5 | 5 | 3 | 41 | Feature 19 | 1 | Build |
| 27 | Content auto-save to history | Core | P0 | 5 | 4 | 5 | 5 | 100 | Feature 19 | 1 | Build |
| 28 | Character/word count display per platform | Core | P0 | 5 | 3 | 5 | 5 | 75 | Feature 19 | 1 | Build |
| 29 | Facebook post generation | Growth | P2 | 2 | 3 | 3 | 3 | 6 | Feature 19 | 3 | Build |
| 30 | YouTube community post generation | Growth | P3 | 1 | 2 | 2 | 4 | 1 | Feature 19 | 4 | Build |
| 31 | WhatsApp status / broadcast copy | Growth | P2 | 3 | 3 | 3 | 3 | 9 | Feature 19 | 3 | Build |
| 32 | Email newsletter paragraph generation | Growth | P2 | 2 | 3 | 3 | 3 | 6 | Feature 19 | 3 | Build |
| 33 | Press release paragraph generation | Enterprise | P3 | 1 | 2 | 2 | 3 | 1.3 | Feature 19 | 4 | Build |

---

### Category: Content Repurposing

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 34 | Cross-platform repurpose (1 → 3 formats) | Core | P0 | 5 | 5 | 5 | 3 | 41 | Feature 19,20,21 | 1 | Build |
| 35 | Side-by-side platform comparison view | Core | P0 | 5 | 3 | 5 | 4 | 18.75 | Feature 34 | 1 | Build |
| 36 | URL-to-content (article → social posts) | Growth | P1 | 4 | 4 | 3 | 3 | 16 | Feature 19 | 2 | Build |
| 37 | PDF/document upload → social posts | Growth | P1 | 3 | 4 | 3 | 2 | 18 | Feature 19 | 2 | Build |
| 38 | Bulk repurpose (10+ posts to new platform) | Growth | P2 | 2 | 4 | 3 | 3 | 8 | Feature 34 | 3 | Build |
| 39 | Content package PDF export | Core | P1 | 4 | 3 | 4 | 4 | 12 | Feature 34 | 1 | Build+Buy (pdfkit) |

---

### Category: Content Management & History

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 40 | Content history list (paginated) | Core | P0 | 5 | 4 | 5 | 4 | 25 | Feature 27 | 1 | Build |
| 41 | Filter by platform / date range | Core | P0 | 5 | 3 | 5 | 5 | 75 | Feature 40 | 1 | Build |
| 42 | Keyword search across content | Core | P0 | 5 | 3 | 5 | 4 | 18.75 | Feature 40 | 1 | Build |
| 43 | Content status management (Draft/Approved/Archived) | Core | P0 | 5 | 3 | 5 | 4 | 18.75 | Feature 40 | 1 | Build |
| 44 | Manual content editing & save | Core | P0 | 5 | 4 | 5 | 4 | 25 | Feature 40 | 1 | Build |
| 45 | Bulk archive / delete | Growth | P2 | 3 | 2 | 4 | 4 | 6 | Feature 40 | 2 | Build |
| 46 | CSV export of content history | Growth | P2 | 3 | 2 | 4 | 4 | 6 | Feature 40 | 2 | Build |
| 47 | Word/PDF export (formatted content package) | Growth | P2 | 3 | 3 | 3 | 3 | 9 | Feature 40 | 2 | Build |
| 48 | Content tagging (custom labels) | Growth | P2 | 3 | 2 | 3 | 4 | 4.5 | Feature 40 | 3 | Build |

---

### Category: Hashtag Intelligence

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 49 | Curated sector hashtag database (300+) | Core | P0 | 5 | 4 | 5 | 4 | 25 | Feature 19 | 1 | Build |
| 50 | Auto-hashtag generation with every post | Core | P0 | 5 | 4 | 5 | 5 | 100 | Feature 49 | 1 | Build |
| 51 | Refresh hashtags (new set, same post body) | Core | P0 | 5 | 3 | 5 | 5 | 75 | Feature 50 | 1 | Build |
| 52 | Saved hashtag sets (reusable combinations) | Growth | P1 | 4 | 3 | 4 | 4 | 12 | Feature 50 | 2 | Build |
| 53 | Hashtag volume & relevance scoring | Growth | P1 | 4 | 3 | 3 | 3 | 12 | Feature 49 | 2 | Build |
| 54 | Trending hashtag refresh (weekly API pull) | Growth | P2 | 3 | 3 | 3 | 2 | 13.5 | Feature 53 | 3 | Build+Buy (Twitter API) |
| 55 | Hashtag performance tracking (engagement correlation) | Growth | P2 | 3 | 3 | 2 | 2 | 9 | Feature 54 | 3 | Build |

---

### Category: CSR Storytelling & Templates

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 56 | 5 CSR storytelling templates (MVP set) | Core | P0 | 5 | 4 | 5 | 4 | 25 | Feature 19 | 1 | Build |
| 57 | Template gallery UI | Core | P0 | 5 | 3 | 5 | 4 | 18.75 | Feature 56 | 1 | Build |
| 58 | Expand to 20 storytelling templates | Growth | P1 | 5 | 4 | 4 | 3 | 26.7 | Feature 56 | 2 | Build |
| 59 | CSR annual report → social posts pipeline | Growth | P1 | 3 | 5 | 4 | 2 | 30 | Feature 37 | 2 | Build |
| 60 | Custom template builder | Enterprise | P3 | 2 | 3 | 2 | 2 | 6 | Feature 56 | 4 | Build |
| 61 | Template marketplace (community-submitted) | Enterprise | P3 | 2 | 2 | 2 | 1 | 4 | Feature 60 | 4 | Build |
| 62 | Founder personal branding engine | Growth | P1 | 3 | 4 | 4 | 3 | 16 | Feature 8 | 2 | Build |
| 63 | Impact number formatter (stat → narrative sentence) | Growth | P2 | 4 | 3 | 3 | 4 | 9 | Feature 19 | 2 | Build |

---

### Category: Awareness Day Calendar

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 64 | Pre-loaded 12-day awareness calendar (MVP) | Core | P0 | 5 | 5 | 5 | 4 | 31 | Feature 19 | 1 | Build |
| 65 | Awareness day 30-day dashboard widget | Core | P0 | 5 | 4 | 5 | 5 | 100 | Feature 64 | 1 | Build |
| 66 | One-click content generation from awareness day | Core | P0 | 5 | 5 | 5 | 4 | 31 | Feature 64 | 1 | Build |
| 67 | Expand to 50+ awareness days + India-specific | Growth | P1 | 5 | 4 | 5 | 4 | 25 | Feature 64 | 2 | Build |
| 68 | Custom awareness day addition per org | Growth | P2 | 3 | 3 | 4 | 4 | 9 | Feature 64 | 2 | Build |
| 69 | Email/push reminder (30 days before awareness day) | Growth | P1 | 5 | 4 | 4 | 3 | 26.7 | Feature 64 | 2 | Build+Buy (SendGrid) |
| 70 | Full annual calendar view | Growth | P2 | 4 | 3 | 4 | 3 | 16 | Feature 64 | 2 | Build |

---

### Category: Campaign Management

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 71 | Campaign entity (name, goal, dates) | Growth | P1 | 4 | 4 | 4 | 3 | 21.3 | Feature 40 | 2 | Build |
| 72 | Campaign content calendar (timeline view) | Growth | P1 | 4 | 4 | 4 | 2 | 32 | Feature 71 | 2 | Build |
| 73 | Drag-drop content calendar | Growth | P1 | 4 | 3 | 4 | 3 | 16 | Feature 72 | 2 | Build |
| 74 | Campaign templates (save & reuse annually) | Growth | P2 | 3 | 4 | 3 | 3 | 12 | Feature 71 | 3 | Build |
| 75 | Campaign performance summary | Growth | P2 | 3 | 4 | 3 | 2 | 18 | Feature 71 | 3 | Build |
| 76 | Campaign AI brief generator | Delight | P2 | 3 | 4 | 3 | 3 | 12 | Feature 71 | 3 | Build |
| 77 | Multi-org campaign coordination | Enterprise | P3 | 1 | 4 | 2 | 2 | 4 | Feature 71 | 4 | Build |

---

### Category: Social Scheduling & Publishing

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 78 | LinkedIn post scheduling (Marketing API) | Growth | P1 | 5 | 5 | 4 | 2 | 50 | Feature 19 | 2 | Build+Buy (LinkedIn API) |
| 79 | Instagram post scheduling (Graph API) | Growth | P1 | 4 | 5 | 4 | 2 | 40 | Feature 20 | 3 | Build+Buy (Instagram API) |
| 80 | Twitter/X scheduling (v2 API) | Growth | P2 | 3 | 4 | 3 | 2 | 18 | Feature 21 | 3 | Build+Buy (Twitter API) |
| 81 | Unified publishing queue (all platforms) | Growth | P1 | 4 | 4 | 4 | 2 | 32 | Feature 78 | 3 | Build |
| 82 | Auto-best-time suggestions for scheduling | Delight | P2 | 4 | 3 | 3 | 3 | 12 | Feature 78 | 3 | Build |
| 83 | Publish-now option | Growth | P1 | 4 | 4 | 4 | 4 | 16 | Feature 78 | 2 | Build |
| 84 | Schedule failure retry + email alert | Core | P1 | 4 | 4 | 5 | 4 | 20 | Feature 78 | 2 | Build |
| 85 | Cross-post with per-platform adaptation | Delight | P2 | 3 | 4 | 3 | 2 | 18 | Feature 81 | 3 | Build |

---

### Category: Analytics

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 86 | Post reach/impressions (LinkedIn API pull) | Growth | P1 | 4 | 4 | 4 | 3 | 21.3 | Feature 78 | 2 | Build+Buy (LinkedIn API) |
| 87 | Top-performing content (sorted by engagement) | Growth | P1 | 4 | 4 | 4 | 3 | 21.3 | Feature 86 | 2 | Build |
| 88 | Weekly email digest (performance summary) | Growth | P1 | 4 | 3 | 4 | 4 | 12 | Feature 86 | 2 | Build+Buy (SendGrid) |
| 89 | Platform comparison dashboard | Growth | P2 | 3 | 3 | 3 | 3 | 9 | Feature 86 | 3 | Build |
| 90 | AI content quality score (real-time, 0–100) | Delight | P1 | 5 | 4 | 3 | 2 | 30 | Feature 19 | 3 | Build |
| 91 | Quality score vs. performance correlation | Delight | P2 | 3 | 4 | 2 | 2 | 12 | Feature 90 | 3 | Build |
| 92 | Sector benchmark comparison (anonymized) | Delight | P2 | 3 | 3 | 2 | 2 | 9 | Feature 86 | 3 | Build |
| 93 | Custom date range reports | Enterprise | P2 | 3 | 3 | 3 | 3 | 9 | Feature 86 | 4 | Build |
| 94 | Board presentation PDF report | Enterprise | P2 | 2 | 4 | 3 | 2 | 12 | Feature 93 | 4 | Build |

---

### Category: Team Collaboration

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 95 | Comments on content drafts | Growth | P2 | 3 | 4 | 3 | 3 | 12 | Feature 3 | 3 | Build |
| 96 | Approval workflow (generate → approve → publish) | Growth | P1 | 3 | 5 | 4 | 2 | 30 | Feature 3 | 3 | Build |
| 97 | Content assignment to team members | Growth | P2 | 2 | 3 | 3 | 3 | 6 | Feature 95 | 3 | Build |
| 98 | Revision history with attribution | Growth | P2 | 2 | 3 | 3 | 3 | 6 | Feature 44 | 3 | Build |
| 99 | @mentions in comments + in-app notifications | Delight | P2 | 2 | 2 | 3 | 3 | 4 | Feature 95 | 3 | Build |

---

### Category: Multi-Language Support

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 100 | Hindi content generation (Devanagari) | Growth | P1 | 4 | 5 | 4 | 2 | 40 | Feature 19 | 3 | Build |
| 101 | Romanized Hindi (Hinglish) generation | Growth | P1 | 4 | 4 | 4 | 3 | 21.3 | Feature 100 | 3 | Build |
| 102 | Language selector per generation | Growth | P1 | 4 | 4 | 5 | 4 | 20 | Feature 100 | 3 | Build |
| 103 | NGO terminology glossary per language | Growth | P2 | 3 | 3 | 3 | 3 | 9 | Feature 100 | 3 | Build |
| 104 | Bengali / Tamil / Telugu generation | Enterprise | P3 | 2 | 3 | 2 | 2 | 6 | Feature 100 | 4 | Build |

---

### Category: AI Intelligence Features

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 105 | AI content quality scoring (real-time) | Delight | P1 | 5 | 4 | 3 | 2 | 30 | Feature 19 | 3 | Build |
| 106 | Automated rewrite suggestions (low-score areas) | Delight | P2 | 4 | 4 | 3 | 2 | 24 | Feature 105 | 3 | Build |
| 107 | AI editor (paste any content → get rewrites) | Growth | P2 | 3 | 4 | 3 | 3 | 12 | Feature 19 | 3 | Build |
| 108 | GPT-4o Vision: image → caption generation | Delight | P2 | 4 | 4 | 3 | 2 | 24 | Feature 20 | 3 | Build+Buy (OpenAI Vision) |
| 109 | Trend prediction (upcoming sector topics) | Delight | P3 | 3 | 3 | 2 | 1 | 6 | Feature 19 | 4 | Build |
| 110 | Competitor public post monitoring | Enterprise | P3 | 2 | 2 | 2 | 2 | 4 | None | 4 | Build |

---

### Category: Enterprise & Platform

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 111 | White-label (custom domain, branding) | Enterprise | P2 | 1 | 5 | 4 | 1 | 20 | All Phase 1-3 stable | 4 | Build |
| 112 | REST API with API key auth | Enterprise | P2 | 2 | 5 | 4 | 2 | 20 | All Phase 1-3 stable | 4 | Build |
| 113 | Webhooks (event notifications to external systems) | Enterprise | P2 | 2 | 4 | 3 | 3 | 8 | Feature 112 | 4 | Build |
| 114 | Zapier integration | Enterprise | P2 | 2 | 3 | 3 | 3 | 6 | Feature 112 | 4 | Buy (Zapier developer) |
| 115 | Make (Integromat) integration | Enterprise | P3 | 1 | 3 | 2 | 2 | 3 | Feature 112 | 4 | Buy |
| 116 | Canva integration | Enterprise | P3 | 2 | 3 | 2 | 2 | 6 | Feature 112 | 4 | Buy (Canva API) |
| 117 | React Native mobile app (iOS + Android) | Enterprise | P2 | 4 | 4 | 3 | 1 | 24 | Feature 112 | 4 | Build |
| 118 | Developer documentation site | Enterprise | P2 | 2 | 3 | 4 | 3 | 8 | Feature 112 | 4 | Build |
| 119 | API sandbox environment | Enterprise | P2 | 1 | 3 | 4 | 3 | 4 | Feature 112 | 4 | Build |

---

### Category: Billing & Plans

| # | Feature | Category | Tier | Reach | Impact | Confidence | Effort | RICE | Dependencies | Phase | Build/Buy |
|---|---------|----------|------|-------|--------|------------|--------|------|-------------|-------|-----------|
| 120 | Stripe subscription integration | Core | P1 | 5 | 5 | 5 | 2 | 62.5 | Feature 2 | 2 | Buy (Stripe) |
| 121 | Usage tracking & limit enforcement | Core | P1 | 5 | 4 | 5 | 3 | 33.3 | Feature 120 | 2 | Build |
| 122 | Plan upgrade/downgrade flow | Core | P1 | 5 | 4 | 5 | 3 | 33.3 | Feature 120 | 2 | Build+Buy (Stripe Customer Portal) |
| 123 | Invoice history | Enterprise | P2 | 3 | 2 | 5 | 4 | 7.5 | Feature 120 | 3 | Buy (Stripe) |
| 124 | NGO subsidy / discounted billing (CSR sponsors NGO) | Delight | P2 | 3 | 4 | 3 | 2 | 18 | Feature 120 | 3 | Build |

---

## 3. P0 Features Deep-Dive — Why Each Is Critical

### P0-1/2: Auth + Org Setup
Without this, there is no product. More importantly: the org setup (sector tags, org type) is the first piece of domain intelligence the AI receives. A user who says "sanitation NGO" at signup gets fundamentally different generated content than "corporate CSR team." This is not plumbing — it is intelligence seeding.

### P0-8/9/10/11/12/13: Brand Profile Stack
The brand profile is Brandora AI's core differentiator from ChatGPT. A user who types "write a LinkedIn post about Menstrual Hygiene Day" into ChatGPT gets generic content. The same user who types the same brief into Brandora AI — with mission, tone, keywords, and example posts configured — gets content that sounds like it was written by their own communications director. The brand profile is the moat. It must be excellent, not functional.

### P0-19/20/21: LinkedIn/Instagram/Twitter Generation
The product. The entire reason Brandora AI exists. LinkedIn is the primary surface; users will judge the entire product by LinkedIn quality first. If LinkedIn post quality is not excellent (consistently publishable with minor or no edits), no amount of other features will save the product.

### P0-22: Streaming Display
Streaming is not a performance optimization — it is a psychological one. A user watching tokens appear feels the AI thinking. A 6-second wait for a page reload feels broken. Streaming makes generation feel alive and impressive. Without streaming, every generation feels slow even when it is fast.

### P0-23/24/25: Regenerate, Tone Override, Copy to Clipboard
These three micro-features define whether the generation experience is a tool or a toy. "Regenerate" signals "I can get variations." "Tone override" signals "I'm in control." "Copy" signals "This content is ready to use." Together they close the psychological loop from generation to actual use.

### P0-26: Model Fallback Chain
OpenAI outages happen. They have happened multiple times in 2024–2025. If Brandora AI is down every time OpenAI has an incident, we will lose users permanently. The fallback chain (GPT-4o → Claude Sonnet → Gemini Pro) is not optional infrastructure — it is a reliability contract with users.

### P0-34: Content Repurposing
The repurposing feature is what makes Brandora AI feel like a time-saving professional tool rather than a generator. A user who creates a great LinkedIn post and can repurpose it to Instagram and Twitter in 10 seconds has experienced the product's full value proposition in one session. Without this, users experience the product as "faster content writing." With it, they experience it as "a communication team in my pocket."

### P0-49/50/51: Hashtag Stack
Generic hashtags are worthless. Sector-specific hashtags — #MenstrualHygieneDay, #WorldToiletDay, #SanitationForAll, #PeriodPoverty, #WASHforAll — are how NGO content gets discovered by the audiences that matter: donors, policymakers, journalists, peer organizations. The curated hashtag database is a data asset that competitors cannot easily replicate. It must be seeded properly in Sprint 1, not left to AI improvisation.

### P0-56/57: CSR Templates
Templates serve two purposes: (1) They help users who know what they want to say but don't know how to frame it. (2) They educate users about storytelling formats (Problem-Solution-Impact, Before-After-Bridge) that genuinely improve their content. A user who uses the "Impact Milestone" template once and sees how it structures their 50,000-women-reached milestone into a compelling narrative will understand why the product exists at a deeper level.

### P0-64/65/66: Awareness Day Stack
Menstrual Hygiene Day (May 28) is the single highest-traffic day in the NGO social media calendar for this sector. An organization that uses Brandora AI to generate excellent MH Day content — ready 30 days in advance — will tell every peer organization about it. The awareness day feature is the single most powerful word-of-mouth driver in the MVP. It must work flawlessly and generate excellent output.

---

## 4. What NOT to Build (Ever)

These features sound reasonable when proposed in a product meeting. They are traps.

| Feature | Why It's a Trap |
|---------|----------------|
| AI image/graphic generation | DALL-E and Midjourney images are instantly recognizable as AI-generated and damage NGO credibility. "Authentic" visual content is photographed field work, not AI art. Building this would actively harm users. |
| Viral post predictor ("This post will get X impressions") | Engagement prediction on social media is pseudo-science. LinkedIn and Instagram algorithms are opaque and change frequently. Promising virality metrics that we cannot deliver destroys trust. |
| Social listening / mention monitoring | This is a separate product (Brandwatch, Sprout Social). It requires real-time API streams, massive storage, and creates data privacy issues. It dilutes the content creation focus. |
| AI-generated profile photos or avatar creation | Fake personas for NGOs are an ethical violation. NGO credibility depends on authenticity. This feature would be used for exactly the wrong things. |
| Auto-posting without review | Posting content to an NGO's social media without a human review step is a liability. One bad AI-generated post about menstrual health could cause genuine reputational damage. Scheduling (with human review) = good. Auto-posting = never. |
| Fundraising copy generator | Fundraising communications are highly regulated (FCRA in India, charity law in UK/US). Compliance varies by jurisdiction and changes. We do not have the legal expertise to build this responsibly in Phase 1–3. |
| Email campaign builder | Mailchimp and Klaviyo do this. We don't. Adding email builder creates a support burden, design system expansion, and deliverability infrastructure with zero competitive advantage for us. |
| CRM functionality | We are not a CRM. Every engineer-hour spent on contact management is an engineer-hour not spent on AI content quality. Use HubSpot, link to it if needed. |
| Community forum / peer network | Building a community platform is a 12-month project on its own. It would consume the team. Buy community time on Slack/Discord instead. |
| Grant writing assistant | Grant applications are multi-page documents requiring legal review. The liability exposure for incorrect AI-generated grant claims is significant. Not in our domain. |

---

## 5. Build vs. Buy Analysis

### Authentication
**Decision: Buy (Supabase Auth)**
Supabase Auth handles email/password, Google OAuth, JWT, session management, and RLS integration out of the box. Building auth from scratch costs 3–4 engineer-weeks and introduces security risks. Cost: included in Supabase free tier / Pro at $25/month. Verdict: Buy, no debate.

### Database & Backend Hosting
**Decision: Buy (Supabase + Railway)**
Supabase: PostgreSQL + RLS + Auth + Storage + Realtime in one managed service. Railway: simple container hosting with persistent WebSocket support. Both have free tiers sufficient for MVP. Alternative (self-managed PostgreSQL on EC2) saves ~$50/month but costs 2 engineer-weeks of DevOps setup. Verdict: Buy.

### Email Delivery
**Decision: Buy (SendGrid)**
Transactional email (welcome, onboarding drip, scheduling alerts) is a commodity. SendGrid free tier covers 100 emails/day. No reason to build or self-host. Verdict: Buy.

### Social Media Scheduling
**Decision: Build our own scheduler (do NOT use a third-party scheduling SaaS)**
Services like Buffer, Hootsuite, and Later have APIs, but using them means: (a) passing user OAuth tokens to a third party, (b) losing platform API call visibility, (c) pricing tied to their commercial model. We need direct LinkedIn/Instagram/Twitter API access to build analytics and AI-powered scheduling intelligence. Cost: LinkedIn Marketing API is free (approval-gated); Instagram Graph API is free (approval-gated). Verdict: Build the scheduler in-house, using official platform APIs directly.

### Analytics (Internal / Product Analytics)
**Decision: Buy (PostHog)**
PostHog provides session recording, funnel analysis, feature flags, A/B testing, and cohort analysis. Replacing this with a custom analytics system would consume 6+ engineer-weeks and never be as good. PostHog self-hosted is free; cloud is $0 for < 1M events/month. Verdict: Buy.

### Content Performance Analytics (Social Media)
**Decision: Build data ingestion, display internally**
We pull data from LinkedIn/Instagram/Twitter APIs and store it in our database. We build our own display. We do NOT use a third-party social analytics tool as middleware — it adds latency, cost, and a privacy layer between us and user data. Verdict: Build display, use official platform APIs for data.

### PDF Export
**Decision: Buy (pdfkit / WeasyPrint)**
Open-source PDF generation library. No per-document cost, no vendor lock-in, runs in our FastAPI container. Verdict: Buy (library, not service).

### Error Monitoring
**Decision: Buy (Sentry)**
Sentry free tier covers up to 5,000 errors/month. No reason to build error monitoring. Verdict: Buy.

### Vector Store (Phase 3 — Brand Voice Cloning)
**Decision: Buy (pgvector in Supabase)**
pgvector is a PostgreSQL extension. Supabase supports it natively. For brand voice fingerprinting (storing embedding vectors of user's historical posts), pgvector is sufficient up to ~1M vectors. No need for Pinecone until we have 10,000+ orgs each storing hundreds of vectors. Verdict: Buy (via Supabase pgvector), revisit at scale.

### Mobile App (Phase 4)
**Decision: Build (React Native / Expo)**
Our backend API will be mature by Phase 4. Building with React Native (using Expo for managed workflow) allows significant code sharing with Next.js frontend (business logic, API clients). Verdict: Build with React Native.

---

## 6. AI Feature Prioritization

### Tier 1: AI features to build first (define the product)

1. **Domain-specific prompt engineering** — The prompts that inject brand context, sector vocabulary, and NGO communication norms into every generation. This is not a feature you ship and forget; it requires continuous improvement. Allocate a recurring 10% of sprint capacity to prompt refinement for all 12 months.

2. **Multi-model fallback chain** — GPT-4o → Claude Sonnet 3.5 → Gemini Pro 1.5. Each model needs its own prompt template (they respond differently to the same prompt). Build model-specific prompt variants in Sprint 3.

3. **Streaming generation** — Server-Sent Events from FastAPI → Next.js. Token-by-token streaming is a UX requirement, not optional.

4. **Platform-specific output parsers** — Validates that LinkedIn output has the right structure (length, hashtag count, CTA), Instagram has emojis and story hook, Twitter respects 280-char limits. These parsers prevent malformed output from reaching the user.

### Tier 2: AI features that drive retention (Phase 2–3)

5. **AI content quality scorer** — Rates generated content on clarity, emotional resonance, CTA strength, platform fit, brand voice match. Build this in Phase 3 using GPT-4o as the judge (prompt: "Rate this NGO LinkedIn post on a scale of 0–100 on these dimensions"). Turns quality from subjective to trackable.

6. **Brand voice cloning from historical posts** — Users upload 20–50 old posts; we extract a voice fingerprint using embeddings + clustering to identify patterns. The fingerprint improves generation quality dramatically for established organizations. Phase 3.

7. **GPT-4o Vision for image-to-caption** — User uploads a field visit photo; AI generates an Instagram caption based on what it sees in the image plus brand context. Extremely useful for NGO field documentation. Phase 3.

### Tier 3: AI features that are intellectually interesting but low priority

8. **Trend prediction** — Predicting upcoming social media topics using news API + LLM analysis. Interesting but requires fine-tuning or complex RAG pipeline. Low confidence it drives retention. Phase 4 if capacity allows.

9. **Competitor analysis** — Monitoring public social accounts of peer NGOs. Ethically complex, legally grey (scraping), and not a Day-1 pain point. Phase 4 or never.

10. **Fine-tuned models** — Training our own fine-tuned model on NGO/CSR content. Only worthwhile when we have 10,000+ high-quality prompt-completion pairs (Phase 4, earliest).

---

## 7. Platform Prioritization

### Why LinkedIn First

1. **LinkedIn is where NGO leadership lives.** Executive directors, program managers, CSR heads, donor relations teams — all active on LinkedIn professionally.
2. **LinkedIn has the highest content half-life.** A LinkedIn post can continue generating engagement for 72–96 hours. Twitter decays in hours.
3. **LinkedIn Marketing API is the most accessible.** Unlike Instagram (requires Business account, Facebook Page linkage) and Twitter (API tiers are expensive and bureaucratic), LinkedIn Marketing API is developer-accessible with a straightforward approval process.
4. **NGO professional audience.** Donors, government partners, corporate CSR teams, journalists — all on LinkedIn. Not all on Instagram or Twitter.

### Why Instagram Second

1. Menstrual hygiene campaigns are inherently visual — period kits, field visits, community sessions. Instagram is the primary platform for visual storytelling in this sector.
2. Instagram is where organizations reach youth audiences and mobilize volunteers.
3. Instagram Graph API requires a Business/Creator account (most NGOs already have this).
4. Concern: Instagram API approval can take 3–6 weeks. Apply in Sprint 3, even though the feature ships in Phase 3.

### Why Twitter/X Third (and with Reservations)

1. Twitter/X is valuable for policy advocacy, government engagement (many Indian government bodies are active on Twitter), and journalist outreach.
2. Twitter/X API v2 has become expensive and restrictive. Basic tier costs $100/month; higher access costs $500/month. Build scheduling for Twitter only when we have paying users to justify the API cost.
3. Twitter's platform stability under current ownership is uncertain. Do not make Twitter a core dependency.

### Platform Expansion Order (Post-MVP)

Phase 2: LinkedIn scheduling
Phase 3: Instagram scheduling, Twitter generation improvements
Phase 4: Facebook (lower priority, older demographic), WhatsApp Business API (high-effort, high-potential for India), YouTube community posts

**Never: TikTok** — Not the primary platform for NGO institutional communications; content format (short video) is outside our AI capabilities without video generation.

---

## 8. Technical Debt Budget

### The 20% Rule

Every sprint allocates 20% of capacity (approximately 2 days out of a 10-day sprint) to technical debt. This is non-negotiable. Projects that skip this budget accrue debt silently until a 2-week sprint becomes a 6-week slog.

### What Counts as Technical Debt Work

- Writing tests for previously untested code (target: 80% coverage on API endpoints by end of Phase 2)
- Refactoring prompt templates that have become bloated
- Upgrading dependencies with known vulnerabilities
- Documenting internal APIs (FastAPI auto-generates docs, but docstrings and examples require human work)
- Addressing Sentry-flagged error patterns
- Query optimization (adding indexes, reviewing N+1 patterns)
- Removing feature flags for features that have shipped and been stable for > 1 sprint

### Technical Debt Categories and Severity

| Category | Severity | Address In |
|----------|----------|------------|
| Security vulnerabilities (any CVSS ≥ 7.0) | Critical | Same sprint, no exceptions |
| Data integrity risks (missing transactions, race conditions) | High | Next sprint |
| Performance regressions (p95 latency increases > 20%) | High | Next sprint |
| Test coverage gaps on P0 features | Medium | Within phase |
| Code duplication (> 3 copies of the same logic) | Low | Quarterly debt sprint |
| Outdated dependencies (non-security) | Low | Monthly |
| Documentation gaps | Low | Monthly |

### Debt-Free Principles (Shortcuts We Will Never Take)

- No RLS exceptions "temporarily" — every org-scoped table has RLS from the beginning
- No hardcoded credentials anywhere, ever
- No `TODO: handle error` without a Sentry issue filed
- No shipping without error monitoring (Sentry must capture 100% of unhandled exceptions before any feature goes to production)

---

## 9. Feature Flag Strategy

### Why Feature Flags Matter at Brandora AI's Stage

Feature flags let us:
1. Deploy code to production before it's ready for users (dark launches)
2. Roll out features to 10% of users before 100% (canary releases)
3. Kill a feature instantly if it causes issues (kill switch)
4. Enable beta features for specific orgs (early access programs)

### Implementation

Use PostHog feature flags (already in our stack for analytics). PostHog's feature flags support:
- User-level flags (enable for specific users)
- Org-level flags (enable for specific organizations)
- Percentage rollout (10% → 25% → 50% → 100%)
- Payload flags (pass configuration data, not just on/off)

### Flag Taxonomy

**`ff_platform_{name}`** — Controls platform-specific features
Examples: `ff_platform_instagram_scheduling`, `ff_platform_twitter_scheduling`
Default: off. Enable per org during testing, then percentage rollout.

**`ff_ai_{feature}`** — Controls AI capability flags
Examples: `ff_ai_quality_scoring`, `ff_ai_voice_cloning`, `ff_ai_vision`
Default: off. Enable for beta testers first.

**`ff_billing_{plan}`** — Controls plan-gated features
Examples: `ff_billing_pro_hashtag_analytics`, `ff_billing_enterprise_white_label`
Default: based on org's current plan.

**`ff_beta_{feature}`** — Early access features
Examples: `ff_beta_campaign_management`, `ff_beta_hindi_generation`
Default: off. Enable manually for willing beta testers.

### Flag Lifecycle

1. Feature is under development → flag is `off` in all environments except local dev
2. Feature is ready for internal testing → flag is `on` in staging only
3. Feature is ready for beta testing → flag is `on` for specific beta orgs in production
4. Feature is in graduated rollout → PostHog percentage rollout (10% → 50% → 100% over 2 weeks)
5. Feature is fully live → flag is removed from code in next cleanup sprint (flags are technical debt)

### Flag Cleanup Rule

Any feature flag that has been at 100% rollout for more than 2 sprints must be removed from code in the next technical debt sprint. Flag proliferation creates conditional logic that makes the codebase unmaintainable.

---

*This document is reviewed and updated at the start of each phase. RICE scores are recalculated when user behavioral data becomes available from PostHog. Any feature added to the inventory requires a RICE score and phase placement before it can be scheduled.*
