import unittest
from unittest.mock import Mock

import requests

from app.schemas.solar import SolarEstimateRequest
from app.services.pvwatts_service import estimate_solar_production


class PVWattsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.request = SolarEstimateRequest(
            latitude=40.7484,
            longitude=-73.9857,
            system_capacity_kw=18.06,
            tilt=20,
            azimuth=180,
            array_type=1,
            module_type=0,
            losses=14,
        )

    def test_parses_live_pvwatts_response(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "errors": [],
            "warnings": ["Example warning"],
            "station_info": {
                "distance": 1250,
                "weather_data_source": "NSRDB test dataset",
            },
            "outputs": {
                "ac_monthly": [100, 110, 120, 130, 140, 150, 160, 150, 140, 130, 110, 100],
                "ac_annual": 1540,
                "capacity_factor": 18.5,
                "solrad_monthly": [3.1, 3.4, 4.0, 4.6, 5.1, 5.5, 5.7, 5.3, 4.8, 4.1, 3.4, 3.0],
                "solrad_annual": 4.34,
            },
        }
        http_get = Mock(return_value=response)

        result = estimate_solar_production(
            self.request,
            api_key="test-key",
            http_get=http_get,
        )

        self.assertEqual(result.model_source, "pvwatts_v8")
        self.assertEqual(result.annual_production_kwh, 1540.0)
        self.assertEqual(result.capacity_factor, 0.185)
        self.assertEqual(result.weather_data_source, "NSRDB test dataset")
        self.assertEqual(result.station_distance_m, 1250)
        self.assertEqual(result.warnings, ["Example warning"])
        self.assertIsNone(result.fallback_reason)

        call_args, call_kwargs = http_get.call_args
        self.assertEqual(
            call_args[0],
            "https://developer.nlr.gov/api/pvwatts/v8.json",
        )
        self.assertEqual(call_kwargs["headers"], {"X-Api-Key": "test-key"})
        self.assertNotIn("api_key", call_kwargs["params"])
        self.assertEqual(call_kwargs["params"]["timeframe"], "monthly")

    def test_missing_api_key_uses_fallback(self) -> None:
        result = estimate_solar_production(self.request, api_key="")

        self.assertEqual(result.model_source, "regional_fallback")
        self.assertEqual(result.fallback_reason, "missing_api_key")
        self.assertEqual(len(result.monthly_production_kwh), 12)
        self.assertGreater(result.annual_production_kwh, 0)

    def test_request_error_uses_fallback(self) -> None:
        http_get = Mock(side_effect=requests.Timeout("timed out"))

        with self.assertLogs("app.services.pvwatts_service", level="WARNING"):
            result = estimate_solar_production(
                self.request,
                api_key="test-key",
                http_get=http_get,
            )

        self.assertEqual(result.model_source, "regional_fallback")
        self.assertEqual(result.fallback_reason, "pvwatts_error:Timeout")

    def test_zero_capacity_skips_pvwatts(self) -> None:
        zero_request = self.request.model_copy(update={"system_capacity_kw": 0})
        http_get = Mock()

        result = estimate_solar_production(
            zero_request,
            api_key="test-key",
            http_get=http_get,
        )

        self.assertEqual(result.annual_production_kwh, 0)
        self.assertEqual(result.fallback_reason, "system_capacity_below_api_minimum")
        http_get.assert_not_called()

    def test_invalid_monthly_output_uses_fallback(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "errors": [],
            "outputs": {
                "ac_monthly": [100, 110],
                "ac_annual": 210,
                "capacity_factor": 10,
            },
        }

        with self.assertLogs("app.services.pvwatts_service", level="WARNING"):
            result = estimate_solar_production(
                self.request,
                api_key="test-key",
                http_get=Mock(return_value=response),
            )

        self.assertEqual(result.model_source, "regional_fallback")
        self.assertEqual(result.fallback_reason, "pvwatts_error:ValueError")


if __name__ == "__main__":
    unittest.main()
