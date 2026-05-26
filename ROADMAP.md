# Brandora AI — Product & Engineering Roadmap
**Version:** 1.0 | **Last Updated:** May 2026 | **Horizon:** 12 Months

---

## 1. Roadmap Philosophy

### Startup First Principles

**Ship → Learn → Iterate.** A roadmap is a hypothesis, not a contract. Every sprint produces either working software or learning that invalidates an assumption — both are victories.

**Principles that govern every decision:**

1. **Ramen-viable first.** Every feature on the roadmap must either (a) get us the first paying customer, (b) retain the first paying customer, or (c) enable us to charge more. Anything else is a distraction.

2. **Narrow beats broad.** We are NOT building a generic social media scheduler. We are building the deepest possible tool for sanitation and menstrual hygiene NGOs and CSR organizations. That specificity is our moat. Do not dilute it.

3. **AI is the product, not a feature.** The content generation quality IS the product. A mediocre scheduler with excellent AI beats an excellent scheduler with mediocre AI every single time in our category.

4. **Boring infrastructure, exciting UX.** Use proven, managed services (Supabase, Vercel, Railway) so engineering effort concentrates on the AI and UX layers that users actually experience.

5. **One platform, done right.** LinkedIn first. Nail it before touching Instagram. Nail Instagram before touching Twitter. Platform sprawl kills early-stage products.

6. **Measure everything, guess nothing.** Every feature ships with a measurable success criterion. If we cannot define "done" and "working," we do not build it.

7. **Technical debt has a budget.** 20% of each sprint is allocated to refactoring, test coverage, and cleanup. This is non-negotiable.

---

## 2. Phase Overview Table

| Phase | Timeline | Theme | Key Deliverable | Success Criterion |
|-------|----------|-------|-----------------|-------------------|
| 0: Prep | Week 0 | Infra & tooling | Dev environment, CI/CD, monorepo | All engineers can deploy in < 15 min |
| 1: Foundation MVP | Months 1–3 | Build what users need on Day 1 | Working AI content generator for LinkedIn, Instagram, Twitter | 10 users generating content; avg session > 8 min |
| 2: Growth Features | Months 4–6 | Make users come back every week | Campaign management, content calendar, scheduling, basic analytics | 40% week-2 retention; first paying org |
| 3: Scale & Intelligence | Months 7–9 | Make the AI irreplaceable | Brand voice cloning, quality scoring, Hindi support, team collaboration | $5k MRR; NPS > 50 |
| 4: Enterprise & Expansion | Months 10–12 | Open new revenue channels | White-label, API, mobile, integrations | $25k MRR; 3 enterprise contracts |

---

## 3. Phase 1: Foundation MVP (Months 1–3)

### Sprint 1 — Week 1–2: Project Setup, Auth, Org Management

**Goal:** Every engineer can run the full stack locally and deploy to staging. Authentication and multi-org data isolation are production-ready.

**Deliverables:**
- Monorepo structure: `/frontend` (Next.js 14), `/backend` (FastAPI), `/shared` (types/constants)
- Supabase project provisioned: auth, RLS policies, migration tooling (Alembic)
- GitHub Actions CI: lint → test → build → deploy to staging on every PR merge
- User signup/login (email + Google OAuth via Supabase Auth)
- Organization creation wizard (name, type: NGO/CSR/Both, sector: sanitation/menstrual hygiene/both)
- Role model: Owner, Admin, Member (enforced via Supabase RLS)
- Vercel preview deployments wired to PRs
- Railway FastAPI container deployed with health-check endpoint
- Redis instance provisioned on Railway (Celery broker for later use)

**Technical Tasks:**
- `supabase/migrations/001_init.sql` — organizations, memberships, users tables
- `supabase/migrations/002_rls.sql` — RLS policies for org-scoped data isolation
- Next.js App Router setup: `(auth)` route group with login/signup pages, `(app)` route group (protected via middleware)
- Supabase SSR auth helpers wired to Next.js middleware
- FastAPI: `POST /auth/verify` (validates Supabase JWT, returns user context), health endpoint
- Environment variable management: `.env.example` documented, secrets in Vercel + Railway env dashboards
- Seed script: creates demo org + demo user for local dev

