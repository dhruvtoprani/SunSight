from typing import Literal

from pydantic import BaseModel, Field


class GeoJsonPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]


class AreaRequest(BaseModel):
    polygon: GeoJsonPolygon
    exclusion_polygons: list[GeoJsonPolygon] = Field(default_factory=list)
    setback_margin_m: float = 0.9


class AreaResponse(BaseModel):
    gross_area_sq_m: float
    gross_area_sq_ft: float
    usable_area_sq_m: float
    usable_area_sq_ft: float
    exclusion_area_sq_m: float
    setback_area_loss_pct: float

