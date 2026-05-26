# UI_UX_PLAN.md
# Brandora AI — Complete UI/UX Specification

---

## 1. DESIGN PHILOSOPHY

### AI-Native, Social-First, Premium SaaS

Brandora AI is not a generic content tool with a social media plugin. It is purpose-built for a niche — social impact communicators — and the design must telegraph this specialization from the first interaction.

**Four Design Principles:**

**1.1 Intelligence Visible**
The AI is not hidden in a loading spinner. Users should feel they are collaborating with an intelligent system — seeing partial generation stream in, watching quality scores update in real-time, understanding why the system made certain choices. The UX exposes AI reasoning at appropriate moments.

**1.2 Calm Complexity**
The platform handles genuinely complex tasks (multi-platform campaign management, brand voice management, analytics). The UI must make this feel manageable, not overwhelming. Complexity is revealed progressively — beginners see a simple interface; power users unlock depth.

**1.3 Trust as Visual Design**
NGO directors and CSR managers are institutional communicators with reputational stakes. The design must feel premium and credible — not like a consumer app with cute illustrations. Clean lines, professional typography, confident whitespace. The visual language of trusted institutions (The Economist, Notion, Linear).

**1.4 Content First**
Generated content is the product. Every design decision must serve the generated content's clarity and editability. The UI frames the content, never competes with it.

---

## 2. DESIGN SYSTEM

### 2.1 Color Palette

```
PRIMARY PALETTE:
  Brand Blue (Primary):      #1E40AF  — Deep authoritative blue
  Brand Blue Light:          #3B82F6  — Interactive, links, focus
  Brand Blue Pale:           #EFF6FF  — Backgrounds, hover states

SECONDARY PALETTE:
  Teal (Social Impact):      #0D9488  — Accent for impact metrics, success
  Teal Light:                #5EEAD4  — Charts, positive indicators
  Teal Pale:                 #F0FDFA  — Metric card backgrounds

ACCENT PALETTE:
  Amber (Awareness Days):    #D97706  — Awareness day badges, campaign urgency
  Amber Light:               #FCD34D  — Highlights, tags
  Coral (CSR):               #E11D48  — Alert states, critical actions

NEUTRAL PALETTE:
  Gray 950:  #030712   — Primary text
  Gray 800:  #1F2937   — Secondary text, headings
  Gray 600:  #4B5563   — Body text, labels
  Gray 400:  #9CA3AF   — Placeholder text, disabled
  Gray 200:  #E5E7EB   — Borders, dividers
  Gray 100:  #F3F4F6   — Card backgrounds
  Gray 50:   #F9FAFB   — Page background
  White:     #FFFFFF   — Card surfaces, inputs

SEMANTIC COLORS:
  Success:   #10B981   — Published, approved, high quality score
  Warning:   #F59E0B   — Scheduled, needs review, medium quality
  Error:     #EF4444   — Failed, rejected, API error
  Info:      #3B82F6   — Tips, suggestions, neutral alerts

PLATFORM COLORS:
  LinkedIn:  #0A66C2
  Instagram: #E1306C   (use gradient: #833AB4 → #FD1D1D → #FCAF45)
  Twitter/X: #000000
```

### 2.2 Typography Scale

```
FONT FAMILY:
  Display/Headings:  Inter (700, 600)
  Body:              Inter (400, 500)
  Monospace:         JetBrains Mono (prompt previews, code blocks)

TYPE SCALE:
  xs:   12px / 16px line — Labels, badges, metadata
  sm:   14px / 20px line — Secondary text, helper text
  base: 16px / 24px line — Body text, descriptions
  lg:   18px / 28px line — Section intros, card titles
  xl:   20px / 28px line — Page section headers
  2xl:  24px / 32px line — Page titles
  3xl:  30px / 36px line — Dashboard hero metrics
  4xl:  36px / 40px line — Landing page headings
  5xl:  48px / 56px line — Marketing hero

FONT WEIGHTS:
  Regular (400): Body text
  Medium (500):  Labels, interactive elements
  Semibold (600): Section headings, card titles
  Bold (700): Page headings, hero metrics
```

### 2.3 Spacing System

```
BASE UNIT: 4px

Scale:
  1  →  4px    (px, border-radius small)
  2  →  8px    (tight padding, small gaps)
  3  →  12px   (input padding vertical)
  4  →  16px   (standard padding, card internal)
  5  →  20px   (section internal padding)
  6  →  24px   (card padding standard)
  8  →  32px   (section gap)
  10 →  40px   (page section padding)
  12 →  48px   (large section spacing)
  16 →  64px   (page-level vertical rhythm)
  20 →  80px   (hero section padding)
  24 →  96px   (maximum section spacing)

Border Radius:
  sm:     4px   (badges, tags)
  base:   8px   (buttons, inputs, cards)
  md:     12px  (modals, popovers)
  lg:     16px  (content cards, panels)
  xl:     24px  (feature cards)
  full:   9999px (pills, avatars)
```

### 2.4 Component Library

**Base: Shadcn/ui**
- All Shadcn/ui components used as base layer
- Customized with Brandora design tokens
- Extended with domain-specific components

**Extended Component Categories:**
1. Content Generation Components (unique to Brandora)
2. Platform-Specific Badges and Indicators
3. Quality Score Visualizations
4. Campaign Progress Components
5. Calendar and Scheduling Components
6. Analytics Chart Components (built on Recharts)
7. AI Streaming Components (real-time text appearance)

### 2.5 Icon System

**Primary:** Lucide React (consistent, clean, MIT license)

**Platform Icons:** Simple Icons (brand logos for LinkedIn, Instagram, Twitter/X)

**Custom Icons (SVG, designed for Brandora):**
- BrandoraLogo (wordmark + icon)
- AISparkle (custom AI generation indicator)
- ImpactIcon (represents social impact context)
- PadlockPlus (trust indicator)
- SocialReach (reach/amplification)
- VoiceWave (brand voice indicator)

### 2.6 Motion and Animation Principles

```
PHILOSOPHY: Motion communicates state change and intelligence. It is never decorative.

TIMINGS:
  Micro (button state, hover):   100-150ms, ease-out
  Transition (panel open/close): 200-250ms, ease-in-out
  Entrance (page/modal entry):   300ms, spring(1, 0.8, 0.3)
  AI Generation:                 Streaming text — character-by-character or word-by-word
  Loading states:                Skeleton pulse 1.5s loop, 60% → 80% opacity

SPECIFIC ANIMATIONS:
  Content streaming:    Text appears word-by-word with fade-in per word
  Quality score:        Animated counter from 0 to score value on reveal
  Chart data:           Staggered bar/line entrance (150ms stagger between items)
  Campaign arc:         Post cards slide in sequentially (100ms stagger)
  Success states:       Checkmark draws along path (200ms)
  Platform selector:    Slide with spring bounce on selection

REDUCED MOTION: Respect prefers-reduced-motion — replace with instant transitions
```

---

## 3. INFORMATION ARCHITECTURE

### 3.1 Complete Sitemap

