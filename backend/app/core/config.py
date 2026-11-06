from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "Indie Tutor API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes", "dev", "debug")
        return bool(v)

    # Security
    SECRET_KEY: str = "indie-tutor-secret-key"
    ALGORITHM: str = "HS256"

    # PostgreSQL + pgvector Database Configuration
    POSTGRES_URL: str = ""
    DATABASE_URL: str = ""

    # Supabase Configuration
    SUPABASE_URL: str = "https://podzeuinowjbsvxtpovc.supabase.co"
    SUPABASE_KEY: str = "sb_publishable_KjlCDt5LADGg95HIkgBniA_vzAlXD2v"
    NEXT_PUBLIC_SUPABASE_URL: str = "https://podzeuinowjbsvxtpovc.supabase.co"
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: str = "sb_publishable_KjlCDt5LADGg95HIkgBniA_vzAlXD2v"

    # Embeddings Configuration
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT: str = "text-embedding-3-small"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    PGVECTOR_DIMENSION: int = 1536

    # Model Configuration (gpt-6-sol via Azure OpenAI)
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = "https://sreehari-4075-resource.services.ai.azure.com"
    AZURE_OPENAI_DEPLOYMENT_NAME: str = "gpt-6-sol"
    AZURE_OPENAI_API_VERSION: str = "2024-06-01"

    # Standard OpenAI Configuration (if using standard OpenAI)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-6-sol"

    # AWS S3 Cloud Storage
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET_NAME: str = "deeptutor-documents-storage"
    AWS_REGION: str = "eu-north-1"

    # File uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 50


@lru_cache
def get_settings() -> Settings:
    return Settings()
