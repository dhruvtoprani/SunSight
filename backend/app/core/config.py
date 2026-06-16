from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SunSight API"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    pvwatts_api_key: str | None = None
    pvwatts_base_url: str = "https://developer.nlr.gov/api/pvwatts/v8.json"
    pvwatts_timeout_seconds: float = 12.0
    mapbox_access_token: str | None = None
    mapbox_search_base_url: str = "https://api.mapbox.com/search/searchbox/v1"
    mapbox_timeout_seconds: float = 8.0
    mapbox_country: str = "US"
    static_dir: str | None = None

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
