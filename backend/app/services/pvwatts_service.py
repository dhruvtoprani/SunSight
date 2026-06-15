from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

import requests

from app.core.config import get_settings
from app.schemas.solar import SolarEstimateRequest, SolarEstimateResponse


MONTHLY_PROFILE = [0.055, 0.065, 0.085, 0.095, 0.105, 0.108, 0.11, 0.102, 0.088, 0.075, 0.06, 0.052]
PVWATTS_MIN_SYSTEM_CAPACITY_KW = 0.05

logger = logging.getLogger(__name__)

HttpGet = Callable[..., Any]


def _specific_yield(latitude: float) -> float:
    abs_lat = abs(latitude)
    if abs_lat < 30:
        return 1550
    if abs_lat < 38:
        return 1450
    if abs_lat < 45:
        return 1350
    return 1225


def _fallback_estimate(request: SolarEstimateRequest, reason: str) -> SolarEstimateResponse:
    specific_yield = _specific_yield(request.latitude)
    tilt_adjustment = max(0.86, 1 - abs(request.tilt - min(abs(request.latitude), 30)) * 0.003)
    loss_adjustment = max(0.5, 1 - request.losses / 100)
    normalized_loss_adjustment = loss_adjustment / 0.86

    annual = request.system_capacity_kw * specific_yield * tilt_adjustment * normalized_loss_adjustment
    monthly = [round(annual * weight, 1) for weight in MONTHLY_PROFILE]
    total_monthly = sum(monthly)
    if total_monthly:
        scale = annual / total_monthly
        monthly = [round(value * scale, 1) for value in monthly]

    capacity_factor = annual / (request.system_capacity_kw * 8760) if request.system_capacity_kw else 0

    return SolarEstimateResponse(
        monthly_production_kwh=monthly,
        annual_production_kwh=round(annual, 1),
        specific_yield_kwh_per_kw=round(annual / request.system_capacity_kw, 1) if request.system_capacity_kw else 0,
        capacity_factor=round(capacity_factor, 3),
        model_source="regional_fallback",
        warnings=["PVWatts was unavailable; a latitude-based specific-yield estimate was used."],
        fallback_reason=reason,
    )


def _parse_pvwatts_response(
    request: SolarEstimateRequest,
    payload: dict[str, Any],
) -> SolarEstimateResponse:
    errors = payload.get("errors") or []
    if errors:
        raise ValueError("; ".join(str(error) for error in errors))

    outputs = payload["outputs"]
    monthly = [float(value) for value in outputs["ac_monthly"]]
    if len(monthly) != 12:
        raise ValueError("PVWatts returned an invalid monthly production array.")

    annual = float(outputs["ac_annual"])
    capacity_factor_pct = float(outputs["capacity_factor"])
    solrad_monthly = outputs.get("solrad_monthly")
    station_info = payload.get("station_info") or {}

    return SolarEstimateResponse(
        monthly_production_kwh=[round(value, 1) for value in monthly],
        annual_production_kwh=round(annual, 1),
        specific_yield_kwh_per_kw=round(annual / request.system_capacity_kw, 1),
        capacity_factor=round(capacity_factor_pct / 100, 3),
        model_source="pvwatts_v8",
        solar_radiation_monthly_kwh_per_m2_day=(
            [round(float(value), 3) for value in solrad_monthly]
            if solrad_monthly is not None
            else None
        ),
        solar_radiation_annual_kwh_per_m2_day=(
            round(float(outputs["solrad_annual"]), 3)
            if outputs.get("solrad_annual") is not None
            else None
        ),
        weather_data_source=station_info.get("weather_data_source"),
        station_distance_m=(
            int(station_info["distance"])
            if station_info.get("distance") is not None
            else None
        ),
        warnings=[str(warning) for warning in payload.get("warnings") or []],
    )


def estimate_solar_production(
    request: SolarEstimateRequest,
    *,
    api_key: str | None = None,
    http_get: HttpGet = requests.get,
) -> SolarEstimateResponse:
    settings = get_settings()
    resolved_api_key = api_key if api_key is not None else settings.pvwatts_api_key

    if request.system_capacity_kw < PVWATTS_MIN_SYSTEM_CAPACITY_KW:
        return _fallback_estimate(request, "system_capacity_below_api_minimum")

    if not resolved_api_key:
        return _fallback_estimate(request, "missing_api_key")

    params = {
        "system_capacity": request.system_capacity_kw,
        "module_type": request.module_type,
        "losses": request.losses,
        "array_type": request.array_type,
        "tilt": request.tilt,
        "azimuth": request.azimuth,
        "lat": request.latitude,
        "lon": request.longitude,
        "dataset": "nsrdb",
        "timeframe": "monthly",
        "radius": 0,
    }

    try:
        response = http_get(
            settings.pvwatts_base_url,
            params=params,
            headers={"X-Api-Key": resolved_api_key},
            timeout=settings.pvwatts_timeout_seconds,
        )
        response.raise_for_status()
        return _parse_pvwatts_response(request, response.json())
    except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
        logger.warning("PVWatts request failed; using fallback estimate: %s", exc)
        return _fallback_estimate(request, f"pvwatts_error:{type(exc).__name__}")
