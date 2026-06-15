from pydantic import BaseModel


class FinancialEstimateRequest(BaseModel):
    system_size_kw_dc: float
    annual_production_kwh: float
    annual_demand_kwh: float | None = None
    monthly_bill: float | None = 450.0
    electricity_rate_per_kwh: float = 0.18
    install_cost_per_watt: float = 2.8
    incentive_pct: float = 0.3
    export_rate_per_kwh: float | None = None
    grid_emissions_factor_kg_per_kwh: float = 0.386


class FinancialEstimateResponse(BaseModel):
    annual_demand_kwh: float
    gross_install_cost: float
    net_install_cost: float
    annual_savings: float
    monthly_savings_estimate: float
    simple_payback_years: float | None
    demand_offset_pct: float
    twenty_five_year_savings: float
    co2_avoided_kg_per_year: float
    co2_avoided_tons_per_year: float

