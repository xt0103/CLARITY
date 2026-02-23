from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str
    JWT_SECRET: str
    JWT_EXPIRES_IN: int = 3600
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # OpenAI for AI assistant
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"


settings = Settings()

