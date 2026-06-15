from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.geometry import GeoJsonPolygon


LayoutMode = Literal["max_capacity", "conservative", "best_roi"]


class PanelSpec(BaseModel):
    watts: float = 430
    length_m: float = 1.72
    width_m: float = 1.13
    gap_m: float = 0.1


class PanelPlacement(BaseModel):
    panel_id: str
    coordinates: list[list[list[float]]]


class LayoutOptimizationRequest(BaseModel):
    project_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    polygon: GeoJsonPolygon
    exclusion_polygons: list[GeoJsonPolygon] = Field(default_factory=list)
    panel: PanelSpec = Field(default_factory=PanelSpec)
    setback_margin_m: float = 0.9
    layout_mode: LayoutMode = "max_capacity"
    candidate_angles: list[float] = Field(default_factory=lambda: [0, 90])
    annual_demand_kwh: float | None = None


class LayoutOptimizationResponse(BaseModel):
    layout_id: str
    layout_mode: LayoutMode
    panel_count: int
    system_size_kw_dc: float
    gross_area_sq_m: float
    usable_area_sq_m: float
    coverage_ratio: float
    unused_area_sq_m: float
    orientation_degrees: float
    panels: list[PanelPlacement]

