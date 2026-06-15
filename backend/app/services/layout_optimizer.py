from __future__ import annotations

import math
from uuid import uuid4

from app.schemas.geometry import AreaRequest
from app.schemas.layout import LayoutOptimizationRequest, LayoutOptimizationResponse, PanelPlacement
from app.services.geometry_service import (
    close_ring,
    frame_for_ring,
    point_in_polygon,
    polygon_area_sq_m,
    project_ring,
    ring_from_polygon,
    unproject_ring,
)


def _rotated_rectangle(cx: float, cy: float, length: float, width: float, angle_deg: float) -> list[tuple[float, float]]:
    angle = math.radians(angle_deg)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    corners = [
        (-length / 2, -width / 2),
        (length / 2, -width / 2),
        (length / 2, width / 2),
        (-length / 2, width / 2),
    ]
    return [
        (cx + dx * cos_a - dy * sin_a, cy + dx * sin_a + dy * cos_a)
        for dx, dy in corners
    ]


def _rect_intersects_exclusions(rect: list[tuple[float, float]], exclusions: list[list[tuple[float, float]]]) -> bool:
    return any(
        any(point_in_polygon(corner, exclusion) for corner in rect)
        or any(point_in_polygon(point, rect) for point in exclusion)
        for exclusion in exclusions
    )


def _generate_for_angle(
    polygon: list[tuple[float, float]],
    exclusions: list[list[tuple[float, float]]],
    length: float,
    width: float,
    gap: float,
    angle: float,
    setback: float,
) -> list[list[tuple[float, float]]]:
    min_x = min(point[0] for point in polygon) + setback
    max_x = max(point[0] for point in polygon) - setback
    min_y = min(point[1] for point in polygon) + setback
    max_y = max(point[1] for point in polygon) - setback
    if min_x >= max_x or min_y >= max_y:
        return []

    step_x = width + gap if angle % 180 == 90 else length + gap
    step_y = length + gap if angle % 180 == 90 else width + gap
    panel_length = width if angle % 180 == 90 else length
    panel_width = length if angle % 180 == 90 else width

    panels: list[list[tuple[float, float]]] = []
    y = min_y + panel_width / 2
    while y <= max_y - panel_width / 2 + 1e-9:
        x = min_x + panel_length / 2
        while x <= max_x - panel_length / 2 + 1e-9:
            rect = _rotated_rectangle(x, y, panel_length, panel_width, 0)
            if all(point_in_polygon(corner, polygon) for corner in rect) and not _rect_intersects_exclusions(rect, exclusions):
                panels.append(rect)
            x += step_x
        y += step_y
    return panels


def optimize_layout(request: LayoutOptimizationRequest) -> LayoutOptimizationResponse:
    area = AreaRequest(
        polygon=request.polygon,
        exclusion_polygons=request.exclusion_polygons,
        setback_margin_m=request.setback_margin_m,
    )
    from app.services.geometry_service import calculate_area

    area_response = calculate_area(area)
    ring = ring_from_polygon(request.polygon)
    frame = frame_for_ring(ring)
    projected = project_ring(ring, frame)
    projected_exclusions = [
        project_ring(ring_from_polygon(exclusion), frame)
        for exclusion in request.exclusion_polygons
    ]

    setback = request.setback_margin_m
    gap = request.panel.gap_m
    if request.layout_mode == "conservative":
        setback += 0.8
        gap += 0.08

    best_angle = request.candidate_angles[0] if request.candidate_angles else 0
    best_panels: list[list[tuple[float, float]]] = []
    for angle in request.candidate_angles or [0]:
        panels = _generate_for_angle(
            projected,
            projected_exclusions,
            request.panel.length_m,
            request.panel.width_m,
            gap,
            angle,
            setback,
        )
        if len(panels) > len(best_panels):
            best_panels = panels
            best_angle = angle

    if request.layout_mode == "best_roi" and request.annual_demand_kwh:
        target_kw = request.annual_demand_kwh / 1350
        target_panels = max(1, math.ceil(target_kw * 1000 / request.panel.watts))
        best_panels = best_panels[: min(len(best_panels), math.ceil(target_panels * 1.05))]

    panel_area = request.panel.length_m * request.panel.width_m
    panel_count = len(best_panels)
    system_size = panel_count * request.panel.watts / 1000
    usable_area = area_response.usable_area_sq_m

    placements: list[PanelPlacement] = []
    for index, panel in enumerate(best_panels, start=1):
        lonlat_ring = unproject_ring(close_ring(panel), frame)
        placements.append(
            PanelPlacement(
                panel_id=f"p_{index:03d}",
                coordinates=[[list(point) for point in lonlat_ring]],
            )
        )

    coverage_ratio = (panel_count * panel_area / usable_area) if usable_area else 0
    unused_area = max(usable_area - panel_count * panel_area, 0)

    return LayoutOptimizationResponse(
        layout_id=f"layout_{uuid4().hex[:10]}",
        layout_mode=request.layout_mode,
        panel_count=panel_count,
        system_size_kw_dc=round(system_size, 2),
        gross_area_sq_m=area_response.gross_area_sq_m,
        usable_area_sq_m=usable_area,
        coverage_ratio=round(coverage_ratio, 3),
        unused_area_sq_m=round(unused_area, 2),
        orientation_degrees=best_angle,
        panels=placements,
    )