**Acceptance Criteria:**
- [ ] New engineer clones repo, runs `make dev`, reaches working app in < 15 minutes
- [ ] Signup → org creation flow completes in < 3 steps
- [ ] RLS: user from Org A cannot query Org B data (automated test)
- [ ] CI pipeline green on main branch
- [ ] Staging environment accessible at `staging.brandora.ai`

**Risks:**
- Supabase RLS complexity underestimated → mitigation: write RLS tests in Sprint 1, no exceptions
- OAuth provider setup delays → mitigation: email/password first, Google OAuth as parallel task

---

### Sprint 2 — Week 3–4: Brand Profile + Voice Configuration

**Goal:** An organization can fully describe their brand identity and communication voice so the AI has all context needed to generate on-brand content.

**Deliverables:**
- Brand Profile form: org name, logo upload (Supabase Storage), mission statement, focus areas (checkboxes: menstrual hygiene, sanitation, WASH, CSR, rural development, urban sanitation, etc.)
- Brand Voice Configuration: tone sliders (formal ↔ conversational, serious ↔ hopeful, data-driven ↔ story-driven), example content upload for style reference
- Target audience builder: primary audience (donors, corporates, youth, policymakers, general public — multi-select), geography (India, Global, specific states)
- Brand keywords: 10–20 words the brand uses frequently; 10 words to avoid
- "Voice Preview" — enter a topic, get a one-paragraph sample using configured voice (first AI call in the product)
- Brand profile stored in DB, versioned (allow rollback to previous voice config)

**Technical Tasks:**
- `supabase/migrations/003_brand_profiles.sql` — brand_profiles, voice_configs, brand_keywords tables
- Supabase Storage bucket: `brand-assets` with org-scoped RLS
- FastAPI: `POST /brand/profile`, `GET /brand/profile`, `PUT /brand/profile`, `POST /brand/voice-preview`
- OpenAI GPT-4o integration (primary model): structured system prompt injection from brand profile
- Brand context builder: Python function that serializes brand profile → system prompt snippet (reusable across all generation endpoints)
- Next.js: multi-step brand setup wizard (3 steps, progress indicator)
- Image upload component (drag-drop, preview, Supabase Storage upload)

**Acceptance Criteria:**
- [ ] Brand setup wizard completes in < 5 minutes
- [ ] Voice preview returns content in < 4 seconds
- [ ] Content in voice preview demonstrably reflects chosen tone settings
- [ ] Logo upload works for PNG/JPG/WebP up to 5MB
- [ ] Brand profile can be edited and saved without data loss

**Risks:**
- Voice configuration UX is complex → mitigation: start with 3 tone dimensions max, add more in Phase 2
- AI prompt engineering for voice fidelity → mitigation: allocate 4 hours in this sprint purely to prompt iteration with real NGO content samples

---

### Sprint 3 — Week 5–6: Core AI Content Generation (LinkedIn, Instagram, Twitter)

**Goal:** The core product works. Users can generate platform-specific, on-brand content about any topic related to their mission.

**Deliverables:**
- Content Generation form: topic/brief input (free text, up to 500 chars), platform selector (LinkedIn / Instagram / Twitter/X), tone adjustment (override brand defaults), optional: attach a stat, a quote, or an image
- LinkedIn post generator: 150–300 word professional post, hashtags (5–8), call-to-action
- Instagram caption generator: 50–150 word caption, hashtags (10–15), emoji integration, story hook line
- Twitter/X thread generator: 3–5 tweet thread OR single tweet (280 chars), hashtags (2–4)
- "Regenerate" button: same brief, different output (temperature variation)
- Copy-to-clipboard for each platform output
- Character/word count display per platform
- Content saved automatically to history on generation

**Technical Tasks:**
- FastAPI: `POST /content/generate` — accepts platform, brief, brand_profile_id, optional attachments
- Prompt engineering: separate, versioned system prompts per platform (stored in `/backend/prompts/` as Jinja2 templates)
- Brand context injection into every generation request
- Platform-specific output parsers: validate character limits, hashtag counts, structure
- Celery task for async generation with job polling endpoint (`GET /content/job/{job_id}`)
- Next.js: content generation page with real-time streaming (Server-Sent Events from FastAPI)
- Streaming response handler: token-by-token display as content generates
- Content database: `generated_contents` table (platform, brief, output, model, tokens_used, brand_profile_id, created_at)
- Redis caching: cache identical brief+platform+brand_profile combos for 1 hour (cost optimization)