```
/ (Root — redirects to /dashboard or /login)

AUTH ROUTES (/auth):
  /auth/login
  /auth/register
  /auth/forgot-password
  /auth/reset-password
  /auth/verify-email
  /auth/invite/[token]

ONBOARDING (/onboarding):
  /onboarding/org-setup           Step 1: Org name, type, size
  /onboarding/brand-profile       Step 2: Mission, programs, geography
  /onboarding/voice-config        Step 3: Voice dimensions, tone, vocabulary
  /onboarding/platform-connect    Step 4: Connect LinkedIn/Instagram/Twitter
  /onboarding/complete            Step 5: Completion + first action prompt

DASHBOARD (/dashboard):
  /dashboard                      Home/Activity feed

CONTENT STUDIO (/dashboard/content):
  /dashboard/content              Content Studio main interface
  /dashboard/content/[id]         View/Edit generated content
  /dashboard/content/library      Saved content library
  /dashboard/content/templates    Content templates

CAMPAIGNS (/dashboard/campaigns):
  /dashboard/campaigns            Campaign list
  /dashboard/campaigns/new        Create new campaign
  /dashboard/campaigns/[id]       Campaign detail
  /dashboard/campaigns/[id]/edit  Edit campaign
  /dashboard/campaigns/[id]/posts Campaign post list

CALENDAR (/dashboard/calendar):
  /dashboard/calendar             Month view (default)
  /dashboard/calendar/week        Week view
  /dashboard/calendar/list        List view

SCHEDULER (/dashboard/scheduler):
  /dashboard/scheduler            Queue view
  /dashboard/scheduler/[id]       Scheduled post detail

ANALYTICS (/dashboard/analytics):
  /dashboard/analytics            Overview dashboard
  /dashboard/analytics/linkedin   LinkedIn breakdown
  /dashboard/analytics/instagram  Instagram breakdown
  /dashboard/analytics/twitter    Twitter/X breakdown
  /dashboard/analytics/content    Content performance

BRAND (/dashboard/brand):
  /dashboard/brand                Brand profile overview
  /dashboard/brand/voice          Voice settings
  /dashboard/brand/assets         Logos, images

HASHTAGS (/dashboard/hashtags):
  /dashboard/hashtags             Hashtag manager

FESTIVAL CALENDAR (/dashboard/festivals):
  /dashboard/festivals            Awareness days calendar

SETTINGS (/dashboard/settings):
  /dashboard/settings             General settings
  /dashboard/settings/org         Organization settings
  /dashboard/settings/team        Team management
  /dashboard/settings/billing     Billing and plan
  /dashboard/settings/accounts    Connected social accounts
  /dashboard/settings/integrations Integrations
  /dashboard/settings/api         API keys (enterprise)

ADMIN (internal):
  /admin/orgs
  /admin/users
  /admin/usage
  /admin/feature-flags
```

---

## 4. NAVIGATION ARCHITECTURE

### 4.1 Left Sidebar Navigation

```
SIDEBAR WIDTH: 240px (expanded), 64px (collapsed), 0px (mobile overlay)

LOGO/BRAND:
  [Brandora AI logo] + [Org name + plan badge]
  [Collapse toggle button]

PRIMARY NAVIGATION:
  [🏠] Dashboard          /dashboard
  [✨] Content Studio     /dashboard/content
  [📋] Campaigns          /dashboard/campaigns
  [📅] Calendar           /dashboard/calendar
  [📤] Scheduler          /dashboard/scheduler
  [📊] Analytics          /dashboard/analytics

SECONDARY NAVIGATION (below divider):
  [🎨] Brand Profile      /dashboard/brand
  [#]  Hashtag Manager    /dashboard/hashtags
  [🗓] Festival Calendar  /dashboard/festivals

BOTTOM SECTION:
  [⚙️] Settings           /dashboard/settings
  [❓] Help Center
  [👤] User Avatar + Name + Plan

ACTIVE STATE: Left border accent (4px Brand Blue), filled icon, text semibold
HOVER STATE: Gray 100 background, icon transitions to brand blue
```

### 4.2 Top Navigation Bar

```
HEIGHT: 64px
BACKGROUND: White, bottom border Gray 200, shadow-sm

LEFT: [Page Title] [Breadcrumb for nested pages]

CENTER: 
  [🔍 Quick Search — "Search posts, campaigns, hashtags..."]

RIGHT:
  [🔔 Notifications badge]
  [⚡ Generate Content — primary CTA button, always visible]
  [👤 User menu dropdown]
    → Profile
    → Switch Org (if multi-org)
    → Plan & Billing
    → Sign out
```

### 4.3 Mobile Navigation

```
BREAKPOINT: < 768px

BOTTOM TAB BAR (5 items):
  [🏠 Home] [✨ Create] [📅 Calendar] [📊 Analytics] [☰ More]

'More' opens a bottom sheet with:
  Campaigns, Library, Brand, Hashtags, Festivals, Settings

TOP BAR (mobile):
  [☰ Hamburger] [Brandora Logo] [🔔] [👤]

SIDEBAR: Full-screen overlay on mobile, dismissed by swipe or backdrop tap
```

---

## 5. PAGE SPECIFICATIONS

### 5.1 Auth Pages

**Login Page (/auth/login)**
```
LAYOUT: Split screen — Left: Product illustration/social proof, Right: Form
ELEMENTS:
  - Brandora AI logo + tagline ("AI-Powered Social Media for Social Impact")
  - Email input field
  - Password input field + show/hide toggle
  - "Remember me" checkbox
  - Primary CTA: "Sign In"
  - Link: "Forgot password?"
  - Divider: "or"
  - Google OAuth button
  - Footer: "Don't have an account? Start free →"
  - Trust signals: "Trusted by 200+ NGOs and CSR teams"

LEFT PANEL CONTENT:
  - Product screenshot/mockup (animated)
  - Rotating testimonials from NGO directors / CSR managers
  - Logo cloud: 6 recognizable org logos
```

**Register Page (/auth/register)**
```
LAYOUT: Single column, centered, max-width 480px
STEPS: Single page (no multi-step on register — save for onboarding)
ELEMENTS:
  - Full name, Work email, Password, Organization name
  - Organization type: [NGO] [CSR Department] [Social Enterprise] [Consulting Firm]
  - "I agree to Terms" checkbox
  - CTA: "Create Free Account"
  - Google OAuth option
  - Below: Plan comparison teaser (Free tier prominent)
```

**Forgot Password / Reset Password**
```
Standard single-field email entry, confirmation screen, reset form.
Consistent with Brandora design system, nothing extraordinary needed.
```

---

### 5.2 Onboarding Flow

**PHILOSOPHY:** The onboarding creates the brand voice profile — it is the most important 5 minutes in the user journey. Make it feel like expert consultation, not a form.

**Step 1: Organization Setup (/onboarding/org-setup)**
```
HEADLINE: "Let's set up your organization profile"
SUBHEADLINE: "This helps Brandora AI understand your mission and generate content that sounds like you."

FIELDS:
  - Organization name (text input)
  - Organization type (card selector, not dropdown):
    [NGO / Non-profit] [Corporate CSR] [Social Enterprise] [Government/PSU] [Consulting/Agency]
  - Team size (pill selector): [1-5] [6-20] [21-50] [50+]
  - Primary geography (searchable select, multi): States/Regions
  - Programs/Focus areas (checkbox grid, 12 options):
    Menstrual Hygiene | Sanitation/WASH | Water Access | Women Empowerment | 
    Girl Child Education | Community Health | Environment | Livelihoods |
    CSR Storytelling | Advocacy | Research | Other

PROGRESS: Step 1 of 4 (dot indicator at top)
CTA: "Continue →"
SKIP: Not allowed (this data powers the AI)
```

**Step 2: Brand Profile (/onboarding/brand-profile)**
```
HEADLINE: "Tell us about your mission"
SUBHEADLINE: "The more we understand your work, the better your content will be."

FIELDS:
  - Mission statement (text area, 2-3 sentences, helper: "What do you do and why?")
  - Key programs (up to 3, name + 1-line description)
  - Impact numbers (optional but encouraged): Beneficiaries, Years active, States covered
  - SDG alignment (visual SDG icon selector, multi-select)
  - Key partners / funders (optional, for acknowledgment in content)
  - Organization website / social links (for AI context)

AI PREVIEW HINT: Right panel shows "Based on your profile, Brandora AI will..."
  with 3 sample capabilities unlocked by the input
```

