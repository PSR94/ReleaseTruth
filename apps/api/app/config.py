from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RELEASETRUTH_", case_sensitive=False)

    database_url: str = "sqlite+pysqlite:///./.releasetruth/releasetruth.db"
    cors_origins: str = "http://localhost:3002,http://127.0.0.1:3002"
    github_webhook_secret: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache

def get_settings() -> Settings:
    return Settings()
