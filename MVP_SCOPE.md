# Brandora AI — MVP Scope Definition
**Version:** 1.0 | **Last Updated:** May 2026 | **MVP Window:** Months 1–3 (12 Weeks)

---

## 1. MVP Philosophy

### The Single Hard Question

Before writing a single line of MVP scope, answer this: **"What is the one thing that, if it works well, makes an NGO communication manager tell three colleagues about Brandora AI next week?"**

The answer: **"I described my organization's mission, and it wrote better LinkedIn content than I could have in an hour — in 30 seconds."**

Everything in the MVP exists to deliver that moment. Everything that does not serve that moment is out.

### What the MVP Is

The MVP is a **focused AI content generation tool** for NGOs and CSR organizations working in the sanitation and menstrual hygiene sector. It does one thing very well: it takes a brief from a communication manager and produces publication-ready social media content that sounds like it was written by a seasoned NGO communications professional who deeply understands their mission.

The MVP is NOT:
- A social media management platform (no publishing, no scheduling)
- An analytics tool (no performance tracking)
- A collaboration tool (no team workflows)
- A campaign management system
- A content calendar
- A mobile app

### The Constraint that Protects Quality

**Hard limit: 3 platforms, 1 core flow.** LinkedIn is primary. Instagram and Twitter/X are secondary. If the LinkedIn content generation is not excellent, nothing else matters. Platform breadth is a Phase 2 problem. Generation quality is an MVP problem.

### What "Done" Means for the MVP

The MVP is done when:
1. A communication manager at a menstrual hygiene NGO can sign up, describe their brand, and generate a LinkedIn post in under 10 minutes — without any guidance from us.
2. The generated content requires no more than minor edits before publishing.
3. They come back the next day and generate more.

---

## 2. MVP Core Hypothesis

**Primary hypothesis:** NGO and CSR communication teams are bottlenecked by content creation — they know what they want to say but struggle to translate mission knowledge into polished, platform-appropriate social media content. An AI tool trained specifically on the sanitation/hygiene/CSR domain will remove this bottleneck and save 5–10 hours/week per team.

**Secondary hypothesis:** The domain-specificity matters. A generic ChatGPT wrapper will not retain these users. The awareness day calendar, hygiene-sector hashtags, and CSR storytelling frameworks are not features — they are proof that we understand their world.

**What we are NOT testing in the MVP:**
- Whether users will publish via Brandora (that is a Phase 2 hypothesis)
- Whether analytics drive retention (Phase 2/3 hypothesis)
- Whether team collaboration is necessary (Phase 3 hypothesis)
- Whether Hindi support unlocks a larger user segment (Phase 3 hypothesis)

---

## 3. MVP Success Metrics

### Primary Metrics (Must Hit to Proceed to Phase 2)

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Users generating content | 10 active orgs in beta | PostHog: `content_generated` event by unique org_id |
| Day-7 retention | 60% of beta users return within 7 days | PostHog cohort analysis |
| Generation-to-copy rate | > 50% of generated posts are copied (= user liked it) | PostHog: `content_copied` event / `content_generated` event |
| Time-to-first-generation | < 10 min from signup | PostHog: `signup` → `content_generated` funnel |
| Qualitative NPS (beta survey) | > 40 | Manual survey at week 4 of beta |
| Content quality rating | > 70% thumbs-up on in-app rating widget | `content_feedback` table |

### Secondary Metrics (Leading Indicators)

| Metric | Target |
|--------|--------|
| Brand profile completion rate | > 80% of signups complete brand profile |
| Average generations per active user per week | > 5 |
| Repurpose usage | > 30% of users use repurpose feature within first week |
| Avg session duration | > 8 minutes |
| Organic referrals from beta users | > 2 new orgs introduced by existing beta users |

### Failure Criteria (Triggers Pivot, Not Phase 2)