**Step 3: Voice Configuration (/onboarding/voice-config)**
```
HEADLINE: "Configure your brand voice"
SUBHEADLINE: "How should your organization sound on social media?"

INTERACTION: 5 slider controls with labels and live preview

SLIDERS:
  Professional ←————————→ Conversational
  [Example: "This quarter, our sanitation program reached 1,000 households."]
  vs
  ["We reached 1,000 families this quarter. Real families. Real change."]

  Institutional ←————————→ Warm/Human
  Pragmatic ←————————→ Inspirational/Visionary
  Data-Driven ←————————→ Story-Centered
  Measured ←————————→ Urgent

LIVE PREVIEW PANEL:
  As sliders move, a sample post updates in real-time showing the voice effect.
  "This is how a LinkedIn post about your program will sound"

VOCABULARY SETTINGS (expandable section):
  - Words to avoid (tag input)
  - Preferred phrases (tag input)
  - Emoji preference: [None] [Minimal] [Moderate]
  - CTA style: [Invite] [Direct command] [Question]

SHORTCUTS: "Use a preset" → [NGO Standard] [Corporate CSR] [Founder Voice] [Grassroots]
```

**Step 4: Platform Connect (/onboarding/platform-connect)**
```
HEADLINE: "Connect your social media accounts"
SUBHEADLINE: "Connect now to enable direct scheduling. You can skip and connect later."

PLATFORM CARDS (3):
  LinkedIn: [Connect LinkedIn] → OAuth flow
  Instagram: [Connect Instagram Business] → OAuth flow
  Twitter/X: [Connect Twitter/X] → OAuth flow

Each card shows:
  - Platform logo + name
  - What Brandora will access (read-only analytics + publish)
  - Privacy assurance text

SKIP OPTION: Prominent "I'll connect later →" — but with a note about what they miss

STATUS INDICATORS: Connected (green check), Pending, Error
```

**Step 5: Completion (/onboarding/complete)**
```
CELEBRATION: Subtle confetti animation (reduced motion safe)
HEADLINE: "You're ready to create impact content. ✨"

QUICK WINS PANEL:
  Three cards with direct action CTAs:
  → "Generate your first LinkedIn post about {program_name}"
  → "Create a World Menstrual Hygiene Day campaign"
  → "See your content calendar"

SETUP SUMMARY: Shows org name, voice profile, connected platforms
CTA: "Start Creating →" → goes to Content Studio
```

---

### 5.3 Dashboard / Home

```
LAYOUT: 3-column grid (main content 8 cols, sidebar 4 cols on desktop)
BACKGROUND: Gray 50

HEADER ROW:
  "Good morning, [First Name]" + date + day-of-week
  Subtext: "You have 3 posts scheduled today and 1 awareness day coming up."

TOP METRICS ROW (4 cards):
  [Total Posts This Month] [Avg. Engagement Rate] [Accounts Reached] [AI Tokens Used]
  Each: Large number + sparkline + trend indicator (+/-% vs last month)

QUICK ACTIONS BAR:
  [✨ Generate Content] [📋 New Campaign] [📅 Schedule Post] [🔍 Find Inspiration]
  Pill-style buttons, Brand Blue primary + Ghost secondary

MAIN COLUMN:
  1. UPCOMING AWARENESS DAYS WIDGET
     Card with next 3 awareness days:
     [Date badge] [Day name] [Create content →]
     E.g., "May 28 — World Menstrual Hygiene Day → Create Campaign"
  
  2. RECENT CONTENT ACTIVITY FEED
     Timeline of recent actions:
     "✅ LinkedIn post published — 2 hours ago"
     "📝 Draft saved: IWD campaign post 3 — yesterday"
     "📊 Analytics updated — LinkedIn — 1 hour ago"
     "✨ Content generated: Toilet Day series — 3 days ago"
  
  3. CAMPAIGN PROGRESS WIDGET
     Active campaigns as progress bars:
     "[Campaign Name] — 4 of 7 posts published — [View →]"
  
  4. CONTENT CALENDAR PREVIEW
     Mini 7-day calendar showing scheduled posts
     Each day: dot indicators for each platform
     "View full calendar →"

SIDEBAR COLUMN:
  1. QUICK GENERATE CARD
     Topic input + Generate button
     Pre-filled suggestions based on upcoming awareness days
  
  2. PLATFORM HEALTH SUMMARY
     LinkedIn: Connected ✅ | Last post: 2 days ago
     Instagram: Connected ✅ | Last post: 1 day ago
     Twitter: ⚠️ Reconnect needed
  
  3. TOP PERFORMING POST WIDGET
     Last 7 days best post: preview + top metric
  
  4. TEAM ACTIVITY (if multi-user plan)
     3 most recent team member actions
```

---

### 5.4 Content Studio (Core Product Page)

*(Full deep-dive in Section 6)*

---

### 5.5 Content Library (/dashboard/content/library)

```
LAYOUT: Full-width, filter sidebar + main grid

FILTER SIDEBAR (240px):
  - Search (full-text)
  - Platform: All | LinkedIn | Instagram | Twitter
  - Content Type: All | Awareness | Impact | CSR | Founder | Campaign
  - Status: All | Draft | Published | Scheduled | Archived
  - Date Range: picker
  - Quality Score: slider (min score filter)
  - Campaign: dropdown

MAIN AREA:
  - Sort controls: Newest | Most Engaged | Highest Score | Platform
  - View toggle: [Grid] [List]
  - Bulk actions bar (appears on selection): [Delete] [Move to Campaign] [Duplicate]

CONTENT CARD (Grid View):
  - Platform badge (colored)
  - Content type badge
  - Post text preview (3 lines, truncated)
  - Quality score badge (color-coded)
  - Status badge (published/draft/scheduled)
  - Date
  - Quick actions: [Edit] [Duplicate] [Schedule] [Delete]

CONTENT ROW (List View):
  - Checkbox | Platform icon | Post preview (1 line) | Type | Status | Score | Date | Actions

EMPTY STATE: See Section 11
```

### 5.6 Campaign Manager (/dashboard/campaigns)

```
CAMPAIGN LIST PAGE:
  - Header: "Campaigns" + [+ New Campaign] button
  - Filter tabs: All | Active | Scheduled | Completed | Draft
  - Campaign cards:
    [Campaign name] [Platform icons] [Post count badge] [Progress bar] [Status]
    [Dates: Nov 15 - Nov 22] [Quick actions: View | Edit | Duplicate | Archive]

CAMPAIGN DETAIL (/dashboard/campaigns/[id]):
  - Campaign header: Name, dates, goal, platform icons, status badge
  - TABS: Posts | Overview | Settings
  
  POSTS TAB (main):
    - Visual timeline (left to right or top-to-bottom)
    - Each post card: Day label, platform, preview, status, score, actions
    - [+ Add Post] between any cards
    - Drag-to-reorder functionality
  
  OVERVIEW TAB:
    - Campaign goal statement
    - Progress: Posts published / total
    - Aggregate analytics (if posts published)
    - Campaign notes/brief
  
  SETTINGS TAB:
    - Campaign name, description
    - Date range editor
    - Platform targeting
    - Assigned team members
    - Archive/Delete

CAMPAIGN BUILDER (/dashboard/campaigns/new):
  Multi-step wizard:
  Step 1: Campaign brief (name, goal, dates, platforms)
  Step 2: AI generation (auto-generate all posts from brief)
  Step 3: Review + edit generated posts
  Step 4: Schedule + publish
```

### 5.7 Content Calendar (/dashboard/calendar)