**Acceptance Criteria:**
- [ ] LinkedIn post generated in < 6 seconds (p95)
- [ ] Instagram caption generated in < 6 seconds (p95)
- [ ] Twitter thread generated in < 8 seconds (p95)
- [ ] Generated content respects brand voice (manual review with 3 NGO prompts)
- [ ] Regenerate produces meaningfully different output (not just minor word swaps)
- [ ] Content auto-saves to history without user action
- [ ] Streaming display works without UI jank

**Risks:**
- OpenAI rate limits at scale → mitigation: implement model fallback chain (GPT-4o → Claude Sonnet → Gemini Pro) from day one
- Prompt quality inconsistency → mitigation: build prompt eval harness, test 20 sample briefs per platform before merging

---

### Sprint 4 — Week 7–8: Basic Dashboard + Content History

**Goal:** Users have a home base. They can see what they've generated, manage their content, and understand their usage at a glance.

**Deliverables:**
- Dashboard homepage: recent content (last 5 items), quick-generate button, usage stats (posts generated this month), brand profile completion indicator
- Content history page: paginated list of all generated content, filterable by platform, date range, keyword search
- Content detail view: full generated content, original brief, regeneration option, edit mode (manual edits saved), copy button
- Content status: Draft, Approved, Published, Archived
- Bulk actions: select multiple → archive, export (CSV)
- Basic usage metrics: total posts generated, posts by platform (pie chart), generation frequency (weekly bar chart)
- Account settings: update brand profile, manage team members, billing placeholder

**Technical Tasks:**
- FastAPI: `GET /content/history` (paginated, filtered), `PATCH /content/{id}` (status update, manual edit), `DELETE /content/{id}`
- Next.js: dashboard layout with sidebar navigation, breadcrumbs, responsive design
- Content history table component: sorting, filtering, pagination (server-side)
- Simple charts: Recharts library (keep bundle small)
- Optimistic UI updates for status changes
- `supabase/migrations/004_content_status.sql` — add status, edited_content, approved_at columns

**Acceptance Criteria:**
- [ ] History page loads < 1.5 seconds with up to 500 items
- [ ] Content search returns results in < 500ms
- [ ] Status changes persist and reflect immediately in UI
- [ ] Dashboard renders correctly on mobile (390px width minimum)
- [ ] CSV export includes all visible columns and filters applied

**Risks:**
- Dashboard scope creep (adding analytics too early) → mitigation: ship minimal charts only, full analytics is Phase 2
- Mobile responsiveness deprioritized → mitigation: test on mobile after every UI sprint

---

### Sprint 5 — Week 9–10: Content Repurposing Engine

**Goal:** A user's best-performing idea shouldn't live only on LinkedIn. One brief becomes three platform-ready pieces of content automatically.

**Deliverables:**
- "Repurpose" button on any generated content item
- Repurposing flow: select source content → select target platforms → generate all variants in one click
- Cross-platform adaptation engine: not just resizing text — genuinely rewriting for platform context (e.g., LinkedIn thought leadership → Instagram personal story hook → Twitter punchy stat)
- "Content Package" view: see all 3 platform variants side-by-side
- Export package: copy all, or export as formatted PDF/text file
- Repurposing from external text: paste any article/report snippet → generate social posts from it
- URL-to-content: paste a news article URL → scrape summary → generate posts (basic web scraper)

**Technical Tasks:**
- FastAPI: `POST /content/repurpose` — accepts source_content_id or raw_text or url, target_platforms list
- Multi-platform prompt chaining: generate LinkedIn → extract key themes → generate Instagram using themes → generate Twitter using themes (reduces hallucination vs. generating from brief independently)
- URL scraper: BeautifulSoup + httpx for basic article extraction (respect robots.txt)
- Content Package DB model: `content_packages` table linking multiple `generated_contents`
- Next.js: side-by-side comparison view, package export
- PDF export: `pdfkit` or `weasyprint` for basic content package PDFs

**Acceptance Criteria:**
- [ ] Repurposing 1 → 3 platforms completes in < 12 seconds
- [ ] Repurposed content is demonstrably platform-appropriate (not copy-paste)
- [ ] URL scraping works for top 10 Indian news sites (The Hindu, Times of India, etc.)
- [ ] Content package PDF renders cleanly with brand colors/logo