- Less than 5 of 10 beta users generate content in week 2
- Generation-to-copy rate below 30% (content quality unacceptable)
- Multiple users report generated content is factually wrong or tone-deaf to NGO context
- Zero organic referrals after 8 weeks of beta

---

## 4. MVP Features — Must Have

### Feature 1: User Auth + Organization Setup

**What it is:** Signup/login via email or Google OAuth. Upon first login, a 3-step wizard: (1) Create your organization, (2) Select your sector focus, (3) Invite team members (optional).

**Why it's in MVP:** Without org context, the AI cannot generate domain-specific content. The org setup is the minimum context needed to distinguish a menstrual hygiene NGO from a corporate CSR team — these require different tones, terminology, and hashtags.

**Scope boundaries:**
- Email + Google OAuth only (no SSO, no SAML)
- One organization per account (no multi-org in MVP)
- Roles: Owner only in MVP (Admin/Member roles in Phase 2)
- Organization types: NGO / CSR Company / Both
- Sector tags: Menstrual Hygiene, Sanitation, WASH, Rural Development, Urban Sanitation (multi-select)

**Out of MVP scope:** Team invitation email flow (users can add members later), social proof on signup page, referral tracking.

---

### Feature 2: Brand Profile + Voice Configuration

**What it is:** A structured form where organizations describe their identity — mission, audience, tone, keywords, and example content.

**Why it's in MVP:** This is the AI's memory of who the organization is. Without it, every generation is generic. With it, every generation sounds like it came from inside the organization.

**Scope boundaries:**
- Mission statement (free text, 200 chars max)
- Focus areas (from org sector tags, extendable)
- Primary audience (multi-select: Donors, Corporates, Youth, Policymakers, General Public, Field Partners)
- Geography (India / Global / Both)
- Brand tone (3 sliders: Formal ↔ Casual, Serious ↔ Hopeful, Data-driven ↔ Story-driven)
- Brand keywords (up to 15): words the brand uses frequently
- Words to avoid (up to 10)
- Example content upload: paste up to 3 previous posts as style reference
- Logo upload (PNG/JPG, up to 5MB, stored in Supabase Storage)
- Voice preview: enter any topic, get a one-paragraph sample

**Out of MVP scope:** Multiple voice profiles per org, version history of brand profiles, AI-assisted voice extraction from bulk historical posts (Phase 3).

---

### Feature 3: AI Content Generation — LinkedIn (Primary)

**What it is:** The core product. Enter a brief (what you want to say), get a polished LinkedIn post back in seconds.

**Why it's in MVP:** This is the entire value proposition. If this is not excellent, nothing else matters.

**Scope boundaries:**
- Brief input: free text, up to 500 characters
- Optional context: add a statistic, a quote, or a key message (structured fields)
- Output: 150–300 word post, 5–8 hashtags, call-to-action line
- Tone override: user can adjust tone sliders per generation (overrides brand defaults)
- Regenerate button: new variation of the same brief
- Character counter showing LinkedIn limits
- Copy to clipboard (full post + hashtags)
- Content auto-saved to history

**AI implementation:** GPT-4o primary, Claude Sonnet 3.5 fallback. Jinja2 prompt templates per platform, brand context injected from profile.

**Quality bar:** Must pass internal review: NGO communication expert rates 20 sample outputs before sprint sign-off. Target: > 80% rated as "publishable with minor or no edits."

**Out of MVP scope:** AI image generation for posts, LinkedIn-specific scheduling, engagement prediction, performance tracking.

---

### Feature 4: AI Content Generation — Instagram

**What it is:** Instagram caption generator optimized for the visual-first, story-driven nature of Instagram.

**Why it's in MVP:** Instagram is the second most-used platform by Indian NGO communication teams for visual storytelling. Menstrual hygiene campaigns have extremely strong visual components (period poverty photography, field visits). Users will ask for Instagram on Day 1.