```
VIEWS: Month | Week | List | Agenda
Default: Month view

MONTH VIEW:
  - Standard calendar grid (7 columns, 5-6 rows)
  - Each day cell: Date number + up to 3 post indicators (overflow: "+N more")
  - Post indicator: Platform-colored dot + post type icon + first 3 words of post
  - Clicking a post indicator opens a preview popover
  - Clicking a date opens "Schedule for this day" sidebar
  - Awareness days highlighted with a banner behind the date number
  - Color-coded by platform: LinkedIn blue, Instagram pink, Twitter black

WEEK VIEW:
  - 7-column grid with hour rows (from 6am to 11pm)
  - Posts placed at scheduled time slots
  - Drag-to-reschedule within the week
  - "Best time" suggested slots shown as shaded optimal windows

DRAG AND DROP:
  - Drag posts between dates/times
  - Drop zone highlights in Brand Blue
  - Confirmation: "Reschedule to [new date/time]?"
  - Undo option (5 second toast)

TOP BAR (Calendar specific):
  [← Previous] [Month name + Year] [Next →] [Today] [+ Schedule Post] [View toggle]
  [Platform filter: All | LinkedIn | Instagram | Twitter]

RIGHT SIDEBAR (on date click, 320px):
  Selected date + awareness day info (if applicable)
  Posts scheduled this day (list)
  [Generate content for this day]
  [Schedule new post]
```

### 5.8 Scheduler / Queue View (/dashboard/scheduler)

```
LAYOUT: List view, sorted by scheduled time

QUEUE HEADER:
  [Platform filter pills] [Date range picker] [Sort: Soonest first]
  Summary: "12 posts scheduled across 3 platforms in the next 7 days"

SCHEDULED POST ROW:
  [Platform icon] [Date/Time] [Post preview — 2 lines] [Campaign tag if any]
  [Status: Scheduled | Queued | Failed] [Actions: Edit | Reschedule | Publish Now | Delete]

FAILED POSTS SECTION (if any):
  Red background banner: "2 posts failed to publish"
  Show failed posts with error message + retry options

POSTING TIME INSIGHTS (sidebar):
  "Best times for your audience on LinkedIn: Tue/Thu 8-10am, 12-2pm"
  (Based on historical engagement data)
```

### 5.9 Analytics Dashboard (/dashboard/analytics)

```
OVERVIEW PAGE:
  DATE RANGE PICKER: Last 7 | 30 | 90 days | Custom range
  PLATFORM FILTER: All platforms | Individual

  TOP METRICS ROW (4 large stat cards):
    Total Impressions | Total Engagements | Engagement Rate | Posts Published

  CHARTS ROW 1:
    [Engagement over time — line chart, all platforms on one chart, color-coded]
    [Platform distribution — donut chart: % posts per platform]

  CHARTS ROW 2:
    [Top performing content type bar chart]
    [Best performing days/times heatmap]

  TOP POSTS TABLE:
    Post preview | Platform | Type | Impressions | Engagements | Rate | Date
    Sortable by any column

PLATFORM-SPECIFIC PAGES (LinkedIn/Instagram/Twitter):
  - Platform-specific metrics (LinkedIn: impressions, SSI; Instagram: reach, saves; Twitter: retweets)
  - Follower growth chart
  - Content mix (awareness/impact/CSR/founder ratio)
  - Hashtag performance table
  - Best performing posts (platform-specific)

CONTENT PERFORMANCE (/dashboard/analytics/content):
  - By content type: Which type performs best
  - By AI model: Quality score vs actual performance correlation
  - By campaign: Campaign-level analytics
  - Voice dimension correlation: Which voice settings drive most engagement
```

### 5.10 Brand Profile (/dashboard/brand)

```
LAYOUT: Settings-style, sectioned

SECTIONS:
  1. ORGANIZATION IDENTITY
     Logo upload, name, tagline, mission statement, website
  
  2. VOICE SETTINGS (same sliders as onboarding, always editable)
     5 dimension sliders + live preview
     Vocabulary settings
     Signature phrases
  
  3. CONTENT CONTEXT
     Programs (add/edit/remove)
     Impact numbers (updateable)
     SDG alignment
     Partners/funders
  
  4. BRAND ASSETS
     Logo variants (light/dark/square)
     Brand colors (hex input)
     Font preferences (optional, for visual recommendations)
  
  5. CONTENT PREFERENCES
     Default post lengths per platform
     Preferred posting frequency
     Auto-hashtag preferences
```

### 5.11 Connected Accounts (/dashboard/settings/accounts)

```
LAYOUT: Card per platform

PLATFORM CARD:
  - Platform logo + name
  - Connection status: Connected (green) | Not connected | Needs reauth (warning)
  - Account name/handle if connected
  - Connection date
  - Permissions granted
  - [Reconnect] or [Disconnect] button
  - [View account analytics →]

CONNECT FLOW:
  OAuth redirect → permission grant → return to Brandora → success toast
  Error handling: Specific error messages for each failure type

PERMISSIONS PANEL (expandable):
  Clear list of what Brandora accesses:
  ✅ Read profile information
  ✅ Read posts and analytics
  ✅ Publish posts on your behalf
  ❌ Access DMs or messages (never requested)
  ❌ Access passwords
```

### 5.12 Hashtag Manager (/dashboard/hashtags)

```
LAYOUT: Search bar + cluster organization

SEARCH/FILTER: Search hashtags, filter by platform, filter by performance

HASHTAG CLUSTERS (collapsible sections):
  - Campaign Hashtags (custom, campaign-linked)
  - Niche Sanitation/Hygiene (curated by Brandora)
  - Medium Reach (curated)
  - Broad Reach (curated)
  - Awareness Day Hashtags (auto-updated per calendar)
  - My Custom Hashtags (user-added)

HASHTAG CARD:
  - #hashtag name
  - Estimated reach tier (niche/medium/broad)
  - Platform(s) where active
  - Usage count by the org
  - Add to favorites star

ADD CUSTOM HASHTAG:
  Input + [+ Add] button
  Auto-categorizes into a cluster based on content

HASHTAG SET BUILDER:
  Drag hashtags into a "set" for a specific campaign or content type
  Save as preset: "MHM Campaign Hashtags" → use in Content Studio
```

### 5.13 Festival Calendar (/dashboard/festivals)

```
LAYOUT: Full-year calendar view with event cards

YEAR VIEW: 12-month mini-grid with highlighted awareness days

EVENT CARD (click on awareness day):
  - Day name + date
  - Official theme (current year)
  - Official hashtags
  - Why it matters to sanitation/MHM sector
  - Our org's past content for this day (if any)
  - [Generate Campaign for This Day] CTA button

FILTER: Show only relevant days (based on org's program focus areas)

UPCOMING DAYS SIDEBAR: Next 5 awareness days with countdowns

CUSTOM DATES: Add org-specific dates (annual events, launch anniversaries, etc.)
```

### 5.14 Settings Pages

```
/settings: General — theme (light/dark/system), notifications, timezone
/settings/org: Org profile edit, billing address
/settings/team: Members list, invite by email, roles (Admin/Editor/Viewer)
/settings/billing: Plan, usage, payment method, invoices, upgrade prompt
/settings/integrations: Future: Zapier, Google Analytics, CRM connections
/settings/api: API key management (Enterprise plan)
```

---

## 6. CONTENT STUDIO DEEP-DIVE

### 6.1 Layout Architecture

```
FULL-SCREEN PAGE — 3-panel layout

LEFT PANEL (Input, 380px fixed):
  Generation controls — all inputs live here

CENTER PANEL (Output, flex-grow):
  Generated content — primary workspace

RIGHT PANEL (Actions, 320px, collapsible):
  Save / Schedule / Quality / History
```

### 6.2 Left Panel: Input Area

