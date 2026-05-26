"""
Core AI service — model routing, generation, hashtags, quality scoring, repurposing.
"""
import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.exceptions import AIServiceError

logger = logging.getLogger("brandora.ai")


# ── Model Router ──────────────────────────────────────────────────────────────

class ModelRouter:
    """Routes AI requests to the optimal model based on task type and cost."""

    MODELS: Dict[str, Dict[str, Any]] = {
        "gpt-4o": {
            "provider": "openai",
            "cost_per_1k_tokens": 0.005,
            "max_tokens": 128000,
            "best_for": ["storytelling", "long_form", "csr_story", "founder_post", "carousel"],
        },
        "claude-3-5-sonnet-20241022": {
            "provider": "anthropic",
            "cost_per_1k_tokens": 0.003,
            "max_tokens": 200000,
            "best_for": ["nuanced_tone", "sensitive_topics", "brand_voice", "reel_script"],
        },
        "gemini-1.5-flash": {
            "provider": "google",
            "cost_per_1k_tokens": 0.0001,
            "max_tokens": 1000000,
            "best_for": ["fast_generation", "simple_posts", "bulk", "hashtags"],
        },
    }

    PLATFORM_MODEL_MAP: Dict[str, str] = {
        "csr_story": "gpt-4o",
        "founder_post": "gpt-4o",
        "carousel": "gpt-4o",
        "reel_script": "claude-3-5-sonnet-20241022",
        "linkedin": "claude-3-5-sonnet-20241022",
        "instagram": "gemini-1.5-flash",
        "twitter": "gemini-1.5-flash",
    }

    def select_model(self, platform: str, priority: str = "balanced") -> str:
        """
        Select the best model for a platform/task.

        priority:
          - "quality"  → always GPT-4o
          - "fast"     → always Gemini
          - "balanced" → platform-based routing (default)
        """
        if priority == "quality":
            return "gpt-4o"
        if priority == "fast":
            return "gemini-1.5-flash"
        return self.PLATFORM_MODEL_MAP.get(platform, settings.DEFAULT_AI_MODEL)

    def get_provider(self, model: str) -> str:
        return self.MODELS.get(model, {}).get("provider", "openai")


# ── AI Service ────────────────────────────────────────────────────────────────