**Scope boundaries:**
- Output: 80–150 word caption, story hook line (first sentence optimized for "more" click), 10–15 hashtags, emoji suggestions (optional toggle)
- Same brief input form as LinkedIn
- Output visually differentiated from LinkedIn output in the UI
- Character counter showing Instagram best-practice limits (2,200 chars hard limit, 125 visible)

**Out of MVP scope:** Instagram API integration (no scheduling in MVP), Instagram Stories format, Reels scripts, carousel post copy, image recommendations.

---

### Feature 5: AI Content Generation — Twitter/X

**What it is:** Twitter thread and single-tweet generator for punchy, shareable content.

**Why it's in MVP:** Twitter/X remains relevant for policy advocacy, government engagement, and journalist outreach — key channels for sanitation organizations doing advocacy work.

**Scope boundaries:**
- Output options: single tweet (280 chars) OR 3-tweet thread
- Thread: each tweet stands alone AND flows as a sequence
- Hashtags: 2–4 per tweet
- Character counter (hard stop at 280 per tweet)
- Thread numbering display (1/3, 2/3, 3/3)

**Out of MVP scope:** Twitter API scheduling, quote-tweet templates, Twitter Spaces promotion copy, Twitter analytics.

---

### Feature 6: Content Repurposing (1 Idea → 3 Formats)

**What it is:** Select any existing generated post and produce adapted versions for the other two platforms in one click.

**Why it's in MVP:** Repurposing is the highest-leverage workflow for small NGO teams. A communication manager who writes one good LinkedIn post should not have to write two more from scratch. This feature directly delivers the "5–10 hours saved per week" promise.

**Scope boundaries:**
- Source: any saved LinkedIn, Instagram, or Twitter post in the user's content history
- Target: select 1–3 platforms to generate for
- Output: full adapted posts for each selected platform (not just reformatted — genuinely rewritten for platform context)
- Side-by-side comparison view: see source and all variants together
- Each variant independently copyable and editable

**Out of MVP scope:** URL-to-posts pipeline (Phase 2), bulk repurpose (Phase 3), cross-posting with auto-publish.

---

### Feature 7: Content History + Management

**What it is:** A searchable, sortable library of all content ever generated by the organization.

**Why it's in MVP:** Without history, users lose generated content. History also builds habit — users return to see what they generated last week, to repurpose it, to share it with a colleague. It transforms Brandora from a tool into a system.

**Scope boundaries:**
- List view: all generated content, newest first
- Filters: by platform, by date range
- Search: keyword search across brief and generated content text
- Content statuses: Draft, Approved, Archived (no "Published" in MVP — no scheduling)
- Manual edit: click any saved post, edit the text directly, save changes
- Delete individual posts
- Copy button on each item

**Out of MVP scope:** Bulk export, CSV download, advanced sorting (by rating, by engagement), team member filter (Phase 3).

---

### Feature 8: Hashtag Generation (Basic)

**What it is:** Every generated post includes platform-appropriate, domain-specific hashtags. Users can also request standalone hashtag suggestions.

**Why it's in MVP:** Hashtags are not optional in NGO social media. They are how organizations get discovered by journalists, donors, policymakers, and peer organizations. Generic AI hashtags (#socialgood #nonprofit) are useless. Domain hashtags (#MenstrualHygieneDay #WASH #Swachh) are valuable.

**Scope boundaries:**
- Auto-included with every generation (not a separate step)
- Hashtag count adheres to platform best practices (LinkedIn: 5–8, Instagram: 10–15, Twitter: 2–4)
- Curated database of 300+ verified sector hashtags seeded from research
- Mix: evergreen sector tags + campaign-specific tags + brand hashtag placeholder
- "Refresh hashtags" button: generate a new set without regenerating the post body

**Out of MVP scope:** Hashtag trending data (Phase 2), hashtag performance tracking, saved hashtag sets (Phase 2), real-time trending pulls from Twitter/LinkedIn APIs.

---

### Feature 9: CSR Storytelling Templates (5 Templates)

**What it is:** Structured fill-in-the-blank templates that guide users to input the right information for common CSR/NGO storytelling formats, then expand into full posts.