```
PANEL HEADER: "Content Studio" + [Voice: {org_name}] badge (clickable to change)

SECTION 1: TOPIC & CONTEXT
  Topic input (required):
    Placeholder: "What do you want to talk about? E.g., 'Our Q3 program reaching 5,000 women in Rajasthan'"
    Character count + suggestion chips below: [MHM | Sanitation | Impact Update | Event | CSR]

  Context (optional, expandable):
    Textarea: "Add supporting data, quotes, or background..."
    Upload button: PDF/Doc for longer source material
    Paste URL: Auto-extract content from article or press release

SECTION 2: PLATFORM SELECTOR
  Large icon buttons: [LinkedIn] [Instagram] [Twitter/X]
  Multi-select allowed: select multiple to generate for all at once
  LinkedIn sub-type selector (appears on LinkedIn select):
    [Thought Leadership] [CSR Update] [Awareness] [Founder Story] [Event]
  Instagram sub-type selector:
    [Feed Post] [Carousel] [Reel Script] [Story Sequence]
  Twitter sub-type selector:
    [Single Tweet] [Thread] [Campaign Tweet]

SECTION 3: TONE CONTROLS (compact sliders, collapsible)
  Mini version of voice sliders (5 dimensions)
  "Using your brand voice" indicator
  "Override for this post" toggle → enables manual adjustment
  Preset tone chips: [Campaign Mode] [Formal] [Personal] [Urgent]

SECTION 4: ADVANCED OPTIONS (collapsed by default)
  AI Model selector: [Auto-Route ✨] [GPT-4o] [Claude] [Gemini Fast]
  Content length: [Short] [Medium] [Long]
  Number of variants: [1] [2] [3]
  Include statistics: [Auto] [Yes, include] [Avoid stats]
  Language: [English] [Hindi] [Bilingual]
  Campaign context: Link to existing campaign (optional)

GENERATE BUTTON:
  Full-width, Brand Blue, prominent
  "✨ Generate Content"
  Loading state: Animated pulse + "AI is writing..."
```

### 6.3 Center Panel: Generation Results

```
GENERATION STATE MACHINE:

STATE 1: EMPTY (no generation yet)
  Large centered message: "Describe your topic, select a platform, and generate."
  Quick start cards: 3 example prompts relevant to org's profile

STATE 2: GENERATING
  Streaming text appearance (words appear progressively, ~50ms per word)
  Quality score animates from 0 upward in real-time
  "Claude Sonnet is writing your LinkedIn post..." (shows active model)
  Cancel button available

STATE 3: GENERATED (primary state)
  CONTENT CARD (for each platform if multi-selected):
    Platform badge + type badge in card header
    Post text (full, editable inline — click to edit)
    Hashtag chips (removable, add more)
    CTA display
    Quality score ring (color-coded: red < 6, amber 6-7, green 8+)
    Sub-scores: Engagement | Brand Fit | Clarity | Impact (compact, expandable)
    
  VARIANTS SECTION (if multiple variants requested):
    Tab selector: [Version A] [Version B] [Version C]
    Each variant shows its own text + score

  FACT FLAGS SECTION (if any):
    Yellow warning banner: "⚠️ 2 items to verify before publishing"
    Each flag listed with suggested verification source

INLINE EDITING:
  Click any text area to edit directly
  Changes tracked as "Manual Edit" in history
  "Regenerate from this edit" button appears after editing
  AI writing suggestions inline: highlight text → "Rephrase" option appears

ONE-CLICK REPURPOSE (appears after generation):
  Horizontal chip row: "Also create for:"
  [+ LinkedIn] [+ Instagram Carousel] [+ Twitter Thread] [+ Reel Script]
  Generates adapted version instantly

REFINE CONTROLS (appear after generation):
  [🔄 Make More Formal] [❤️ Add More Warmth] [📊 Add Statistics]
  [✂️ Make Shorter] [📝 Make Longer] [⚡ More Urgent]
  [🌍 Translate to Hindi]
```

### 6.4 Right Panel: Actions

```
QUALITY SCORE PANEL:
  Large ring chart: Overall score (1-10)
  4 sub-metrics with color bars
  AI note: "What makes this post strong" and "Suggested improvement"

SAVE / PUBLISH ACTIONS:
  [Save as Draft] — quiet button, always available
  [Schedule Post] — primary action, opens scheduler modal
  [Publish Now] — secondary action (if platform connected)

SCHEDULE MODAL:
  Platform selector (if multi-platform generated)
  Date picker
  Time input with "Optimal time suggestion" chip
  Campaign association (optional)
  [Schedule] confirm button

HISTORY SIDEBAR (collapsible):
  Shows previous generations for today's session
  Click to reload any previous result

SHARE (optional):
  [Copy post text] [Copy with hashtags] [Download as .txt]
  [Add to Campaign] dropdown
```

---

## 7. COMPONENT HIERARCHY

```
components/
  ui/                          — Shadcn/ui base components
    button.tsx
    input.tsx
    textarea.tsx
    select.tsx
    slider.tsx
    dialog.tsx
    dropdown-menu.tsx
    toast.tsx
    badge.tsx
    card.tsx
    tabs.tsx
    calendar.tsx
    progress.tsx
    separator.tsx
    skeleton.tsx
    tooltip.tsx
    popover.tsx
    sheet.tsx
    avatar.tsx
    checkbox.tsx
    radio-group.tsx
    switch.tsx
    command.tsx
    scroll-area.tsx

  layout/
    Sidebar.tsx
    SidebarNavItem.tsx
    TopBar.tsx
    TopBarSearch.tsx
    UserMenu.tsx
    MobileNav.tsx
    PageHeader.tsx
    PageLayout.tsx

  dashboard/
    WelcomeHeader.tsx
    MetricCard.tsx
    ActivityFeed.tsx
    ActivityFeedItem.tsx
    UpcomingAwarenessDays.tsx
    CampaignProgressWidget.tsx
    CalendarPreview.tsx
    QuickGenerateCard.tsx
    PlatformHealthSummary.tsx
    TopPerformingPostWidget.tsx
    QuickActionsBar.tsx

  content-studio/
    ContentStudio.tsx                — Main page component
    InputPanel.tsx
    TopicInput.tsx
    ContextInput.tsx
    PlatformSelector.tsx
    PlatformTypeSelector.tsx
    ToneSliders.tsx
    TonePresets.tsx
    AdvancedOptions.tsx
    GenerateButton.tsx
    OutputPanel.tsx
    ContentCard.tsx
    ContentCardHeader.tsx
    ContentCardBody.tsx
    InlineEditor.tsx
    HashtagChips.tsx
    HashtagChip.tsx
    QualityScoreRing.tsx
    QualitySubScores.tsx
    FactFlags.tsx
    VariantTabs.tsx
    RepurposeBar.tsx
    RefineControls.tsx
    StreamingText.tsx              — AI text streaming component
    AIModelBadge.tsx
    ActionsPanel.tsx
    SaveActions.tsx
    ScheduleModal.tsx
    QualityPanel.tsx
    GenerationHistory.tsx

  campaign/
    CampaignList.tsx
    CampaignCard.tsx
    CampaignDetail.tsx
    CampaignHeader.tsx
    CampaignTimeline.tsx
    CampaignPostCard.tsx
    CampaignProgressBar.tsx
    CampaignBuilder.tsx
    CampaignBriefStep.tsx
    CampaignGenerateStep.tsx
    CampaignReviewStep.tsx
    CampaignScheduleStep.tsx

  calendar/
    ContentCalendar.tsx
    CalendarMonthView.tsx
    CalendarWeekView.tsx
    CalendarDayCell.tsx
    PostIndicator.tsx
    PostPreviewPopover.tsx
    AwarenessDayBanner.tsx
    CalendarTopBar.tsx
    ScheduleSidebar.tsx
    DragDropWrapper.tsx

  analytics/
    AnalyticsOverview.tsx
    MetricStatCard.tsx
    EngagementChart.tsx
    PlatformDistributionChart.tsx
    ContentTypePerformanceChart.tsx
    BestTimesHeatmap.tsx
    TopPostsTable.tsx
    PlatformBreakdown.tsx
    FollowerGrowthChart.tsx

  shared/
    PlatformBadge.tsx
    ContentTypeBadge.tsx
    StatusBadge.tsx
    SDGBadge.tsx
    LoadingSkeleton.tsx
    EmptyState.tsx
    ErrorState.tsx
    ConfirmDialog.tsx
    UploadArea.tsx
    DateRangePicker.tsx
    AwarenessDayCard.tsx
    VoiceSlider.tsx
    OrgAvatar.tsx
    PostPreviewCard.tsx
```

