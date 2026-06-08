from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/healthyfrog"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # AI / nutrition recognition. None means the feature is disabled and the
    # API will respond with HTTP 503 instead of crashing the application.
    AI_MODEL: str = "gemini-2.0-flash"
    AI_VISION_MODEL: Optional[str] = None  # falls back to AI_MODEL when None
    AI_AUDIO_MODEL: Optional[str] = None  # falls back to AI_MODEL when None

    # Per-stage Gemini keys (multi-agent pipeline, same scheme as the
    # ``health_v2`` prototype). Each agent stage may use its own key —
    # convenient when quotas are split across projects/keys. ``AI_API_KEY``
    # is a single-key fallback used by every stage when its dedicated key
    # is empty (and by audio transcription, which is not part of the
    # multi-agent pipeline).
    AI_API_KEY: Optional[str] = None
    GEMINI_API_CLASSIFY_KEY: Optional[str] = None
    GEMINI_API_READ_LABEL_KEY: Optional[str] = None
    GEMINI_API_IDENTIFY_FOOD_KEY: Optional[str] = None
    GEMINI_API_ESTIMATE_WEIGHT_KEY: Optional[str] = None
    GEMINI_API_ESTIMATE_KBJU_KEY: Optional[str] = None

    # OpenRouter (OpenAI-compatible), same approach as HealthyFrog 5.0 / services/ai_client.py.
    # When OPENROUTER_API_KEY is set, AIClient routes text / vision / transcription there
    # instead of Gemini. Use provider-prefixed model ids, e.g. openai/gpt-4o-mini.
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_SITE_URL: Optional[str] = None
    OPENROUTER_APP_TITLE: str = "Healthy Frog API"
    OPENROUTER_TRANSCRIPTION_MODEL: str = "whisper-1"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