**Risks:**
- URL scraping blocked by paywalls/CAPTCHAs → mitigation: graceful fallback to "could not extract content, please paste manually"
- Repurposing quality lower than direct generation → mitigation: theme extraction step in prompt chain solves most cases

---

### Sprint 6 — Week 11–12: MVP Testing, Bug Fixes, First User Onboarding

**Goal:** The MVP is stable, tested, and ready for first real users. We run a closed beta with 10 NGOs/CSR teams.

**Deliverables:**
- Full end-to-end QA pass: all Sprint 1–5 features tested on Chrome, Firefox, Safari, Mobile Safari
- Performance audit: Lighthouse scores > 85, API p95 latencies within targets
- Error handling audit: every API endpoint has proper error responses, UI shows meaningful error messages (no raw stack traces exposed)
- Loading states: every async operation has a skeleton/spinner
- Onboarding email flow: signup → welcome email → "Set up your brand profile" → "Generate your first post" (3-email drip, SendGrid)
- In-app onboarding checklist: 5-step checklist on dashboard (complete brand profile, generate first post, repurpose content, etc.)
- User feedback widget: in-app "Rate this content" (thumbs up/down) + optional comment, stored in DB
- Session analytics: PostHog integration (page views, generation events, copy events)
- Beta invite system: invite codes, waitlist form on marketing landing page (basic Next.js static page)
- Security audit: dependency vulnerability scan, Supabase RLS pen-test, API auth on all endpoints

**Technical Tasks:**
- Playwright E2E test suite: cover the 5 core user journeys
- PostHog event tracking: `content_generated`, `content_repurposed`, `content_copied`, `brand_profile_completed`
- SendGrid transactional email templates (HTML)
- Rate limiting: FastAPI middleware, 60 req/min per user, 1000 generations/month per org (free tier)
- Error monitoring: Sentry on both FastAPI and Next.js
- `supabase/migrations/005_feedback.sql` — content_feedback table
- Accessibility: keyboard navigation, ARIA labels on all interactive elements, color contrast audit

**Acceptance Criteria:**
- [ ] Zero P0 bugs at beta launch
- [ ] All API endpoints return proper 4xx/5xx with message (no 500s exposed to client)
- [ ] Onboarding checklist completion rate > 70% in first 10 beta users
- [ ] Lighthouse performance score > 85 on dashboard homepage
- [ ] PostHog tracking fires correctly for all 5 core events

**Risks:**
- Beta users found via wrong channels (technical people, not NGO staff) → mitigation: recruit directly through NGO networks, field staff preferred
- Low content quality feedback → mitigation: 3 prompt revision rounds based on first user sessions before public launch

---

## 4. Phase 2: Growth Features (Months 4–6)

### Campaign Management System
- Campaign entity: name, goal, start/end date, linked awareness days, content count target
- Campaign brief: key message, target outcome, linked posts, campaign progress tracker
- Campaign content calendar: visual timeline view of all planned posts for a campaign
- Campaign performance summary (when posts are published and analytics hooked)

### Festival & Awareness Day Calendar
- Pre-loaded calendar: Menstrual Hygiene Day (May 28), World Toilet Day (Nov 19), World Water Day (Mar 22), Global Handwashing Day (Oct 15), World Sanitation Day, and 40+ more
- India-specific: Republic Day, Independence Day, Gandhi Jayanti with CSR-angle content suggestions
- One-click content generation from any awareness day ("Generate World Toilet Day post for LinkedIn")
- 30-day advance reminder: "World Toilet Day is in 30 days — start planning your campaign"
- Custom awareness days: organizations can add their own annual events

### Hashtag Intelligence
- Hashtag database: curated list of 500+ verified hashtags for sanitation, hygiene, CSR, NGO, India development sectors
- Hashtag scoring: volume estimate, niche relevance score, spam risk flag
- Hashtag sets: save reusable hashtag combinations per platform per campaign theme
- Trending hashtags: weekly refresh of top trending tags in the hygiene/CSR space (Twitter/LinkedIn API)
- Hashtag suggestions in-generation: suggestions appear while user types the brief

### Content Calendar (Drag-Drop)
- Monthly/weekly/daily view
- Drag posts between dates
- Quick-add from calendar (click date → generation form)
- Platform filter overlay
- Export calendar as PDF (for team review)
- Color-coded by platform and status

