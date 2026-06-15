from pydantic import BaseModel, Field


class SolarEstimateRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    system_capacity_kw: float = Field(ge=0, le=500000)
    tilt: float = Field(default=20, ge=0, le=90)
    azimuth: float = Field(default=180, ge=0, lt=360)
    array_type: int = Field(default=1, ge=0, le=4)
    module_type: int = Field(default=0, ge=0, le=2)
    losses: float = Field(default=14, ge=-5, le=99)


class SolarEstimateResponse(BaseModel):
    monthly_production_kwh: list[float]
    annual_production_kwh: float
    specific_yield_kwh_per_kw: float
    capacity_factor: float
    model_source: str
    solar_radiation_monthly_kwh_per_m2_day: list[float] | None = None
    solar_radiation_annual_kwh_per_m2_day: float | None = None
    weather_data_source: str | None = None
    station_distance_m: int | None = None
    warnings: list[str] = Field(default_factory=list)
    fallback_reason: str | None = None