**Why it's in MVP:** Not every communication manager starts with a clear brief. Templates lower the barrier to generation — especially for users who know they want to write about a field visit but don't know how to frame it as a LinkedIn post.

**The 5 MVP Templates:**

1. **Field Visit Report** — Location, what was observed, impact statistic, call-to-action → LinkedIn post
2. **Impact Milestone** — Number achieved, what it means, how long it took, who made it possible → LinkedIn + Instagram
3. **Partnership Spotlight** — Partner name, nature of collaboration, joint impact achieved → LinkedIn
4. **Awareness Day Post** — Day name, why it matters to the org, one key fact, what readers can do → All platforms
5. **Volunteer/Field Worker Story** — Person name (optional), role, specific moment, lesson → Instagram + LinkedIn

**Scope boundaries:**
- Templates appear as pre-filled brief options on the generation page
- Each template has guided field inputs (not just one text box)
- Template output flows through the same generation pipeline as regular briefs
- Templates are read-only in MVP (users cannot create custom templates until Phase 4)

**Out of MVP scope:** Template marketplace, user-submitted templates, template performance analytics, custom template builder.

---

### Feature 10: Awareness Day Content — Menstrual Hygiene + Sanitation Focus

**What it is:** A pre-loaded calendar of key awareness days with one-click content generation pre-seeded with day-specific context and messaging angles.

**Why it's in MVP:** Awareness days are the highest-traffic moments for NGO social media. Menstrual Hygiene Day (May 28) and World Toilet Day (November 19) can drive 5–10x normal engagement. Organizations that post on these days with quality content get noticed. Missing them is a major communication failure. This feature makes missing them impossible.

**MVP awareness day list (12 days):**
1. Menstrual Hygiene Day — May 28
2. World Toilet Day — November 19
3. World Water Day — March 22
4. Global Handwashing Day — October 15
5. World Menstrual Health Day — May 28 (same as MH Day; separate framing)
6. World Environment Day — June 5 (sanitation angle)
7. Swachh Bharat Mission Anniversary — October 2
8. Republic Day — January 26 (CSR/national development angle)
9. Independence Day — August 15 (impact reporting angle)
10. World Health Day — April 7
11. International Day of Rural Women — October 15
12. Universal Children's Day — November 20

**Scope boundaries:**
- Dashboard widget: "Upcoming awareness days in the next 30 days"
- Click any day → pre-filled generation form with the day's name, significance, and suggested messaging angle injected into the brief
- User can edit the pre-filled brief before generating
- 30-day advance display only (no full year calendar view in MVP)

**Out of MVP scope:** Full annual calendar view, drag-drop calendar planning, India state-level awareness days, custom awareness day addition (Phase 2), email/push reminders.

---

### Feature 11: Basic Dashboard

**What it is:** The home screen users see after login — a summary of their activity, quick access to generate content, and their brand profile status.

**Why it's in MVP:** The dashboard sets the mental model for the product. It must communicate "you are a content creator, here's your studio" not "here's a form to fill in."

**Scope boundaries:**
- Quick-generate button (most prominent element)
- Recent content: last 5 generated posts with preview and copy button
- Usage counter: "Posts generated this month: X / 100" (free tier limit)
- Upcoming awareness days widget (next 3 days in the next 30 days)
- Brand profile completion card (shows incomplete sections)
- 5-step onboarding checklist (complete brand profile, generate first post, try repurpose, try a template, try an awareness day)
- Responsive: desktop-first, functional on mobile

**Out of MVP scope:** Full analytics section, team activity feed, campaign progress widgets, performance metrics.

---

## 5. MVP Features — Intentionally Excluded

The following features are deliberately NOT in the MVP. This list is as important as the inclusion list.