### Social Media Scheduling — LinkedIn First
- LinkedIn OAuth integration (LinkedIn Marketing API)
- Schedule a post: pick date/time, preview, confirm
- Queue management: see all upcoming scheduled posts
- Auto-best-time suggestions (based on LinkedIn engagement data for nonprofit sector)
- Publish-now option
- Scheduling failure handling: retry logic, email notification if post fails

### Basic Analytics
- Post reach/impressions (LinkedIn API data pull)
- Engagement rate per post
- Top-performing content (sorted by engagement)
- Platform comparison: LinkedIn vs. saved-draft-only for Instagram/Twitter
- Weekly email digest: "Your content performance this week"

### CSR Storytelling Engine
- 10 structured storytelling frameworks: Problem-Solution-Impact, Before-After-Bridge, Data Story, Human Interest, Partnership Spotlight, etc.
- Template gallery: fill in blanks → AI expands into full narrative post
- Impact number formatter: "You reach X people" → compelling stat-driven sentence with source citation placeholder
- Annual CSR report → social content pipeline: upload PDF/text extract → generate 10 social posts

### Founder Branding Engine
- Separate "personal brand" mode tied to an organization account
- Thought leadership post generator: input a point of view → LinkedIn article-length post
- Personal story templates: founder journey, field visit reflection, why-I-do-this narrative
- Differentiated from org voice: founder speaks personally, org speaks institutionally

---

## 5. Phase 3: Scale & Intelligence (Months 7–9)

### Multi-Platform Scheduling
- Instagram Graph API: schedule feed posts (image required), carousel posts
- Twitter/X API v2: schedule tweets and threads
- Unified publishing queue: all platforms in one timeline view
- Cross-post with per-platform adaptation (auto-resize captions, hashtag swap)

### Advanced Analytics Dashboard
- Content performance matrix: reach × engagement × platform × content type
- AI content quality correlation: do higher-scored AI posts actually perform better?
- Audience growth tracking (where APIs allow)
- Campaign ROI summary
- Comparative benchmarks: how does this org perform vs. anonymized sector averages?
- Custom date ranges, downloadable CSV/PDF reports

### Brand Voice Cloning
- Upload 20–50 historical posts → AI extracts voice fingerprint
- Voice similarity score on every generated piece
- Voice drift detection: "This generated post diverges significantly from your brand voice"
- Multiple voice profiles per org (different campaigns, different spokespeople)

### AI Content Quality Scoring
- Real-time quality score (0–100) on every generated post
- Score dimensions: clarity, emotional resonance, CTA strength, platform fit, brand voice match
- Automated rewrite suggestions for low-scoring areas
- Quality gate: warn before saving content below score threshold

### Multi-Language Support
- Hindi + English to start
- Language selector per generation request
- Transliteration support: Hindi in Devanagari and Romanized forms
- Hinglish mode: natural code-switching common in Indian NGO social media
- Language detection on uploaded example content

### Team Collaboration
- Comments on content: team members can comment on drafts
- Approval workflow: Member generates → Admin approves → Owner publishes
- Content assignment: assign drafts to team members for review
- Revision history: see all edits with who made them
- @mentions in comments (in-app notification)

### Advanced Campaign Management
- Campaign templates: save a campaign structure as a template for annual events
- Campaign brief AI generator: input campaign goal → AI generates a full campaign brief with suggested content plan
- Multi-org campaign: for CSR companies coordinating with implementing NGOs
- Campaign cloning: duplicate last year's Menstrual Hygiene Day campaign

### Bulk Content Generation
- CSV upload: list of topics/briefs → generate all at once (background Celery job)
- Bulk repurpose: select 10 posts → repurpose all to a new platform overnight
- Batch export: download 30 days of content as a formatted PDF/Word doc
- Content queue automation: "Generate 3 posts per week for next month on WASH topics"

---

## 6. Phase 4: Enterprise & Expansion (Months 10–12)

### White-Label Offering
- Custom domain support (`social.ngo-name.org`)
- Logo, color, font customization
- Remove Brandora branding
- Custom onboarding flows
- White-label pricing: starting at 3x standard plan

### API Access
- REST API with API key authentication
- Endpoints: generate content, manage brand profiles, fetch history
- Developer documentation (auto-generated + hand-written guides)
- Webhooks: notify external systems when content is generated/approved
- API rate limits and usage dashboard
- Sandbox environment for testing