class AIService:
    """
    Unified AI service wrapping OpenAI, Anthropic, and Google Gemini.
    Handles generation, hashtags, quality scoring, repurposing, and voice analysis.
    """

    def __init__(self) -> None:
        self.model_router = ModelRouter()
        self._openai_client = None
        self._anthropic_client = None
        self._gemini_client = None

    # ── Lazy client initialization ────────────────────────────────────────────

    def _get_openai(self):
        if self._openai_client is None:
            from openai import AsyncOpenAI
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client

    def _get_anthropic(self):
        if self._anthropic_client is None:
            from anthropic import AsyncAnthropic
            self._anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._anthropic_client

    def _get_gemini(self):
        if self._gemini_client is None:
            import google.generativeai as genai
            genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
            self._gemini_client = genai.GenerativeModel("gemini-1.5-flash")
        return self._gemini_client

    # ── Core generation ───────────────────────────────────────────────────────

    async def generate_content(
        self,
        topic: str,
        platform: str,
        brand_profile: Any = None,
        tone: str = "professional",
        context: Optional[str] = None,
        campaign_brief: Optional[str] = None,
        language: str = "en",
        model_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate social media content using the best-fit AI model.
        Returns dict with keys: content, hashtags, model, tokens_used, quality_score
        """
        from app.utils.prompt_builder import build_system_prompt, build_user_prompt, build_quality_score_prompt

        model = model_override or self.model_router.select_model(platform)
        provider = self.model_router.get_provider(model)

        # Build prompts
        bp_dict = self._brand_profile_to_dict(brand_profile)
        system_prompt = build_system_prompt(bp_dict, platform)
        user_prompt = build_user_prompt(
            topic=topic,
            platform=platform,
            context=context,
            campaign_brief=campaign_brief,
            tone=tone,
            language=language,
        )

        logger.info("Generating content", platform=platform, model=model, topic=topic[:80])

        try:
            if provider == "openai":
                raw = await self._call_openai(system_prompt, user_prompt, model)
            elif provider == "anthropic":
                raw = await self._call_anthropic(system_prompt, user_prompt, model)
            else:
                raw = await self._call_gemini(system_prompt, user_prompt)
        except Exception as exc:
            logger.error("AI provider failed, falling back to GPT-4o", error=str(exc), provider=provider)
            # Fallback to OpenAI
            try:
                raw = await self._call_openai(system_prompt, user_prompt, "gpt-4o")
                model = "gpt-4o"
            except Exception as fallback_exc:
                raise AIServiceError(f"All AI providers failed: {fallback_exc}") from fallback_exc

        content = raw.get("content", "").strip()
        tokens_used = raw.get("tokens_used", 0)

        # Extract and clean hashtags from content
        hashtags = self._extract_hashtags(content)

        # Quality score (async, using a fast model)
        quality_score = None
        try:
            quality_score = await self.calculate_quality_score(content, platform, brand_profile)
        except Exception:
            pass  # Non-fatal

        return {
            "content": content,
            "hashtags": hashtags,
            "model": model,
            "tokens_used": tokens_used,
            "quality_score": quality_score,
        }

    # ── Provider Calls ────────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_openai(self, system_prompt: str, user_prompt: str, model: str) -> Dict[str, Any]:
        client = self._get_openai()
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=1500,
        )
        content = response.choices[0].message.content or ""
        tokens_used = response.usage.total_tokens if response.usage else 0
        return {"content": content, "tokens_used": tokens_used}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_anthropic(self, system_prompt: str, user_prompt: str, model: str) -> Dict[str, Any]:
        client = self._get_anthropic()
        response = await client.messages.create(
            model=model,
            max_tokens=1500,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = response.content[0].text if response.content else ""
        tokens_used = (response.usage.input_tokens or 0) + (response.usage.output_tokens or 0)
        return {"content": content, "tokens_used": tokens_used}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_gemini(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        client = self._get_gemini()
        combined_prompt = f"{system_prompt}\n\n---\n\n{user_prompt}"
        response = await asyncio.to_thread(client.generate_content, combined_prompt)
        content = response.text or ""
        # Gemini doesn't return token count in the same way
        tokens_used = len(combined_prompt.split()) + len(content.split())  # rough estimate
        return {"content": content, "tokens_used": tokens_used}

    # ── Hashtag Generation ────────────────────────────────────────────────────

    async def generate_hashtags(self, topic: str, platform: str, content: str) -> List[str]:
        """Generate relevant hashtags for the given topic and platform."""
        from app.utils.prompt_builder import build_hashtag_prompt

        prompt = build_hashtag_prompt(topic=topic, platform=platform, content=content)

        try:
            raw = await self._call_gemini(
                system_prompt="You are a social media hashtag expert specializing in NGO, sanitation, and hygiene content.",
                user_prompt=prompt,
            )
            text = raw.get("content", "")
            return self._parse_hashtag_list(text)
        except Exception as exc:
            logger.warning("Hashtag generation failed", error=str(exc))
            return self._fallback_hashtags(platform)

    def _fallback_hashtags(self, platform: str) -> List[str]:
        base = ["#WASH", "#Sanitation", "#MenstrualHygiene", "#SDG6", "#SocialImpact"]
        if platform == "linkedin":
            return base + ["#NGO", "#CSR", "#SustainableDevelopment"]
        if platform == "instagram":
            return base + ["#PeriodPoverty", "#CleanWater", "#HygienForAll"]
        return base

    # ── Quality Score ─────────────────────────────────────────────────────────

    async def calculate_quality_score(
        self, content: str, platform: str, brand_profile: Any = None
    ) -> float:
        """
        Score content on a 0-100 scale using a fast model.
        Criteria: engagement potential, brand alignment, clarity, CTA presence.
        """
        from app.utils.prompt_builder import build_quality_score_prompt

        bp_dict = self._brand_profile_to_dict(brand_profile)
        prompt = build_quality_score_prompt(content=content, platform=platform)

        try:
            raw = await self._call_gemini(
                system_prompt="You are a social media content quality analyst. Respond ONLY with a JSON object.",
                user_prompt=prompt,
            )
            text = raw.get("content", "")
            # Extract JSON
            match = re.search(r"\{.*?\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group())
                score = float(data.get("score", 70))
                return min(100.0, max(0.0, score))
        except Exception as exc:
            logger.debug("Quality score parsing failed", error=str(exc))

        # Heuristic fallback score
        return self._heuristic_quality_score(content, platform)

    def _heuristic_quality_score(self, content: str, platform: str) -> float:
        """Simple rule-based quality estimation."""
        score = 60.0
        words = len(content.split())

        # Platform length checks
        if platform == "twitter" and words <= 50:
            score += 10
        elif platform == "linkedin" and 100 <= words <= 350:
            score += 10
        elif platform == "instagram" and 50 <= words <= 200:
            score += 10

        # Has CTA
        cta_patterns = ["follow", "share", "comment", "click", "visit", "dm us", "learn more", "link in bio"]
        if any(p in content.lower() for p in cta_patterns):
            score += 8

        # Has numbers/stats
        if re.search(r"\d+", content):
            score += 5

        # Has hashtags
        if "#" in content:
            score += 5

        # Has emojis
        emoji_pattern = re.compile(
            "[\U00010000-\U0010FFFF]", flags=re.UNICODE
        )
        if emoji_pattern.search(content):
            score += 4

        return min(100.0, score)

    # ── Repurpose ─────────────────────────────────────────────────────────────

    async def repurpose_content(
        self,
        original_content: str,
        original_platform: str,
        target_platforms: List[str],
        brand_profile: Any = None,
    ) -> List[Dict[str, Any]]:
        """
        Repurpose content for multiple platforms in parallel.
        """
        from app.utils.prompt_builder import build_repurpose_prompt

        bp_dict = self._brand_profile_to_dict(brand_profile)

        async def _repurpose_single(target_platform: str) -> Dict[str, Any]:
            model = self.model_router.select_model(target_platform)
            provider = self.model_router.get_provider(model)

            system_prompt = (
                "You are an expert social media content strategist. "
                "Repurpose the given content for the target platform while preserving the core message."
            )
            user_prompt = build_repurpose_prompt(
                original_content=original_content,
                original_platform=original_platform,
                target_platform=target_platform,
                brand_profile=bp_dict,
            )

            try:
                if provider == "openai":
                    raw = await self._call_openai(system_prompt, user_prompt, model)
                elif provider == "anthropic":
                    raw = await self._call_anthropic(system_prompt, user_prompt, model)
                else:
                    raw = await self._call_gemini(system_prompt, user_prompt)
            except Exception as exc:
                logger.error("Repurpose failed for platform", platform=target_platform, error=str(exc))
                raw = {"content": original_content, "tokens_used": 0}
                model = "fallback"

            content = raw.get("content", "").strip()
            hashtags = self._extract_hashtags(content)
            quality_score = self._heuristic_quality_score(content, target_platform)

            return {
                "platform": target_platform,
                "content": content,
                "hashtags": hashtags,
                "model": model,
                "tokens_used": raw.get("tokens_used", 0),
                "quality_score": quality_score,
            }

        results = await asyncio.gather(
            *[_repurpose_single(p) for p in target_platforms], return_exceptions=True
        )

        # Filter out exceptions
        return [r for r in results if isinstance(r, dict)]

    # ── Voice Analysis ────────────────────────────────────────────────────────

    async def analyze_brand_voice(self, sample_posts: List[str]) -> Dict[str, Any]:
        """
        Analyze sample posts to extract brand voice dimensions and vocabulary.
        """
        from app.utils.prompt_builder import build_voice_analysis_prompt

        prompt = build_voice_analysis_prompt(sample_posts)

        try:
            raw = await self._call_anthropic(
                system_prompt=(
                    "You are a brand voice analyst. Analyze social media posts and extract tone dimensions. "
                    "Respond ONLY with a valid JSON object."
                ),
                user_prompt=prompt,
                model="claude-3-5-sonnet-20241022",
            )
            text = raw.get("content", "")

            # Extract JSON from response
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group())
                return {
                    "tone_professional": int(data.get("tone_professional", 7)),
                    "tone_warm": int(data.get("tone_warm", 7)),
                    "tone_inspirational": int(data.get("tone_inspirational", 6)),
                    "tone_educational": int(data.get("tone_educational", 7)),
                    "tone_urgent": int(data.get("tone_urgent", 4)),
                    "vocabulary_suggestions": data.get("vocabulary_suggestions", []),
                    "avoid_words": data.get("avoid_words", []),
                    "summary": data.get("summary", "Brand voice analysis complete."),
                }
        except Exception as exc:
            logger.warning("Voice analysis failed", error=str(exc))

        return {
            "tone_professional": 7,
            "tone_warm": 7,
            "tone_inspirational": 6,
            "tone_educational": 7,
            "tone_urgent": 4,
            "vocabulary_suggestions": [],
            "avoid_words": [],
            "summary": "Could not fully analyze voice. Using default tone settings.",
        }

    # ── Utilities ─────────────────────────────────────────────────────────────

    def _extract_hashtags(self, content: str) -> List[str]:
        """Extract hashtags from generated content."""
        hashtags = re.findall(r"#\w+", content)
        return list(dict.fromkeys(hashtags))  # Deduplicate preserving order

    def _parse_hashtag_list(self, text: str) -> List[str]:
        """Parse hashtags from AI response text."""
        hashtags = re.findall(r"#\w+", text)
        if hashtags:
            return list(dict.fromkeys(hashtags))[:15]
        # Fallback: split by comma/newline and add #
        lines = re.split(r"[,\n]", text)
        result = []
        for line in lines:
            word = line.strip().strip("#").strip()
            if word and len(word) > 1 and " " not in word:
                result.append(f"#{word}")
        return result[:15]

    @staticmethod
    def _brand_profile_to_dict(brand_profile: Any) -> Dict[str, Any]:
        """Safely convert a BrandProfile ORM object to a plain dict."""
        if brand_profile is None:
            return {}
        if isinstance(brand_profile, dict):
            return brand_profile
        # ORM object
        return {
            "organization_name": getattr(brand_profile, "organization_name", ""),
            "tagline": getattr(brand_profile, "tagline", ""),
            "mission_statement": getattr(brand_profile, "mission_statement", ""),
            "about": getattr(brand_profile, "about", ""),
            "sector_focus": getattr(brand_profile, "sector_focus", []) or [],
            "target_audience": getattr(brand_profile, "target_audience", ""),
            "geographic_focus": getattr(brand_profile, "geographic_focus", ""),
            "sdg_alignment": getattr(brand_profile, "sdg_alignment", []) or [],
            "tone_professional": getattr(brand_profile, "tone_professional", 7),
            "tone_warm": getattr(brand_profile, "tone_warm", 7),
            "tone_inspirational": getattr(brand_profile, "tone_inspirational", 6),
            "tone_educational": getattr(brand_profile, "tone_educational", 7),
            "tone_urgent": getattr(brand_profile, "tone_urgent", 4),
            "founder_name": getattr(brand_profile, "founder_name", ""),
            "founder_title": getattr(brand_profile, "founder_title", ""),
            "founder_bio": getattr(brand_profile, "founder_bio", ""),
            "custom_vocabulary": getattr(brand_profile, "custom_vocabulary", []) or [],
            "avoid_words": getattr(brand_profile, "avoid_words", []) or [],
            "sample_posts": getattr(brand_profile, "sample_posts", []) or [],
        }
