import unittest

from app.schemas.financial import FinancialEstimateRequest
from app.services.financial_service import estimate_financials


class FinancialServiceTests(unittest.TestCase):
    def test_exported_energy_uses_discounted_rate(self) -> None:
        request = FinancialEstimateRequest(
            system_size_kw_dc=10,
            annual_production_kwh=12000,
            annual_demand_kwh=10000,
            electricity_rate_per_kwh=0.20,
            install_cost_per_watt=2.5,
            incentive_pct=0.30,
        )

        result = estimate_financials(request)

        self.assertEqual(result.annual_savings, 2200.0)
        self.assertEqual(result.gross_install_cost, 25000.0)
        self.assertEqual(result.net_install_cost, 17500.0)
        self.assertEqual(result.demand_offset_pct, 120.0)
        self.assertEqual(result.simple_payback_years, 7.95)

    def test_monthly_bill_can_derive_annual_demand(self) -> None:
        request = FinancialEstimateRequest(
            system_size_kw_dc=5,
            annual_production_kwh=6000,
            annual_demand_kwh=None,
            monthly_bill=180,
            electricity_rate_per_kwh=0.18,
        )

        result = estimate_financials(request)

        self.assertEqual(result.annual_demand_kwh, 12000.0)
        self.assertEqual(result.annual_savings, 1080.0)


if __name__ == "__main__":
    unittest.main()