### Advanced AI Features
- GPT-4o Vision: analyze uploaded campaign photos → generate context-aware captions
- Trend prediction: predict upcoming hygiene/CSR conversation topics (fine-tuned model on sector news)
- Competitor intelligence: monitor public social accounts of peer NGOs (with permission)
- AI editor: paste any content → get a rewrite with specific improvements (more punchy, shorter, more data-driven)

### Integrations
- Zapier: connect Brandora AI to 5,000+ apps (Google Sheets → content brief, content generated → notify Slack)
- Make (Integromat): same capability, more technical users
- HubSpot CRM: sync campaign performance to CRM
- Canva: export text content directly to Canva for visual design
- Google Workspace: export to Google Docs for review workflows

### Mobile App (React Native)
- iPhone + Android
- Quick-generate from mobile (full generation flow)
- View and approve content
- Post immediately or schedule
- Push notifications: scheduled post published, team approval needed
- Offline draft mode

### Advanced Reporting
- Board presentation mode: one-click "CSR Impact Report" PDF with content performance + reach metrics
- Impact storytelling report: quantify estimated reach of awareness campaigns
- Donor communication package: auto-generate monthly donor updates from campaign activity
- Regulatory CSR reporting: India Companies Act 2% CSR spend disclosure narrative generator

### Custom Templates Marketplace
- Community-submitted templates: other users can share their prompt templates
- Verified templates: Brandora-curated high-quality templates
- Template monetization: creators earn credits when their templates are used
- Template categories: awareness days, case studies, impact reports, event promotion

---

## 7. Engineering Milestones

| Milestone | Month | Description |
|-----------|-------|-------------|
| M1: Zero-to-One | End of Month 1 | First end-to-end content generation working in staging |
| M2: MVP Live | End of Month 3 | 10 beta users generating content in production |
| M3: Scheduling Live | End of Month 5 | First post published to LinkedIn via Brandora AI |
| M4: Analytics Live | End of Month 6 | First user sees their content performance data |
| M5: Voice Intelligence | End of Month 8 | Brand voice cloning working for 3 pilot orgs |
| M6: Multi-language | End of Month 9 | Hindi content generation live |
| M7: API Beta | End of Month 11 | First external developer using API |
| M8: White-label Live | End of Month 12 | First white-label customer signed |

---

## 8. Dependency Map

```
AUTH & ORG SETUP (Sprint 1)
    └── BRAND PROFILE (Sprint 2)
            └── CONTENT GENERATION (Sprint 3)
                    ├── CONTENT HISTORY (Sprint 4)
                    ├── CONTENT REPURPOSING (Sprint 5)
                    ├── CAMPAIGN MANAGEMENT (Phase 2)
                    │       └── CONTENT CALENDAR (Phase 2)
                    │               └── SCHEDULING (Phase 2)
                    │                       └── ANALYTICS (Phase 2/3)
                    ├── HASHTAG INTELLIGENCE (Phase 2)
                    ├── BRAND VOICE CLONING (Phase 3)
                    │       └── VOICE QUALITY SCORING (Phase 3)
                    ├── MULTI-LANGUAGE (Phase 3)
                    ├── TEAM COLLABORATION (Phase 3)
                    │       └── APPROVAL WORKFLOW (Phase 3)
                    └── BULK GENERATION (Phase 3)
                            └── API ACCESS (Phase 4)

AWARENESS DAY CALENDAR (Phase 2) — depends on: Campaign Management
CSR STORYTELLING ENGINE (Phase 2) — depends on: Content Generation
FOUNDER BRANDING (Phase 2) — depends on: Brand Profile
WHITE LABEL (Phase 4) — depends on: all Phase 1-3 features stable
MOBILE APP (Phase 4) — depends on: API Access
INTEGRATIONS (Phase 4) — depends on: API Access + Scheduling
```

---

## 9. Risk Register

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OpenAI rate limits / outages blocking core product | Medium | Critical | Multi-model fallback chain (GPT-4o → Claude Sonnet → Gemini Pro) from Sprint 3 |
| AI content quality below bar for domain (NGO/CSR) | High | High | Domain-specific prompt tuning; feedback loop from beta users baked into Sprint 6 |
| LinkedIn API deprecations / rate limits | Medium | High | Abstract social APIs behind internal service layer; monitor API changelog weekly |
| Supabase RLS bugs causing data leaks | Low | Critical | Automated RLS tests in CI; security review before every production deployment |
| Scaling costs (OpenAI tokens) eating margins | Medium | High | Aggressive caching (Redis), prompt compression, tiered model usage (cheap model for drafts, premium for final) |
| Cold start latency on Railway containers | Low | Medium | Keep-alive pings every 5 min; minimum 1 always-on instance |

