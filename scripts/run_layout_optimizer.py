#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(BACKEND))

from app.schemas.geometry import GeoJsonPolygon
from app.schemas.layout import LayoutOptimizationRequest
from app.services.layout_optimizer import optimize_layout


def main() -> None:
    parser = argparse.ArgumentParser(description="Run SunSight layout optimizer on a GeoJSON polygon.")
    parser.add_argument("--sample", required=True, help="Path to a GeoJSON Polygon file.")
    parser.add_argument("--full", action="store_true", help="Print full panel coordinates.")
    args = parser.parse_args()

    polygon_data = json.loads(Path(args.sample).read_text())
    request = LayoutOptimizationRequest(
        project_id="proj_demo",
        latitude=40.7484,
        longitude=-73.9857,
        polygon=GeoJsonPolygon(**polygon_data),
        layout_mode="max_capacity",
        candidate_angles=[0, 90],
    )
    result = optimize_layout(request)
    if args.full:
        print(result.model_dump_json(indent=2))
    else:
        print(
            json.dumps(
                {
                    "layout_id": result.layout_id,
                    "layout_mode": result.layout_mode,
                    "panel_count": result.panel_count,
                    "system_size_kw_dc": result.system_size_kw_dc,
                    "gross_area_sq_m": result.gross_area_sq_m,
                    "usable_area_sq_m": result.usable_area_sq_m,
                    "coverage_ratio": result.coverage_ratio,
                    "orientation_degrees": result.orientation_degrees,
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
