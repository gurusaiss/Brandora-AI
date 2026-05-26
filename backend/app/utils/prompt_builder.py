"""
Prompt building system for all AI generation tasks.
Provides platform-specific instructions and WASH/hygiene domain context.
"""
from typing import Any, Dict, List, Optional


# ── Platform Instructions ─────────────────────────────────────────────────────

PLATFORM_INSTRUCTIONS: Dict[str, str] = {
    "linkedin": """
LinkedIn post requirements:
- Length: 150-300 words optimal
- Start with a powerful hook (question, statistic, or bold statement)
- Use line breaks for readability (1-2 sentences per paragraph)
- Include a clear call-to-action at the end
- Professional yet personal tone
- No markdown formatting (LinkedIn renders plain text)
- End with 3-5 relevant hashtags on a new line
""",
    "instagram": """
Instagram caption requirements:
- Length: 100-150 words for main caption
- Start with attention-grabbing first line (shows before "more")
- Use emojis strategically (2-4 relevant ones)
- Include a clear CTA (save, share, comment, visit link in bio)
- End with 5-8 hashtags (mix niche + broad)
- Warm, visual, and community-oriented tone
""",
    "twitter": """
Twitter/X post requirements:
- If single tweet: max 280 characters
- If thread: 5-7 tweets, each building on the previous
- Use numbers for threads (1/ 2/ 3/)
- Punchy, direct, high-information density
- End with a question or CTA for engagement
- 2-3 hashtags maximum
""",
    "reel_script": """
Instagram Reel script (60 seconds):
- Hook (0-3 seconds): MUST grab attention immediately — start with "Did you know..." or a bold fact
- Problem/Stat (3-15 seconds): shocking fact or relatable problem
- Solution/Insight (15-45 seconds): core value delivery, actionable insight
- CTA (45-60 seconds): clear action to take (follow, share, comment, visit)
- Include visual direction notes in brackets: [ON SCREEN: text], [B-ROLL: description]
- Conversational, energetic tone
- Word count: 100-150 words for the spoken script
""",
    "carousel": """
Instagram/LinkedIn carousel outline:
- Slide 1 (Cover): Bold title that makes people swipe (5-8 words max)
- Slides 2-6: One key point per slide with clear hierarchy
  - Slide Title: 5-7 words
  - Slide Body: 20-40 words
  - Visual suggestion in brackets: [VISUAL: description]
- Slide 7 (Final): Summary + CTA + branding
- Format each slide as: "SLIDE [N]: [TITLE]\n[Body text]\n[Visual]"
- Educational, structured, save-worthy content
""",
    "csr_story": """
CSR impact story for LinkedIn:
- Format: STAR (Situation → Task → Action → Result)
- Include specific numbers and impact metrics (lives impacted, villages covered, etc.)
- Reference SDG alignment (e.g., "contributing to SDG 6")
- Beneficiary-centered narrative (real human impact, not corporate speak)
- Length: 200-350 words
- Professional, trustworthy, evidence-based tone
- End with forward-looking statement and CTA
""",
    "founder_post": """
Founder thought leadership post:
- Personal voice, first person ("I", "we" — choose one and be consistent)
- Share a unique insight, lesson learned, or behind-the-scenes story
- Vulnerability + expertise combination (show the human behind the mission)
- Specific story with a universal lesson
- Length: 150-250 words
- Authentic, thoughtful, visionary tone
- End with a question to spark conversation
""",
}

TONE_DESCRIPTIONS: Dict[str, str] = {
    "professional": "formal, authoritative, fact-based, credible",
    "inspirational": "uplifting, motivating, hope-driven, empowering",
    "educational": "informative, clear, teaching-focused, accessible",
    "urgent": "action-oriented, time-sensitive, compelling, direct",
    "conversational": "friendly, relatable, casual, community-centered",
}

LANGUAGE_INSTRUCTIONS: Dict[str, str] = {
    "en": "Write entirely in English.",
    "hi": "Write entirely in Hindi (Devanagari script). Ensure culturally appropriate phrasing.",
    "bn": "Write entirely in Bengali (বাংলা script). Use culturally resonant language.",
    "ta": "Write entirely in Tamil (தமிழ் script). Use respectful, culturally appropriate tone.",
    "kn": "Write entirely in Kannada (ಕನ್ನಡ script). Use culturally sensitive phrasing.",
}

