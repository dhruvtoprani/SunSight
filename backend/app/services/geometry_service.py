from __future__ import annotations

import math
from dataclasses import dataclass

from app.schemas.geometry import AreaRequest, AreaResponse, GeoJsonPolygon

SQFT_PER_SQM = 10.7639104167
EARTH_METERS_PER_DEGREE = 111_320


@dataclass(frozen=True)
class LocalFrame:
    lat0: float
    lon0: float


Point = tuple[float, float]


def ring_from_polygon(polygon: GeoJsonPolygon) -> list[Point]:
    ring = [(float(lon), float(lat)) for lon, lat in polygon.coordinates[0]]
    if ring and ring[0] == ring[-1]:
        return ring[:-1]
    return ring


def close_ring(ring: list[Point]) -> list[Point]:
    if not ring:
        return ring
    return ring if ring[0] == ring[-1] else [*ring, ring[0]]


def frame_for_ring(ring: list[Point]) -> LocalFrame:
    lon = sum(point[0] for point in ring) / max(len(ring), 1)
    lat = sum(point[1] for point in ring) / max(len(ring), 1)
    return LocalFrame(lat0=lat, lon0=lon)


def lonlat_to_xy(lon: float, lat: float, frame: LocalFrame) -> Point:
    x = (lon - frame.lon0) * EARTH_METERS_PER_DEGREE * math.cos(math.radians(frame.lat0))
    y = (lat - frame.lat0) * EARTH_METERS_PER_DEGREE
    return x, y


def xy_to_lonlat(x: float, y: float, frame: LocalFrame) -> Point:
    lon = x / (EARTH_METERS_PER_DEGREE * math.cos(math.radians(frame.lat0))) + frame.lon0
    lat = y / EARTH_METERS_PER_DEGREE + frame.lat0
    return lon, lat


def project_ring(ring: list[Point], frame: LocalFrame) -> list[Point]:
    return [lonlat_to_xy(lon, lat, frame) for lon, lat in ring]


def unproject_ring(ring: list[Point], frame: LocalFrame) -> list[Point]:
    return [xy_to_lonlat(x, y, frame) for x, y in ring]


def polygon_area_sq_m(points: list[Point]) -> float:
    if len(points) < 3:
        return 0.0
    area = 0.0
    closed = close_ring(points)
    for (x1, y1), (x2, y2) in zip(closed, closed[1:]):
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


def polygon_perimeter_m(points: list[Point]) -> float:
    if len(points) < 2:
        return 0.0
    perimeter = 0.0
    closed = close_ring(points)
    for (x1, y1), (x2, y2) in zip(closed, closed[1:]):
        perimeter += math.hypot(x2 - x1, y2 - y1)
    return perimeter


def point_in_polygon(point: Point, polygon: list[Point]) -> bool:
    x, y = point
    inside = False
    closed = close_ring(polygon)
    for (x1, y1), (x2, y2) in zip(closed, closed[1:]):
        intersects = (y1 > y) != (y2 > y)
        if intersects:
            x_cross = (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-9) + x1
            if x < x_cross:
                inside = not inside
    return inside


def polygon_to_geojson(points: list[Point]) -> dict:
    return {"type": "Polygon", "coordinates": [close_ring(points)]}


def calculate_area(request: AreaRequest) -> AreaResponse:
    ring = ring_from_polygon(request.polygon)
    frame = frame_for_ring(ring)
    projected = project_ring(ring, frame)

    gross_area = polygon_area_sq_m(projected)
    perimeter = polygon_perimeter_m(projected)

    exclusion_area = 0.0
    for exclusion in request.exclusion_polygons:
        exclusion_ring = project_ring(ring_from_polygon(exclusion), frame)
        exclusion_area += polygon_area_sq_m(exclusion_ring)

    # MVP setback approximation: area removed is perimeter * margin. The layout
    # optimizer applies a stricter rectangular inset for actual panel placement.
    setback_loss = min(gross_area, perimeter * max(request.setback_margin_m, 0))
    usable_area = max(gross_area - exclusion_area - setback_loss, 0)
    setback_area_loss_pct = (setback_loss / gross_area * 100) if gross_area else 0

    return AreaResponse(
        gross_area_sq_m=round(gross_area, 2),
        gross_area_sq_ft=round(gross_area * SQFT_PER_SQM, 2),
        usable_area_sq_m=round(usable_area, 2),
        usable_area_sq_ft=round(usable_area * SQFT_PER_SQM, 2),
        exclusion_area_sq_m=round(exclusion_area, 2),
        setback_area_loss_pct=round(setback_area_loss_pct, 2),
    )

