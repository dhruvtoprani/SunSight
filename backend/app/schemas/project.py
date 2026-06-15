from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ProjectMode = Literal["residential", "commercial", "open_land"]


class GeocodeRequest(BaseModel):
    address: str = Field(..., min_length=2)


class GeocodeResponse(BaseModel):
    address: str
    latitude: float
    longitude: float
    confidence: str = "mock"


class GeocodeSuggestRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=256)
    session_token: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    limit: int = Field(default=5, ge=1, le=10)


class GeocodeSuggestion(BaseModel):
    suggestion_id: str
    name: str
    place_formatted: str | None = None
    full_address: str
    feature_type: str
    source: str = "demo"


class GeocodeSuggestResponse(BaseModel):
    suggestions: list[GeocodeSuggestion]
    provider: str
    attribution: str | None = None


class GeocodeRetrieveRequest(BaseModel):
    suggestion_id: str = Field(..., min_length=2)
    session_token: str | None = None


class ProjectCreate(BaseModel):
    name: str = "SunSight Demo Project"
    address: str
    latitude: float
    longitude: float
    project_mode: ProjectMode = "commercial"
    electricity_rate_per_kwh: float = 0.18
    monthly_bill: float | None = 450.0
    annual_demand_kwh: float | None = None
    install_cost_per_watt: float = 2.8
    incentive_pct: float = 0.3


class ProjectRecord(ProjectCreate):
    project_id: str
    created_at: datetime
