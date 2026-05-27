"""
Core AI service — Groq-first, multi-model routing with free fallback chain.

Provider priority (all free by default):
  1. Groq  — PRIMARY   — llama-3.3-70b-versatile / llama-3.1-8b-instant / mixtral-8x7b
  2. Gemini — FALLBACK  — gemini-1.5-flash  (if GOOGLE_AI_API_KEY set)
  3. OpenAI — OPTIONAL  — gpt-4o            (if OPENAI_API_KEY set, paid)
  4. Claude — OPTIONAL  — claude-3-5-sonnet (if ANTHROPIC_API_KEY set, paid)
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


# ── Groq model catalogue ───────────────────────────────────────────────────────
# Free tier limits per model (as of 2026):
#   llama-3.3-70b-versatile : 30 RPM · 14,400 RPD · 6,000 TPM
#   llama-3.1-8b-instant    : 30 RPM · 14,400 RPD · 20,000 TPM
#   mixtral-8x7b-32768      : 30 RPM · 14,400 RPD · 5,000 TPM
#   gemma2-9b-it            : 30 RPM · 14,400 RPD · 15,000 TPM
GROQ_MODELS = {
    "llama-3.3-70b-versatile": {
        "provider": "groq",
        "cost_per_1k_tokens": 0.0,
        "context_window": 128_000,
        "best_for": ["csr_story", "founder_post", "carousel", "linkedin", "reel_script", "voice_analysis"],
        "description": "Best quality free model — ideal for long-form and nuanced content",
    },
    "llama-3.1-8b-instant": {
        "provider": "groq",
        "cost_per_1k_tokens": 0.0,
        "context_window": 128_000,
        "best_for": ["twitter", "hashtags", "quality_score", "simple_posts"],
        "description": "Ultra-fast, lower latency — ideal for short content and scoring",
    },
    "mixtral-8x7b-32768": {
        "provider": "groq",
        "cost_per_1k_tokens": 0.0,
        "context_window": 32_768,
        "best_for": ["instagram", "repurpose", "medium_length"],
        "description": "Strong instruction-following, great for repurposing tasks",
    },
    "gemma2-9b-it": {
        "provider": "groq",
        "cost_per_1k_tokens": 0.0,
        "context_window": 8_192,
        "best_for": ["quick_draft", "backup_groq"],
        "description": "Google Gemma 2 — lightweight backup Groq model",
    },
}

ALL_MODELS: Dict[str, Dict[str, Any]] = {
    **GROQ_MODELS,
    # Free secondary fallback
    "gemini-1.5-flash": {
        "provider": "google",
        "cost_per_1k_tokens": 0.0,
        "context_window": 1_000_000,
        "best_for": ["bulk", "long_context"],
        "description": "Google Gemini Flash — free fallback with massive context window",
    },
    # Optional paid providers
    "gpt-4o": {
        "provider": "openai",
        "cost_per_1k_tokens": 0.005,
        "context_window": 128_000,
        "best_for": ["premium_quality"],
        "description": "OpenAI GPT-4o — paid, premium quality",
    },
    "gpt-4o-mini": {
        "provider": "openai",
        "cost_per_1k_tokens": 0.00015,
        "context_window": 128_000,
        "best_for": ["affordable_openai"],
        "description": "OpenAI GPT-4o mini — paid but very cheap (~$0.0004/post)",
    },
    "claude-3-5-sonnet-20241022": {
        "provider": "anthropic",
        "cost_per_1k_tokens": 0.003,
        "context_window": 200_000,
        "best_for": ["premium_quality"],
        "description": "Anthropic Claude 3.5 Sonnet — paid, excellent for nuanced tone",
    },
}


# ── Model Router ───────────────────────────────────────────────────────────────

class ModelRouter:
    """
    Routes content generation requests to the best available model.

    Default routing uses Groq free models only.
    Paid models (OpenAI/Anthropic) are only activated if their API keys are set.
    """

    # Groq-first platform routing
    PLATFORM_MODEL_MAP: Dict[str, str] = {
        "csr_story":    "llama-3.3-70b-versatile",   # Best Groq model for storytelling
        "founder_post": "llama-3.3-70b-versatile",   # Nuanced personal voice
        "carousel":     "llama-3.3-70b-versatile",   # Multi-slide structured content
        "linkedin":     "llama-3.3-70b-versatile",   # Professional long-form
        "reel_script":  "llama-3.3-70b-versatile",   # Creative scripting
        "instagram":    "mixtral-8x7b-32768",         # Engaging captions
        "twitter":      "llama-3.1-8b-instant",      # Short, punchy, fast
    }

    # Internal task routing (hashtags, scoring, etc.)
    TASK_MODEL_MAP: Dict[str, str] = {
        "hashtags":      "llama-3.1-8b-instant",     # Fast, low latency
        "quality_score": "llama-3.1-8b-instant",     # Fast scoring
        "voice_analysis": "llama-3.3-70b-versatile", # Needs quality for analysis
        "repurpose":     "mixtral-8x7b-32768",        # Good at following format instructions
    }

    def select_model(self, platform: str, priority: str = "balanced") -> str:
        """
        Select the best available model for a platform/task.

        priority:
          "balanced" (default) → Groq routing by platform
          "fast"               → llama-3.1-8b-instant (always)
          "quality"            → llama-3.3-70b-versatile or paid if key set
        """
        if priority == "fast":
            return "llama-3.1-8b-instant"

        if priority == "quality":
            # Escalate to paid model if key is set
            if settings.OPENAI_API_KEY:
                return "gpt-4o"
            if settings.ANTHROPIC_API_KEY:
                return "claude-3-5-sonnet-20241022"
            return "llama-3.3-70b-versatile"  # Best free option

        return self.PLATFORM_MODEL_MAP.get(platform, settings.DEFAULT_AI_MODEL)

    def select_task_model(self, task: str) -> str:
        return self.TASK_MODEL_MAP.get(task, "llama-3.1-8b-instant")

    def get_provider(self, model: str) -> str:
        return ALL_MODELS.get(model, {}).get("provider", "groq")

    def build_fallback_chain(self, primary_model: str) -> List[str]:
        """
        Build an ordered list of models to try, from primary to last resort.
        Only includes models whose API keys are actually configured.
        """
        chain = [primary_model]

        # Add other Groq models as first fallbacks (all free)
        groq_fallbacks = [
            m for m in GROQ_MODELS
            if m != primary_model and settings.GROQ_API_KEY
        ]
        chain.extend(groq_fallbacks[:2])  # Max 2 extra Groq fallbacks

        # Free secondary fallback
        if settings.GOOGLE_AI_API_KEY and "gemini-1.5-flash" not in chain:
            chain.append("gemini-1.5-flash")

        # Paid fallbacks (only if keys set)
        if settings.OPENAI_API_KEY and "gpt-4o" not in chain:
            chain.append("gpt-4o")
        if settings.ANTHROPIC_API_KEY and "claude-3-5-sonnet-20241022" not in chain:
            chain.append("claude-3-5-sonnet-20241022")

        return chain


# ── AI Service ─────────────────────────────────────────────────────────────────

class AIService:
    """
    Unified AI service — Groq-first, free-tier optimised.
    Handles generation, hashtags, quality scoring, repurposing, voice analysis.
    """

    def __init__(self) -> None:
        self.model_router = ModelRouter()
        self._groq_client = None
        self._openai_client = None
        self._anthropic_client = None
        self._gemini_client = None

    # ── Lazy client initialisation ─────────────────────────────────────────────

    def _get_groq(self):
        if self._groq_client is None:
            if not settings.GROQ_API_KEY:
                raise AIServiceError(
                    "GROQ_API_KEY is not set. "
                    "Get your free key at https://console.groq.com/keys"
                )
            from groq import AsyncGroq
            self._groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        return self._groq_client

    def _get_gemini(self):
        if self._gemini_client is None:
            if not settings.GOOGLE_AI_API_KEY:
                raise AIServiceError("GOOGLE_AI_API_KEY is not set.")
            import google.generativeai as genai
            genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
            self._gemini_client = genai.GenerativeModel("gemini-1.5-flash")
        return self._gemini_client

    def _get_openai(self):
        if self._openai_client is None:
            if not settings.OPENAI_API_KEY:
                raise AIServiceError("OPENAI_API_KEY is not set.")
            from openai import AsyncOpenAI
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client

    def _get_anthropic(self):
        if self._anthropic_client is None:
            if not settings.ANTHROPIC_API_KEY:
                raise AIServiceError("ANTHROPIC_API_KEY is not set.")
            from anthropic import AsyncAnthropic
            self._anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._anthropic_client

    # ── Core generation ────────────────────────────────────────────────────────

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
        Generate social media content.
        Returns: {content, hashtags, model, tokens_used, quality_score}
        """
        from app.utils.prompt_builder import (
            build_system_prompt,
            build_user_prompt,
        )

        model = model_override or self.model_router.select_model(platform)
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

        logger.info(
            "Generating content",
            extra={"platform": platform, "model": model, "topic": topic[:80]},
        )

        raw, used_model = await self._call_with_fallback(
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        content = raw.get("content", "").strip()
        tokens_used = raw.get("tokens_used", 0)
        hashtags = self._extract_hashtags(content)

        quality_score = None
        try:
            quality_score = await self.calculate_quality_score(content, platform)
        except Exception:
            quality_score = self._heuristic_quality_score(content, platform)

        return {
            "content": content,
            "hashtags": hashtags,
            "model": used_model,
            "tokens_used": tokens_used,
            "quality_score": quality_score,
        }

    # ── Call with fallback chain ───────────────────────────────────────────────

    async def _call_with_fallback(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
    ) -> tuple[Dict[str, Any], str]:
        """
        Try the primary model, then work through the fallback chain.
        Returns (result_dict, model_that_succeeded).
        """
        chain = self.model_router.build_fallback_chain(model)
        last_error: Exception = Exception("No AI providers configured.")

        for attempt_model in chain:
            provider = self.model_router.get_provider(attempt_model)
            try:
                if provider == "groq":
                    raw = await self._call_groq(system_prompt, user_prompt, attempt_model)
                elif provider == "google":
                    raw = await self._call_gemini(system_prompt, user_prompt)
                elif provider == "openai":
                    raw = await self._call_openai(system_prompt, user_prompt, attempt_model)
                elif provider == "anthropic":
                    raw = await self._call_anthropic(system_prompt, user_prompt, attempt_model)
                else:
                    continue

                if attempt_model != model:
                    logger.warning(
                        "Used fallback model",
                        extra={"primary": model, "fallback": attempt_model},
                    )
                return raw, attempt_model

            except Exception as exc:
                logger.warning(
                    "Model attempt failed",
                    extra={"model": attempt_model, "error": str(exc)},
                )
                last_error = exc
                continue

        raise AIServiceError(
            f"All AI providers exhausted. Last error: {last_error}. "
            "Ensure at least GROQ_API_KEY is set in your .env file."
        )

    # ── Provider call implementations ──────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=8))
    async def _call_groq(
        self, system_prompt: str, user_prompt: str, model: str
    ) -> Dict[str, Any]:
        """Call Groq API — OpenAI-compatible interface, ultra-fast inference."""
        client = self._get_groq()
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.75,
            max_tokens=1500,
        )
        content = response.choices[0].message.content or ""
        tokens_used = response.usage.total_tokens if response.usage else 0
        return {"content": content, "tokens_used": tokens_used}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=8))
    async def _call_gemini(
        self, system_prompt: str, user_prompt: str
    ) -> Dict[str, Any]:
        """Call Google Gemini Flash — free fallback."""
        client = self._get_gemini()
        combined = f"{system_prompt}\n\n---\n\n{user_prompt}"
        response = await asyncio.to_thread(client.generate_content, combined)
        content = response.text or ""
        tokens_used = len(combined.split()) + len(content.split())  # rough estimate
        return {"content": content, "tokens_used": tokens_used}

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_openai(
        self, system_prompt: str, user_prompt: str, model: str
    ) -> Dict[str, Any]:
        """Call OpenAI — paid, used only as last resort or if explicitly selected."""
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

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_anthropic(
        self, system_prompt: str, user_prompt: str, model: str
    ) -> Dict[str, Any]:
        """Call Anthropic Claude — paid, used only as last resort or if explicitly selected."""
        client = self._get_anthropic()
        response = await client.messages.create(
            model=model,
            max_tokens=1500,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = response.content[0].text if response.content else ""
        tokens_used = (
            (response.usage.input_tokens or 0) + (response.usage.output_tokens or 0)
        )
        return {"content": content, "tokens_used": tokens_used}

    # ── Hashtag Generation ─────────────────────────────────────────────────────

    async def generate_hashtags(
        self, topic: str, platform: str, content: str
    ) -> List[str]:
        """Generate relevant hashtags using the fast Groq model."""
        from app.utils.prompt_builder import build_hashtag_prompt

        model = self.model_router.select_task_model("hashtags")
        prompt = build_hashtag_prompt(topic=topic, platform=platform, content=content)

        try:
            raw, _ = await self._call_with_fallback(
                model=model,
                system_prompt=(
                    "You are a social media hashtag expert for NGO, sanitation, "
                    "and menstrual hygiene content. Output ONLY hashtags, comma-separated."
                ),
                user_prompt=prompt,
            )
            return self._parse_hashtag_list(raw.get("content", ""))
        except Exception as exc:
            logger.warning("Hashtag generation failed", extra={"error": str(exc)})
            return self._fallback_hashtags(platform)

    def _fallback_hashtags(self, platform: str) -> List[str]:
        base = ["#WASH", "#Sanitation", "#MenstrualHygiene", "#SDG6", "#SocialImpact"]
        if platform == "linkedin":
            return base + ["#NGO", "#CSR", "#SustainableDevelopment"]
        if platform == "instagram":
            return base + ["#PeriodPositive", "#CleanWater", "#HygieneForAll"]
        return base

    # ── Quality Score ──────────────────────────────────────────────────────────

    async def calculate_quality_score(
        self, content: str, platform: str, brand_profile: Any = None
    ) -> float:
        """Score content 0–100 using fast Groq model."""
        from app.utils.prompt_builder import build_quality_score_prompt

        model = self.model_router.select_task_model("quality_score")
        prompt = build_quality_score_prompt(content=content, platform=platform)

        try:
            raw, _ = await self._call_with_fallback(
                model=model,
                system_prompt=(
                    "You are a social media content quality analyst. "
                    "Respond ONLY with a JSON object: {\"score\": <0-100>, \"reason\": \"<one sentence>\"}"
                ),
                user_prompt=prompt,
            )
            text = raw.get("content", "")
            match = re.search(r"\{.*?\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group())
                score = float(data.get("score", 70))
                return min(100.0, max(0.0, score))
        except Exception as exc:
            logger.debug("Quality score parse failed", extra={"error": str(exc)})

        return self._heuristic_quality_score(content, platform)

    def _heuristic_quality_score(self, content: str, platform: str) -> float:
        score = 60.0
        words = len(content.split())
        if platform == "twitter" and words <= 50:
            score += 10
        elif platform == "linkedin" and 100 <= words <= 350:
            score += 10
        elif platform == "instagram" and 50 <= words <= 200:
            score += 10
        cta_words = ["follow", "share", "comment", "click", "visit", "dm", "learn more", "link in bio", "save"]
        if any(p in content.lower() for p in cta_words):
            score += 8
        if re.search(r"\d+", content):
            score += 5
        if "#" in content:
            score += 5
        if re.search(r"[\U00010000-\U0010FFFF]", content):
            score += 4
        return min(100.0, score)

    # ── Content Repurposing ────────────────────────────────────────────────────

    async def repurpose_content(
        self,
        original_content: str,
        original_platform: str,
        target_platforms: List[str],
        brand_profile: Any = None,
    ) -> List[Dict[str, Any]]:
        """Repurpose content for multiple platforms concurrently."""
        from app.utils.prompt_builder import build_repurpose_prompt

        bp_dict = self._brand_profile_to_dict(brand_profile)

        async def _single(target: str) -> Dict[str, Any]:
            model = self.model_router.select_task_model("repurpose")
            system = (
                "You are an expert social media content strategist. "
                "Repurpose the given content for the target platform "
                "while preserving the core message and brand voice."
            )
            user = build_repurpose_prompt(
                original_content=original_content,
                original_platform=original_platform,
                target_platform=target,
                brand_profile=bp_dict,
            )
            try:
                raw, used_model = await self._call_with_fallback(
                    model=model, system_prompt=system, user_prompt=user
                )
            except Exception as exc:
                logger.error("Repurpose failed", extra={"platform": target, "error": str(exc)})
                raw = {"content": original_content, "tokens_used": 0}
                used_model = "fallback"

            content = raw.get("content", "").strip()
            return {
                "platform": target,
                "content": content,
                "hashtags": self._extract_hashtags(content),
                "model": used_model,
                "tokens_used": raw.get("tokens_used", 0),
                "quality_score": self._heuristic_quality_score(content, target),
            }

        results = await asyncio.gather(*[_single(p) for p in target_platforms], return_exceptions=True)
        return [r for r in results if isinstance(r, dict)]

    # ── Brand Voice Analysis ───────────────────────────────────────────────────

    async def analyze_brand_voice(self, sample_posts: List[str]) -> Dict[str, Any]:
        """Analyse sample posts to extract brand voice dimensions."""
        from app.utils.prompt_builder import build_voice_analysis_prompt

        model = self.model_router.select_task_model("voice_analysis")
        prompt = build_voice_analysis_prompt(sample_posts)

        try:
            raw, _ = await self._call_with_fallback(
                model=model,
                system_prompt=(
                    "You are a brand voice analyst. Analyse social media posts and extract "
                    "tone dimensions. Respond ONLY with a valid JSON object."
                ),
                user_prompt=prompt,
            )
            text = raw.get("content", "")
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
            logger.warning("Voice analysis failed", extra={"error": str(exc)})

        return {
            "tone_professional": 7, "tone_warm": 7, "tone_inspirational": 6,
            "tone_educational": 7, "tone_urgent": 4,
            "vocabulary_suggestions": [], "avoid_words": [],
            "summary": "Could not analyse voice. Using default tone settings.",
        }

    # ── Utilities ──────────────────────────────────────────────────────────────

    def _extract_hashtags(self, content: str) -> List[str]:
        hashtags = re.findall(r"#\w+", content)
        return list(dict.fromkeys(hashtags))

    def _parse_hashtag_list(self, text: str) -> List[str]:
        hashtags = re.findall(r"#\w+", text)
        if hashtags:
            return list(dict.fromkeys(hashtags))[:15]
        lines = re.split(r"[,\n]", text)
        result = []
        for line in lines:
            word = line.strip().strip("#").strip()
            if word and len(word) > 1 and " " not in word:
                result.append(f"#{word}")
        return result[:15]

    @staticmethod
    def _brand_profile_to_dict(brand_profile: Any) -> Dict[str, Any]:
        if brand_profile is None:
            return {}
        if isinstance(brand_profile, dict):
            return brand_profile
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