| Feature | Why Excluded |
|---------|--------------|
| Social media scheduling / publishing | Requires LinkedIn/Instagram/Twitter API approvals (takes 2–4 weeks), adds compliance complexity, and is not the core value prop. Users will copy-paste in MVP. |
| Analytics & performance tracking | Requires publishing integration (excluded above). Analytics without publishing data is meaningless. |
| Team collaboration & approval workflows | Adds auth complexity (roles, notifications, email flows). Most beta users are 1-person communication teams. Phase 3. |
| Content calendar (visual, drag-drop) | Only useful when scheduling is live. Drag-dropping draft posts is not a pain point. Phase 2. |
| Campaign management system | Users need to understand core generation value before managing campaigns. Phase 2. |
| Mobile app | Web-first to validate core UX. React Native in Phase 4. |
| Hindi / multi-language support | Phase 3. English is sufficient to validate core hypothesis with urban NGO teams. |
| Brand voice cloning from historical posts | Complex ML pipeline. Phase 3. |
| AI image generation | Image quality needs to be exceptional to add value; mediocre images hurt brand. Excluded indefinitely until quality bar is met. |
| Canva / Google Workspace integrations | Phase 4. MVP users can copy-paste. |
| Zapier / Make integrations | Phase 4. |
| White-label / API access | Phase 4. |
| Custom template builder | Phase 4. |
| Competitor analysis / monitoring | Not a Day-1 problem. Phase 4 or never. |
| Billing & subscription management | Free beta for first 3 months. Add Stripe in Phase 2 when pricing is validated. |
| URL-to-content scraper | Useful but not core. Phase 2. |
| Bulk content generation | Phase 3. |
| CSR annual report-to-social pipeline | Phase 2 CSR storytelling expansion. |
| Founder personal branding engine | Phase 2. |

**The rule that governed exclusions:** "Could a beta user succeed without this?" If yes, it's out of the MVP.

---

## 6. MVP Technical Scope — Minimal but Production-Ready

### Architecture

```
Frontend: Next.js 14 (App Router) → Vercel
Backend: FastAPI (Python 3.12) → Railway (1 container, 2 CPU, 2GB RAM)
Database: Supabase (PostgreSQL, Auth, Storage, Realtime)
Cache: Redis (Railway, 256MB) — generation caching + Celery broker
Task Queue: Celery (Railway, 1 worker) — async content generation
AI: OpenAI GPT-4o (primary) + Claude Sonnet 3.5 (fallback)
Email: SendGrid (transactional: welcome, onboarding drip)
Monitoring: Sentry (errors), PostHog (analytics)
```

### What "Production-Ready" Means for the MVP

Production-ready does NOT mean enterprise-grade. It means:
- Zero data leaks between organizations (RLS enforced and tested)
- No unhandled errors that break the user flow silently
- 99.5% uptime target (Vercel + Railway + Supabase all have SLAs above this)
- API auth on every endpoint (Supabase JWT validation)
- No credentials in code (environment variables only)
- Dependency vulnerability scanning in CI (npm audit, pip audit)
- Sentry capturing 100% of unhandled exceptions
- Rate limiting: 60 req/min per user, 1,000 generations/month per org (free tier)

### What is NOT Production-Ready in the MVP (and That's OK)

- No horizontal scaling (single FastAPI container is fine for 100 users)
- No CDN for static assets beyond what Vercel provides
- No disaster recovery beyond Supabase's built-in daily backups
- No SOC 2 compliance
- No GDPR-complete flows (add in Phase 2 when non-Indian users appear)
- No load testing (add before Phase 2 scaling push)

### Database Schema (MVP Tables Only)

```sql
organizations (id, name, type, sector_tags, created_at)
users (id, email, org_id, role, created_at)          -- via Supabase Auth
brand_profiles (id, org_id, mission, audience, geography, tone_formal, 
                tone_serious, tone_data, brand_keywords, avoid_keywords, 
                example_posts, logo_url, created_at, updated_at)
generated_contents (id, org_id, user_id, platform, brief, output, 
                    model_used, tokens_used, status, edited_content, 
                    template_id, package_id, created_at)
content_packages (id, org_id, source_content_id, created_at)
content_feedback (id, content_id, user_id, rating, comment, created_at)
awareness_days (id, name, date_month, date_day, category, brief_seed, 
                suggested_angle, is_active)
```