---

## 8. USER FLOWS

### 8.1 First-Time User Onboarding (10 Steps)

```
Step 1: Land on /auth/register
  → Fill org type, email, password → [Create Account]

Step 2: Email verification (if required)
  → "Check your email" screen → Click verify link → Returns to app

Step 3: /onboarding/org-setup
  → Fill org name, type, focus areas → [Continue]

Step 4: /onboarding/brand-profile
  → Fill mission, programs, impact numbers → [Continue]

Step 5: /onboarding/voice-config
  → Adjust sliders, see live preview → [Set My Voice]

Step 6: /onboarding/platform-connect
  → Connect at least LinkedIn → [Continue]

Step 7: /onboarding/complete
  → See success screen with 3 quick action cards

Step 8: Click "Generate your first LinkedIn post"
  → Lands on Content Studio with pre-filled topic based on org profile

Step 9: Review generated post → Edit if desired → [Schedule Post]
  → Scheduler modal appears → Pick date and time → [Schedule]

Step 10: [View Calendar]
  → Sees their first post on the calendar
  → Dashboard quick tour tooltip appears (5-step product tour)
```

### 8.2 Generating Content for LinkedIn

```
1. Navigate to Content Studio (sidebar or Quick Generate in dashboard)
2. Type topic in Topic Input
3. Add context (optional): paste supporting data
4. Click [LinkedIn] in Platform Selector
5. Select type: [Thought Leadership]
6. Adjust tone if needed (or use brand default)
7. Click [✨ Generate Content]
8. Watch content stream in (3-8 seconds)
9. Review quality scores
10. Click inline text to edit
11. Accept or dismiss hashtag suggestions
12. Check fact flags (if any) — verify those claims
13. Click [Schedule Post]
14. Select date/time (see optimal time suggestion)
15. Click [Schedule] — confirm toast appears
```

### 8.3 Running a Festival Campaign

```
1. See awareness day notification in dashboard (or Festival Calendar)
2. Click [Generate Campaign] for World Menstrual Hygiene Day
3. Campaign Builder opens at Step 1 (Brief)
4. Fill: Campaign name, goal, platforms, start/end dates
5. Describe campaign angle (pre-filled template based on day)
6. Click [Generate All Posts →]
7. Loading: "Generating 7 posts across 3 platforms..."
8. Review step: 7 posts displayed in timeline
9. Edit any individual post inline
10. Delete or add posts
11. Review quality scores for each post (flag any below 6)
12. Click [Schedule All →]
13. Auto-scheduled with optimal times pre-filled
14. [Confirm Schedule] → Campaign goes live on schedule
15. Return to Dashboard — campaign progress widget appears
```

### 8.4 Scheduling a Content Week

```
1. Navigate to Content Calendar
2. Click on Monday's date cell
3. Schedule Sidebar opens → [Generate for Monday]
4. Content Studio opens with date context pre-filled
5. Generate post → Schedule → Returns to Calendar
6. Repeat for each day (or use Bulk Generate week option)
7. Review full week in Week View
8. Drag posts to adjust timing if needed
9. Check for platform balance (too many Instagram, not enough LinkedIn?)
10. Click [Finalize Week] — review summary modal
```

### 8.5 Reviewing Analytics

```
1. Navigate to Analytics
2. Review Overview metrics (default: last 30 days)
3. Check Engagement chart — identify trend peaks
4. Click LinkedIn breakout → platform-specific analytics
5. Review top performing posts — click to see full post
6. Identify best-performing content type
7. Check hashtag performance table — remove underperforming tags
8. Export data (CSV) if needed
9. Note insight: "CSR update posts outperform awareness posts 2:1"
10. Return to Content Studio → apply insight to future content
```

---

## 9. RESPONSIVE STRATEGY

### 9.1 Breakpoints

```
xs: 0-479px      Mobile small (iPhone SE)
sm: 480-767px    Mobile standard (iPhone 14)
md: 768-1023px   Tablet (iPad)
lg: 1024-1279px  Small desktop / iPad Pro landscape
xl: 1280-1535px  Standard desktop
2xl: 1536px+     Large desktop / wide monitors
```

### 9.2 Responsive Behavior by Component

```
SIDEBAR:
  xl+:   Expanded (240px)
  lg:    Collapsed icon-only (64px), hover to expand
  md:    Hidden, toggle via hamburger → full overlay
  sm/xs: Hidden, bottom tab bar + "More" sheet

CONTENT STUDIO:
  xl+:   3-panel layout (Input | Output | Actions)
  lg:    2-panel (Input | Output), Actions as right drawer
  md:    Stacked panels, full-width each, tabbed
  sm/xs: Full-screen single panel, panel switching via tabs at top

DASHBOARD:
  xl+:   3-column grid
  lg:    2-column grid
  md:    2-column grid (narrower sidebar widgets drop below)
  sm/xs: 1-column stacked

CALENDAR:
  md+:   Full month view with post previews
  sm/xs: Simplified month view (dots only) + list view as default

ANALYTICS:
  md+:   Full chart dashboard
  sm/xs: Key metrics cards + simplified charts, tables scrollable horizontally
```

---

## 10. DASHBOARD WIDGETS

```
Widget 1: Total Monthly Posts Metric Card
  Value: Post count | Sparkline | % change vs last month

Widget 2: Engagement Rate Card
  Value: Average rate % | Platform breakdown mini-bars | Trend

Widget 3: Reach/Impressions Card
  Value: Total impressions | Platform breakdown | Trend

Widget 4: Upcoming Awareness Days
  Next 3 days with dates, names, generate CTAs

Widget 5: Campaign Progress
  Active campaigns with progress bars and % complete

Widget 6: Activity Feed
  Chronological list of: posts published, drafts saved, analytics updates

Widget 7: Calendar Week Preview
  7-day mini-calendar with post indicators

Widget 8: Platform Health
  Connection status for each platform + last post date

Widget 9: Quick Generate
  Topic input + Generate button, directly accessible

Widget 10: Top Post of the Week
  Best performing post, platform, key metric

Widget 11: AI Token Usage
  Usage bar + current plan limit, links to upgrade if near limit

Widget 12: Team Activity (Team plan only)
  Recent actions by team members

Widget 13: Content Variety Score
  Mix of content types — alert if over-relying on one type

Widget 14: Posting Consistency
  Posts per week over last 8 weeks (bar chart)
```

---

## 11. EMPTY STATES

