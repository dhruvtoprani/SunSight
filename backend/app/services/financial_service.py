from app.schemas.financial import FinancialEstimateRequest, FinancialEstimateResponse


def _annual_demand(request: FinancialEstimateRequest) -> float:
    if request.annual_demand_kwh and request.annual_demand_kwh > 0:
        return request.annual_demand_kwh
    if request.monthly_bill and request.electricity_rate_per_kwh > 0:
        return request.monthly_bill / request.electricity_rate_per_kwh * 12
    return request.annual_production_kwh


def estimate_financials(request: FinancialEstimateRequest) -> FinancialEstimateResponse:
    demand = _annual_demand(request)
    export_rate = request.export_rate_per_kwh
    if export_rate is None:
        export_rate = request.electricity_rate_per_kwh * 0.5

    self_consumed_kwh = min(request.annual_production_kwh, demand)
    exported_kwh = max(request.annual_production_kwh - demand, 0)
    annual_savings = (
        self_consumed_kwh * request.electricity_rate_per_kwh
        + exported_kwh * export_rate
    )

    gross_cost = request.system_size_kw_dc * 1000 * request.install_cost_per_watt
    net_cost = gross_cost * (1 - request.incentive_pct)
    payback = net_cost / annual_savings if annual_savings > 0 else None
    offset = request.annual_production_kwh / demand * 100 if demand else 0
    co2 = request.annual_production_kwh * request.grid_emissions_factor_kg_per_kwh

    return FinancialEstimateResponse(
        annual_demand_kwh=round(demand, 1),
        gross_install_cost=round(gross_cost, 2),
        net_install_cost=round(net_cost, 2),
        annual_savings=round(annual_savings, 2),
        monthly_savings_estimate=round(annual_savings / 12, 2),
        simple_payback_years=round(payback, 2) if payback is not None else None,
        demand_offset_pct=round(offset, 2),
        twenty_five_year_savings=round(annual_savings * 25 - net_cost, 2),
        co2_avoided_kg_per_year=round(co2, 1),
        co2_avoided_tons_per_year=round(co2 / 1000, 2),
    )