### Startup Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NGO users lack budget for paid SaaS | High | Critical | Freemium tier (50 generations/month free); CSR company subsidizes NGO partner accounts |
| Too few users in niche to reach PMF signal | Medium | High | Identify 3 large CSR umbrella bodies as channel partners; 1 contract = 20+ orgs |
| Competitor (Buffer, Hootsuite) builds NGO vertical | Low | Medium | Our moat: domain-specific AI prompts, awareness day calendar, CSR storytelling — generic tools cannot match depth |
| Team burnout at 2-engineer pace | Medium | High | Strict sprint scope, no crunch culture, 20% buffer in every sprint for unplanned work |
| Regulatory: India data localization | Low | Medium | Use Supabase with ap-south-1 (Mumbai) region from day one |

### AI Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI generates factually incorrect health information | Medium | High | Disclaimer on all generated content; prompt instructions to not make medical claims; human review workflow |
| Prompt injection via user brief input | Medium | Medium | Input sanitization; system prompt hardening; test adversarial inputs before launch |
| Brand voice drift over time | Low | Medium | Voice drift detection feature (Phase 3); periodic voice recalibration prompts |
| Model capability regression after provider updates | Low | Medium | Pin model versions in production; staging tests against new model versions before upgrading |

---

## 10. Team Scaling Plan

### Month 1–3 (2 Engineers + 1 Founder/PM)
- Engineer 1: Backend (FastAPI, AI integration, database)
- Engineer 2: Frontend (Next.js, UI/UX)
- Founder: Product, customer development, prompt engineering

### Month 4–6 (Add 1 Role)
- Hire: Full-stack Engineer 3 (handles scheduling integrations, analytics backend)
- Founder shifts more to sales, fundraising, partnerships

### Month 7–9 (Add 2 Roles)
- Hire: Product Designer (UX for collaboration features, mobile design)
- Hire: Growth/Community Manager (user onboarding, NGO partnerships, content for Brandora's own channels)

### Month 10–12 (Add 2 Roles)
- Hire: Backend Engineer 4 (API platform, enterprise integrations, white-label infrastructure)
- Hire: Customer Success Manager (onboard enterprise clients, build playbooks)

**Freelance/Contract Resources (Throughout):**
- Prompt engineer: 20 hrs/month for domain-specific prompt tuning
- Security auditor: quarterly reviews
- Hindi translator/cultural consultant: Month 9 for multi-language QA

---

## 11. Technology Evolution

### MVP (Months 1–3): Monolith with Clear Module Boundaries
```
Next.js 14 (App Router, Vercel)
FastAPI (Railway, single container)
Supabase (PostgreSQL + Auth + Storage + Realtime)
Redis (Railway, Celery broker)
OpenAI GPT-4o (primary), Claude Sonnet (fallback)
```

### Phase 2 (Months 4–6): Modular Services
```
Add: Celery workers (separate Railway container) for scheduling, async jobs
Add: Social API integrations (LinkedIn, later Instagram, Twitter)
Add: PostHog (analytics), Sentry (errors), SendGrid (email)
Split: Content generation into its own FastAPI router with dedicated Redis cache
```

### Phase 3 (Months 7–9): Intelligence Layer
```
Add: Vector store (Pinecone or pgvector in Supabase) for brand voice fingerprinting
Add: Background AI evaluation pipeline (quality scoring, voice drift detection)
Add: Translation microservice (wraps OpenAI + custom glossary for NGO terminology)
Add: Webhooks service (for Phase 4 API)
```

### Phase 4 (Months 10–12): Platform Layer
```
Add: API Gateway (Kong or AWS API Gateway) for external API access
Add: React Native mobile app (Expo)
Add: White-label multi-tenancy layer (subdomain routing, theme engine)
Add: Event streaming (consider Kafka if scheduling volume warrants it)
Evaluate: Move to Kubernetes on GCP if Railway costs become prohibitive at scale
```

---

*This roadmap is a living document. Review and revise at the start of each phase. Every major pivot should be documented as a numbered revision.*
