from fastapi import APIRouter

from app.schemas.financial import FinancialEstimateRequest, FinancialEstimateResponse
from app.services.financial_service import estimate_financials

router = APIRouter(prefix="/financial", tags=["financial"])


@router.post("/estimate", response_model=FinancialEstimateResponse)
def estimate(request: FinancialEstimateRequest) -> FinancialEstimateResponse:
    return estimate_financials(request)