### AI Cost Estimate (MVP Month)

Assuming 10 orgs × 50 generations/month = 500 generations.
- LinkedIn post: ~800 input tokens + 400 output tokens = 1,200 tokens
- GPT-4o pricing: $5/1M input, $15/1M output
- 500 × (800×$5/1M + 400×$15/1M) = 500 × ($0.004 + $0.006) = **$5/month**
- Budget for prompt development and testing: 5,000 test calls = ~$50

**MVP AI cost is negligible. Scale cost management from Phase 2 (1,000+ generations/day).**

---

## 7. MVP User Journey — End-to-End

### Journey: From Signup to First Published LinkedIn Post (Target: < 15 Minutes)

**Step 1: Discovery (Pre-product)**
- User finds Brandora AI via referral from beta invite, LinkedIn post, or NGO network
- Lands on marketing page: one hero message ("AI content for NGOs that gets it"), 3 example generated posts, "Join Beta" CTA
- Submits email → receives invite code email within 1 minute

**Step 2: Signup (3 minutes)**
- Enters email + invite code (or uses Google OAuth)
- Creates account
- Sees org creation wizard:
  - Step 1: "What is your organization's name?"
  - Step 2: "What does your organization work on?" (sector checkboxes)
  - Step 3: "What type of organization are you?" (NGO / CSR Company / Both)
- Lands on dashboard with 5-step onboarding checklist visible

**Step 3: Brand Profile Setup (5 minutes)**
- Onboarding checklist: Step 1 is "Complete your brand profile" → click → opens brand profile form
- User fills: mission statement (1–2 sentences they already know by heart), audience (checkboxes), tone sliders (30 seconds to adjust), 5 brand keywords
- Optional: pastes one old LinkedIn post as style example
- Clicks "Save" → sees "Voice Preview" prompt: "Enter any topic to see how I'll write for you"
- Types "menstrual hygiene awareness" → gets a paragraph → "Wow, that sounds like us"
- Step 1 of checklist turns green

**Step 4: First Content Generation (3 minutes)**
- Dashboard: clicks "Generate Content" button (or Step 2 of checklist)
- Platform selector: LinkedIn is default and highlighted
- Brief field: types "We just reached 50,000 women with our menstrual hygiene kits"
- Optional: adds stat "50,000 women across 3 districts"
- Clicks "Generate"
- Streaming response appears: token by token over ~4 seconds
- Sees a 200-word LinkedIn post with brand tone, 6 relevant hashtags, strong CTA
- Reads it, thinks "This is really good"
- Clicks "Copy" → pastes into LinkedIn → publishes manually
- Step 2 of checklist turns green

**Step 5: Repurpose (2 minutes)**
- Step 3 of checklist: "Repurpose to other platforms"
- Clicks → source content is pre-selected (last generated post)
- Selects Instagram + Twitter
- Clicks "Repurpose"
- Sees 3 panels: original LinkedIn post, Instagram caption with emojis and 12 hashtags, 3-tweet thread
- Copies Instagram caption
- Step 3 turns green

**Step 6: Return Visit (Day 2)**
- Email received day after signup: "Your first content looked great. What will you share next?"
- Opens app → sees yesterday's posts in history
- Notices "World Toilet Day is in 14 days" widget on dashboard
- Clicks → gets pre-seeded brief for World Toilet Day → generates post → schedules it manually in LinkedIn
- Now has a habit

**Total time from signup to first published post (manual LinkedIn publish): < 15 minutes.**

---

## 8. MVP Validation Plan — Testing with First 10 Users

### Beta User Recruitment Criteria

Target profile: Communication manager / program officer at an Indian NGO or CSR team working in menstrual hygiene, sanitation, or WASH sector. Must be the person responsible for their organization's LinkedIn presence. NOT a technical person.

