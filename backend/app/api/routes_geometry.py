from fastapi import APIRouter

from app.schemas.geometry import AreaRequest, AreaResponse
from app.schemas.layout import LayoutOptimizationRequest, LayoutOptimizationResponse
from app.services.geometry_service import calculate_area
from app.services.layout_optimizer import optimize_layout

router = APIRouter(prefix="/geometry", tags=["geometry"])


@router.post("/area", response_model=AreaResponse)
def area(request: AreaRequest) -> AreaResponse:
    return calculate_area(request)


@router.post("/optimize-layout", response_model=LayoutOptimizationResponse)
def optimize(request: LayoutOptimizationRequest) -> LayoutOptimizationResponse:
    return optimize_layout(request)

