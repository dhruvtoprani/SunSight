from uuid import uuid4

from app.schemas.reports import ReportGenerateRequest, ReportGenerateResponse


def generate_report(request: ReportGenerateRequest) -> ReportGenerateResponse:
    report_id = request.report_id or f"report_{uuid4().hex[:10]}"
    layout = request.layout or {}
    solar = request.solar or {}
    financial = request.financial or {}

    return ReportGenerateResponse(
        report_id=report_id,
        title="SunSight Solar Feasibility Report",
        summary={
            "system_size_kw_dc": layout.get("system_size_kw_dc"),
            "panel_count": layout.get("panel_count"),
            "annual_production_kwh": solar.get("annual_production_kwh"),
            "annual_savings": financial.get("annual_savings"),
            "simple_payback_years": financial.get("simple_payback_years"),
        },
        disclaimer=(
            "This MVP report is a feasibility estimate based on user-selected geometry, "
            "mock geocoding, regional production fallback logic, and simplified financial assumptions."
        ),
    )