**Recruitment channels (priority order):**
1. Founder's personal network in NGO/development sector
2. LinkedIn outreach to communication leads at top 20 India WASH NGOs
3. CSR bodies: GIZ, UNICEF India, WaterAid India, Sulabh International, Plan India
4. NGO networks: Credibility Alliance, VANI (Voluntary Action Network India)

**Beta cohort composition:**
- 5 NGOs (menstrual hygiene focus)
- 3 NGOs (sanitation/WASH focus)
- 2 CSR teams (corporate with WASH/hygiene portfolio)

### Beta Validation Protocol

**Week 1: Guided Onboarding**
- 30-minute Zoom call with each user (founder-led): walk through the product, observe where they hesitate, note every question
- Ask them to generate 3 posts live on the call
- Document every piece of generated content — did they copy it? Did they edit it? Did they discard it?

**Week 2: Independent Usage**
- No hand-holding. Users use the product independently.
- PostHog monitoring: who returned, what they generated, what they copied
- WhatsApp/email check-in on Day 5: "How's it going? Anything confusing?"

**Week 3: Structured Feedback**
- 20-minute async survey (Typeform):
  - NPS question
  - "How many hours per week does content creation normally take you?"
  - "How many hours did it take with Brandora AI?"
  - "What's missing that would make you use this every day?"
  - "Would you pay for this? What would you pay?"
  - Quality ratings for 3 specific generated posts they saved

**Week 4: Iteration Sprint**
- Synthesize all feedback
- Fix the top 3 friction points (not features — bugs and UX friction)
- Re-run 3 of the 10 users on the fixed flow
- If quality rating improves: ship to broader beta

### Pass/Fail Criteria for Validation

| Outcome | Decision |
|---------|----------|
| 7+ of 10 users generate content in week 2 without prompting AND quality rating > 70% thumbs-up | Proceed to Phase 2 planning, begin pricing conversations |
| 5–6 of 10 users active, quality mixed | Identify and fix specific quality issues, re-test before Phase 2 |
| < 5 of 10 users active OR quality < 50% thumbs-up | Fundamental pivot: re-examine AI quality and/or user profile targeting |

---

## 9. MVP → Phase 2 Transition

### Trigger Conditions (ALL must be true)

1. **Retention:** 60% of beta users return in week 2 AND 40% still active at week 6
2. **Quality:** Average content quality rating > 70% thumbs-up across all 10 beta orgs
3. **Demand signal:** At least 3 beta users ask "Can I schedule from here?" OR "Can I see which posts performed best?" (signals readiness for Phase 2 features)
4. **Willingness to pay:** At least 5 of 10 beta users indicate willingness to pay ≥ ₹2,000/month (or equivalent)
5. **Operational stability:** Zero P0 bugs in final 2 weeks of beta; all API p95 latencies within targets

### Phase 2 Entry Checklist

Before starting any Phase 2 feature development:
- [ ] Pricing model finalized (even if not yet enforced)
- [ ] Stripe integration planned (even if billing goes live mid-Phase 2)
- [ ] At least 1 user converted to paid (validates willingness-to-pay signal)
- [ ] LinkedIn API developer application submitted (approval takes 2–4 weeks; must start early)
- [ ] Instagram Basic Display API or Graph API application submitted
- [ ] Phase 2 sprint plan written and reviewed by team
- [ ] Technical debt from Phase 1 documented and scheduled (20% of Phase 2 sprints allocated)

### What Doesn't Change at the Phase 2 Transition

- Content generation quality remains the #1 engineering priority
- AI prompt versions are pinned; any model changes go through prompt regression testing
- RLS and auth architecture stays the same (add roles, do not rebuild)
- The brand profile remains the core context object for all AI features

---

*The MVP scope is a contract with the team. Nothing is added to this list without a formal decision that articulates which listed feature it replaces or which metric it is tested against.*