```
Content Library (no saved content):
  Illustration: Blank notebook with a pencil
  Headline: "Your content library is empty"
  Body: "Everything you generate or save appears here."
  CTA: [✨ Generate Your First Post]

Campaigns (no campaigns):
  Illustration: Empty calendar with a star
  Headline: "No campaigns yet"
  Body: "Campaigns help you plan and schedule a series of posts around a theme or event."
  CTA: [Create Your First Campaign]

Calendar (no scheduled posts):
  Illustration: Empty calendar with a clock
  Headline: "Nothing scheduled this week"
  Body: "Schedule posts from the Content Studio or drag content onto the calendar."
  CTA: [Generate Content to Schedule]

Analytics (newly connected, no data):
  Illustration: Empty bar chart
  Headline: "Analytics coming soon"
  Body: "We'll start tracking your performance once you publish your first post."
  CTA: [Publish a Post Now]

Hashtag Manager (no custom hashtags):
  Headline: "Start building your hashtag strategy"
  Body: "Add your organization's custom hashtags, or use our curated sets."
  CTA: [Browse Curated Hashtag Sets]

Connected Accounts (no accounts connected):
  Headline: "Connect your social media accounts"
  Body: "Connect LinkedIn, Instagram, or Twitter/X to schedule and analyze posts."
  CTA: [Connect LinkedIn] [Connect Instagram] [Connect Twitter/X]
```

---

## 12. LOADING STATES

### 12.1 AI Generation Loading

```
PHASE 1: Initiation (0-500ms)
  Button changes to loading state
  Center panel shows: "Selecting the right AI model for your content..."
  Shimmer/skeleton appears for content card shape

PHASE 2: Generation in Progress (500ms - end)
  Text begins streaming word-by-word
  Quality score ring fills progressively (estimated)
  Model badge appears: "✨ Claude Sonnet is writing..."
  Cancel button available

PHASE 3: Post-Generation (0-300ms)
  Quality scores finalize (animate from estimated to actual)
  Hashtag chips animate in
  Fact flags appear if any
  Variant tabs appear if multiple variants

STREAMING UX:
  Each word fades in with a 30ms delay
  Cursor blink at current writing position
  Smooth, not jerky — buffer content slightly to smooth irregular AI generation speed
```

### 12.2 Page Loading Skeletons

```
Dashboard: Skeleton versions of all 6 main widgets
  Skeleton is same shape as loaded widget
  Pulsing animation: 1.5s, opacity 0.5 → 0.8 → 0.5

Content Library: Grid of 6 skeleton content cards
Analytics: Skeleton metric cards + flat rectangles for charts

Skeleton Color: Gray 200 → Gray 100 (pulse direction)
Duration: 1.5s loop
Do NOT use: Spinners for page-level loading (only for small inline actions)
```

### 12.3 Action Loading

```
Button loading: Replace text with [●●●] animation or spinner icon
Schedule action: "Scheduling..." → "Scheduled!" (with checkmark animation)
Connect social: "Connecting..." → redirect → "Connected!" toast
Publish now: "Publishing..." → progress bar → success/failure state
```

---

## 13. ERROR STATES

### 13.1 AI Generation Errors

```
Rate limit error:
  Inline banner: "⚠️ Generation limit reached for today. Upgrade for unlimited generation."
  CTA: [View Plans] [Try again in {time}]

Model API error:
  Inline banner: "Generation failed. We're switching to a backup model."
  Auto-retry once with different model
  If retry fails: "We're experiencing issues with AI generation. Our team is on it."
  CTA: [Try Again] [Check Status Page]

Empty output:
  "Hmm, we couldn't generate content for that prompt. Try adding more context."
  CTA: [Add more context] [Try a different approach]

Fact-heavy prompt refused:
  "We couldn't generate statistics for this topic — please provide your own data."
  Direct to anti-hallucination explanation (expandable info)
```

### 13.2 Social Media Publish Errors

```
Auth error (token expired):
  "Your {Platform} connection has expired. Reconnect to publish."
  CTA: [Reconnect {Platform}]

Rate limit from platform:
  "LinkedIn limit reached for today. Rescheduled to tomorrow."
  Option to manually reschedule

Content policy error:
  "This post was rejected by {Platform}'s content policy."
  Show the specific rejection reason if available
  CTA: [Edit Post] [Contact Support]

Network/server error:
  "Failed to publish — connection error. We'll retry in 30 minutes."
  Option to retry now or reschedule
```

### 13.3 Form Errors

```
Inline validation: Appears below field on blur, not on every keystroke
Error style: Red 500 border + red error message text
Success style: Green border on save
Character limit: Count changes to red at 90% of limit
```

---

## 14. ACCESSIBILITY

### WCAG 2.1 AA Compliance

```
COLOR CONTRAST:
  Normal text (< 18pt): 4.5:1 minimum
  Large text (≥ 18pt / 14pt bold): 3:1 minimum
  Interactive elements: 3:1 minimum for borders/indicators
  Check all Gray 400 on White combinations — adjust if needed

KEYBOARD NAVIGATION:
  All interactive elements reachable by Tab
  Logical focus order following visual layout
  Visible focus ring: 2px Brand Blue 500, 2px offset
  Skip navigation link: [Skip to main content] at document start

SCREEN READERS:
  All images have meaningful alt text (Content Studio: user-filled, generated posts: AI-generated alt)
  Form labels associated with inputs (not just placeholder)
  Buttons have descriptive text (not just icon buttons — add aria-label)
  Status messages announced via aria-live regions (generation complete, post scheduled)
  Loading states: aria-busy on content areas during generation

MOTION:
  prefers-reduced-motion: Remove all animations, keep instant transitions
  No content that flashes more than 3 times/second

FONT SIZES:
  Minimum 14px for any readable text
  No text in images (use HTML text overlay on images)

LANGUAGE:
  lang="en" on <html>, update for Hindi content
  Document title updates on route change

TOUCH TARGETS:
  Minimum 44x44px for all interactive elements
  Spacing between touch targets: minimum 8px
```

---

## 15. FRONTEND FOLDER STRUCTURE