SANITATION_HYGIENE_CONTEXT = """
You are an expert communicator in sanitation and menstrual hygiene for NGOs and CSR teams.

Domain knowledge you apply:
- WASH (Water, Sanitation, Hygiene) sector best practices
- Menstrual Hygiene Management (MHM) — use empowering, non-stigmatizing language
- Open Defecation Free (ODF) programs and community outcomes
- Community-Led Total Sanitation (CLTS) methodology
- Swachh Bharat Mission (Clean India Mission)
- SDG 6 (Clean Water and Sanitation), SDG 3 (Good Health and Well-being), SDG 5 (Gender Equality)
- Period poverty, menstrual stigma, and breaking taboos
- Sustainable menstrual products (menstrual cups, reusable cloth pads, compostable products)
- NGO communications and FCRA compliance awareness
- CSR reporting standards (GRI Standards, Integrated Reporting <IR> Framework)
- Social impact storytelling and evidence-based advocacy

Cultural sensitivity guidelines:
- Always use empowering language about communities (never pitying)
- Be respectful and non-stigmatizing about menstruation
- Acknowledge diverse cultural contexts in India and South Asia
- Avoid graphic/clinical language unless educational context requires it
- Celebrate community agency and local leadership
- Use "menstrual health" or "period health" rather than clinical terms unless educational
"""


# ── Prompt Builders ───────────────────────────────────────────────────────────

def build_system_prompt(brand_profile: Dict[str, Any], platform: str) -> str:
    """
    Build a comprehensive system prompt incorporating brand voice,
    sector context, and platform-specific instructions.
    """
    org_name = brand_profile.get("organization_name") or "our organization"
    mission = brand_profile.get("mission_statement") or ""
    tagline = brand_profile.get("tagline") or ""
    sector_focus = brand_profile.get("sector_focus") or []
    target_audience = brand_profile.get("target_audience") or "general audience"
    sdg_alignment = brand_profile.get("sdg_alignment") or []
    avoid_words = brand_profile.get("avoid_words") or []
    custom_vocab = brand_profile.get("custom_vocabulary") or []

    # Tone guidance
    tone_pro = brand_profile.get("tone_professional", 7)
    tone_warm = brand_profile.get("tone_warm", 7)
    tone_insp = brand_profile.get("tone_inspirational", 6)
    tone_edu = brand_profile.get("tone_educational", 7)
    tone_urg = brand_profile.get("tone_urgent", 4)

    # Platform instructions
    platform_instr = PLATFORM_INSTRUCTIONS.get(platform, PLATFORM_INSTRUCTIONS["linkedin"])

    prompt_parts = [
        SANITATION_HYGIENE_CONTEXT,
        f"\n## Your Organization\nYou are creating content for **{org_name}**.",
    ]

    if tagline:
        prompt_parts.append(f"Tagline: \"{tagline}\"")
    if mission:
        prompt_parts.append(f"Mission: {mission}")
    if sector_focus:
        prompt_parts.append(f"Sector focus: {', '.join(sector_focus)}")
    if sdg_alignment:
        prompt_parts.append(f"SDG alignment: {', '.join(f'SDG {n}' for n in sdg_alignment)}")

    prompt_parts.append(f"\nTarget audience: {target_audience}")

    # Tone calibration
    prompt_parts.append(f"""
## Voice & Tone Calibration (1=low, 10=high)
- Professional: {tone_pro}/10
- Warm/Empathetic: {tone_warm}/10
- Inspirational: {tone_insp}/10
- Educational: {tone_edu}/10
- Urgency: {tone_urg}/10

Let these scores shape your writing style. High professional + high warm = authoritative yet human.
High educational = include facts and explanations. High urgency = use action verbs and time cues.
""")

    if custom_vocab:
        prompt_parts.append(f"Preferred vocabulary/terms: {', '.join(custom_vocab)}")
    if avoid_words:
        prompt_parts.append(f"AVOID these words/phrases: {', '.join(avoid_words)}")

    # Founder context
    founder_name = brand_profile.get("founder_name")
    founder_title = brand_profile.get("founder_title")
    founder_bio = brand_profile.get("founder_bio")
    if founder_name and platform == "founder_post":
        prompt_parts.append(
            f"\n## Founder Voice\nWriting as: {founder_name}"
            + (f", {founder_title}" if founder_title else "")
            + (f"\nBio context: {founder_bio}" if founder_bio else "")
        )

    # Platform instructions
    prompt_parts.append(f"\n## Platform Requirements\n{platform_instr}")

    prompt_parts.append(
        "\n## Important\n"
        "- Generate COMPLETE, publication-ready content. Do not use placeholders like [Your Name] or [add statistics].\n"
        "- If you include statistics, use real, publicly available data from WHO, UNICEF, or NFHS reports.\n"
        "- Never fabricate quotes or specific beneficiary names.\n"
        "- Output ONLY the post content (and hashtags if required) — no preamble or meta-commentary.\n"
    )

    return "\n".join(prompt_parts)


