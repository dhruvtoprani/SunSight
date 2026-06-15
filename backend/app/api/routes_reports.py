from fastapi import APIRouter

from app.schemas.reports import ReportGenerateRequest, ReportGenerateResponse
from app.services.report_service import generate_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/generate", response_model=ReportGenerateResponse)
def create_report(request: ReportGenerateRequest) -> ReportGenerateResponse:
    return generate_report(request)


@router.get("/{report_id}", response_model=ReportGenerateResponse)
def get_report(report_id: str) -> ReportGenerateResponse:
    return generate_report(ReportGenerateRequest(report_id=report_id))

