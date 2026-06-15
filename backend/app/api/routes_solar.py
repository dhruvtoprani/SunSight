from fastapi import APIRouter

from app.schemas.solar import SolarEstimateRequest, SolarEstimateResponse
from app.services.pvwatts_service import estimate_solar_production

router = APIRouter(prefix="/solar", tags=["solar"])


@router.post("/pvwatts", response_model=SolarEstimateResponse)
def pvwatts(request: SolarEstimateRequest) -> SolarEstimateResponse:
    return estimate_solar_production(request)