def build_user_prompt(
    topic: str,
    platform: str,
    context: Optional[str] = None,
    campaign_brief: Optional[str] = None,
    tone: str = "professional",
    language: str = "en",
) -> str:
    """Build the user-facing prompt for content generation."""
    tone_desc = TONE_DESCRIPTIONS.get(tone, "professional")
    lang_instr = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])

    parts = [
        f"Create a {platform.replace('_', ' ')} post about:\n**{topic}**",
        f"\nTone: {tone} ({tone_desc})",
        f"\nLanguage: {lang_instr}",
    ]

    if context:
        parts.append(f"\nAdditional context:\n{context}")

    if campaign_brief:
        parts.append(f"\nCampaign brief:\n{campaign_brief}")

    parts.append(
        f"\nGenerate the complete, ready-to-publish {platform.replace('_', ' ')} content now. "
        "Include relevant hashtags at the end."
    )

    return "\n".join(parts)


def build_hashtag_prompt(topic: str, platform: str, content: str) -> str:
    """Build prompt for hashtag generation."""
    platform_guidance = {
        "linkedin": "Generate 5-7 professional hashtags. Mix broad (#CSR, #NGO) and niche (#MenstrualHygiene, #WASH).",
        "instagram": "Generate 8-12 hashtags. Mix popular (100k+ posts) and niche tags. Include cause-specific and location tags.",
        "twitter": "Generate 2-3 highly relevant hashtags only. Twitter penalizes hashtag overuse.",
    }.get(platform, "Generate 5-7 relevant hashtags.")

    return f"""Generate relevant hashtags for the following social media content.

Topic: {topic}
Platform: {platform}
{platform_guidance}

Content excerpt:
{content[:500] if content else '(no content provided)'}

Focus areas: WASH, sanitation, menstrual hygiene, NGO, CSR, SDGs, social impact, India.

Return ONLY the hashtags as a space-separated list. Example: #WASH #MenstrualHealth #SDG6 #SocialImpact
"""


def build_quality_score_prompt(content: str, platform: str) -> str:
    """Build prompt for quality scoring."""
    return f"""Evaluate the following {platform} social media post and give it a quality score.

POST:
---
{content}
---

Score the post on these criteria (0-100 scale):
1. Engagement potential (hook, CTA, relatable)
2. Clarity and readability
3. Platform appropriateness (length, format, style)
4. Impact/value for the reader
5. Brand safety (no harmful/misleading content)

Return ONLY a JSON object like this:
{{"score": 78, "hook_strength": "strong", "cta_present": true, "notes": "Clear impact statement"}}
"""


def build_voice_analysis_prompt(sample_posts: List[str]) -> str:
    """Build prompt for brand voice analysis from sample posts."""
    posts_text = "\n\n---\n\n".join(
        f"Post {i+1}:\n{post}" for i, post in enumerate(sample_posts[:10])
    )

    return f"""Analyze the following social media posts to extract brand voice dimensions.

SAMPLE POSTS:
{posts_text}

Analyze and return ONLY a JSON object with these keys:
- tone_professional (1-10): How formal/authoritative is the writing?
- tone_warm (1-10): How empathetic/human/warm is the writing?
- tone_inspirational (1-10): How uplifting/motivating is the writing?
- tone_educational (1-10): How much does it teach/inform?
- tone_urgent (1-10): How action-oriented/urgent is the writing?
- vocabulary_suggestions: List of up to 10 brand-specific terms/phrases found
- avoid_words: List of up to 5 words/phrases that seem out of character
- summary: 2-sentence description of the overall brand voice

Example response format:
{{
  "tone_professional": 8,
  "tone_warm": 7,
  "tone_inspirational": 9,
  "tone_educational": 6,
  "tone_urgent": 4,
  "vocabulary_suggestions": ["change-makers", "period dignity", "last mile communities"],
  "avoid_words": ["victims", "poor people"],
  "summary": "The brand voice is highly inspirational and professional, focusing on empowerment. It uses specific impact language and avoids deficit narratives."
}}
"""


def build_repurpose_prompt(
    original_content: str,
    original_platform: str,
    target_platform: str,
    brand_profile: Dict[str, Any],
) -> str:
    """Build prompt for repurposing content to a new platform."""
    target_instr = PLATFORM_INSTRUCTIONS.get(target_platform, "")

    return f"""Repurpose the following {original_platform} content for {target_platform}.

ORIGINAL {original_platform.upper()} CONTENT:
---
{original_content}
---

TARGET PLATFORM REQUIREMENTS ({target_platform}):
{target_instr}

Instructions:
- Preserve the core message, key facts, and call-to-action
- Adapt the length, format, tone, and style for {target_platform}
- Keep any important statistics or impact numbers
- Generate new platform-appropriate hashtags
- Do NOT add fictional details — only adapt what's already there
- Output ONLY the repurposed content, ready to publish
"""