```
frontend/
  src/
    app/
      (auth)/
        login/
          page.tsx
        register/
          page.tsx
        forgot-password/
          page.tsx
        reset-password/
          page.tsx
        layout.tsx

      onboarding/
        org-setup/
          page.tsx
        brand-profile/
          page.tsx
        voice-config/
          page.tsx
        platform-connect/
          page.tsx
        complete/
          page.tsx
        layout.tsx

      (dashboard)/
        layout.tsx                    ← Sidebar + topbar wrapper
        page.tsx                      ← Dashboard home
        content/
          page.tsx                    ← Content Studio
          [id]/
            page.tsx                  ← Content detail/edit
          library/
            page.tsx
          templates/
            page.tsx
        campaigns/
          page.tsx                    ← Campaign list
          new/
            page.tsx                  ← Campaign builder
          [id]/
            page.tsx                  ← Campaign detail
            edit/
              page.tsx
        calendar/
          page.tsx                    ← Month view (default)
          week/
            page.tsx
        scheduler/
          page.tsx
        analytics/
          page.tsx                    ← Overview
          linkedin/
            page.tsx
          instagram/
            page.tsx
          twitter/
            page.tsx
          content/
            page.tsx
        brand/
          page.tsx
          voice/
            page.tsx
        hashtags/
          page.tsx
        festivals/
          page.tsx
        settings/
          page.tsx
          org/
            page.tsx
          team/
            page.tsx
          billing/
            page.tsx
          accounts/
            page.tsx
          integrations/
            page.tsx
          api/
            page.tsx

      api/                            ← Next.js API routes
        generate/
          route.ts                    ← AI generation endpoint
        schedule/
          route.ts
        analytics/
          route.ts
        auth/
          [...nextauth]/
            route.ts

      layout.tsx                      ← Root layout, providers
      globals.css
      not-found.tsx
      error.tsx

    components/
      ui/                             ← Shadcn/ui components
        button.tsx
        input.tsx
        textarea.tsx
        select.tsx
        slider.tsx
        dialog.tsx
        dropdown-menu.tsx
        toast.tsx
        badge.tsx
        card.tsx
        tabs.tsx
        calendar.tsx
        progress.tsx
        separator.tsx
        skeleton.tsx
        tooltip.tsx
        popover.tsx
        sheet.tsx
        avatar.tsx
        checkbox.tsx
        radio-group.tsx
        switch.tsx
        command.tsx
        scroll-area.tsx
        [all other shadcn components]

      layout/
        Sidebar.tsx
        SidebarNavItem.tsx
        TopBar.tsx
        TopBarSearch.tsx
        UserMenu.tsx
        MobileNav.tsx
        BottomTabBar.tsx
        PageHeader.tsx
        PageLayout.tsx
        DashboardShell.tsx

      dashboard/
        WelcomeHeader.tsx
        MetricCard.tsx
        ActivityFeed.tsx
        ActivityFeedItem.tsx
        UpcomingAwarenessDays.tsx
        CampaignProgressWidget.tsx
        CalendarPreview.tsx
        QuickGenerateCard.tsx
        PlatformHealthSummary.tsx
        TopPerformingPostWidget.tsx
        QuickActionsBar.tsx
        AIUsageMeter.tsx

      content-studio/
        ContentStudio.tsx
        InputPanel/
          InputPanel.tsx
          TopicInput.tsx
          ContextInput.tsx
          ContextUpload.tsx
          PlatformSelector.tsx
          PlatformTypeSelector.tsx
          ToneSliders.tsx
          TonePresets.tsx
          AdvancedOptions.tsx
          GenerateButton.tsx
        OutputPanel/
          OutputPanel.tsx
          EmptyOutputState.tsx
          GeneratingState.tsx
          ContentCard.tsx
          ContentCardHeader.tsx
          ContentCardBody.tsx
          InlineEditor.tsx
          HashtagChips.tsx
          HashtagChip.tsx
          QualityScoreRing.tsx
          QualitySubScores.tsx
          FactFlags.tsx
          VariantTabs.tsx
          RepurposeBar.tsx
          RefineControls.tsx
          StreamingText.tsx
          AIModelBadge.tsx
        ActionsPanel/
          ActionsPanel.tsx
          SaveActions.tsx
          ScheduleModal.tsx
          QualityPanel.tsx
          GenerationHistory.tsx

      campaign/
        CampaignList.tsx
        CampaignCard.tsx
        CampaignEmptyState.tsx
        CampaignDetail/
          CampaignDetail.tsx
          CampaignHeader.tsx
          CampaignTimeline.tsx
          CampaignPostCard.tsx
          CampaignProgressBar.tsx
          CampaignTabs.tsx
        CampaignBuilder/
          CampaignBuilder.tsx
          CampaignBuilderProgress.tsx
          BriefStep.tsx
          GenerateStep.tsx
          ReviewStep.tsx
          ScheduleStep.tsx

      calendar/
        ContentCalendar.tsx
        CalendarTopBar.tsx
        CalendarMonthView.tsx
        CalendarWeekView.tsx
        CalendarDayCell.tsx
        PostIndicator.tsx
        PostPreviewPopover.tsx
        AwarenessDayBanner.tsx
        ScheduleSidebar.tsx
        DragDropWrapper.tsx

      analytics/
        AnalyticsHeader.tsx
        MetricStatCard.tsx
        EngagementChart.tsx
        PlatformDistributionChart.tsx
        ContentTypeChart.tsx
        BestTimesHeatmap.tsx
        TopPostsTable.tsx
        FollowerGrowthChart.tsx
        HashtagPerformanceTable.tsx

      brand/
        BrandOverview.tsx
        VoiceSettingsPanel.tsx
        VoiceSlider.tsx
        VoicePreview.tsx
        ProgramsList.tsx
        ProgramCard.tsx
        SDGSelector.tsx
        BrandAssetUpload.tsx

      shared/
        PlatformBadge.tsx
        ContentTypeBadge.tsx
        StatusBadge.tsx
        SDGBadge.tsx
        QualityScoreBadge.tsx
        LoadingSkeleton.tsx
        EmptyState.tsx
        ErrorState.tsx
        ConfirmDialog.tsx
        UploadArea.tsx
        DateRangePicker.tsx
        AwarenessDayCard.tsx
        OrgAvatar.tsx
        PostPreviewCard.tsx
        PlatformIcon.tsx
        AIStreamingText.tsx
        CountUp.tsx
        TruncatedText.tsx
        CopyToClipboard.tsx

    hooks/
      useContentGeneration.ts        ← AI generation state management
      useVoiceProfile.ts             ← Brand voice context
      useScheduler.ts                ← Scheduling operations
      useAnalytics.ts                ← Analytics data fetching
      useCampaign.ts                 ← Campaign CRUD
      useAwarenessDays.ts            ← Festival calendar
      useHashtags.ts                 ← Hashtag management
      usePlatformAccounts.ts         ← Social media auth
      useContentLibrary.ts           ← Library browsing + filtering
      useKeyboardShortcuts.ts        ← Global keyboard shortcuts
      useStreamingText.ts            ← AI text streaming helper
      useDebounce.ts
      useLocalStorage.ts
      useMobile.ts                   ← Responsive breakpoint detection

    lib/
      ai/
        generateContent.ts           ← Core AI generation function
        routeToModel.ts              ← Model routing logic
        buildSystemPrompt.ts         ← Prompt assembly
        voiceToPrompt.ts             ← Voice profile → prompt injection
        streamingHandler.ts          ← Handle streaming responses
        qualityScorer.ts             ← Quality scoring prompt
      social/
        linkedinClient.ts
        instagramClient.ts
        twitterClient.ts
        platformRouter.ts
      auth/
        authOptions.ts               ← NextAuth config
        session.ts
      db/
        prisma.ts                    ← Prisma client singleton
        queries/
          content.ts
          campaigns.ts
          analytics.ts
          users.ts
          orgs.ts
      utils/
        formatters.ts                ← Date, number, text formatting
        validators.ts                ← Input validation
        contentHelpers.ts            ← Character count, hashtag parsing
        awarenessDays.ts             ← Awareness day data
        platformLimits.ts            ← Per-platform character limits

    store/
      contentStore.ts                ← Zustand: current generation state
      campaignStore.ts               ← Active campaign context
      uiStore.ts                     ← Sidebar state, modal state, theme
      onboardingStore.ts             ← Onboarding progress
      orgStore.ts                    ← Current org + voice profile

    types/
      content.ts                     ← ContentPost, GenerationRequest, etc.
      campaign.ts                    ← Campaign, CampaignPost, etc.
      brand.ts                       ← VoiceProfile, OrgProfile, etc.
      analytics.ts                   ← AnalyticsData, PlatformMetrics, etc.
      platform.ts                    ← SocialAccount, PlatformType, etc.
      ai.ts                          ← AIModel, GenerationResult, etc.
      user.ts                        ← User, OrgMember, Role, etc.
      api.ts                         ← API request/response types

    utils/
      cn.ts                          ← clsx + twMerge utility
      dates.ts                       ← Date calculation helpers
      platforms.ts                   ← Platform-specific utilities
      contentFormatting.ts           ← Post formatting for each platform
      hashtagUtils.ts

    styles/
      globals.css                    ← Tailwind base + custom CSS vars
      animations.css                 ← Custom keyframe animations
      prose.css                      ← Tailwind prose customization

  public/
    fonts/
    images/
    icons/
    og-images/

  .env.local
  .env.example
  next.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
  components.json                    ← Shadcn/ui config
```

---

*End of UI_UX_PLAN.md — Brandora AI UI/UX Specification v1.0*
*Maintained by: Product Design Team | Review cycle: Per sprint*
