from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

import requests

from app.core.config import get_settings
from app.schemas.project import (
    GeocodeResponse,
    GeocodeRetrieveRequest,
    GeocodeSuggestRequest,
    GeocodeSuggestion,
    GeocodeSuggestResponse,
)


logger = logging.getLogger(__name__)

HttpGet = Callable[..., Any]

_DEMO_PLACES = [
    {
        "id": "demo:empire-state-building",
        "aliases": ["350 fifth avenue, new york, ny", "empire state building", "350 fifth"],
        "name": "Empire State Building",
        "place_formatted": "350 Fifth Avenue, New York, NY 10118",
        "latitude": 40.7484,
        "longitude": -73.9857,
        "feature_type": "poi",
    },
    {
        "id": "demo:tesla-fremont-factory",
        "aliases": ["tesla fremont factory", "tesla factory", "fremont factory"],
        "name": "Tesla Fremont Factory",
        "place_formatted": "45500 Fremont Boulevard, Fremont, CA",
        "latitude": 37.4947,
        "longitude": -121.9440,
        "feature_type": "poi",
    },
    {
        "id": "demo:apple-infinite-loop",
        "aliases": ["1 infinite loop, cupertino, ca", "apple infinite loop", "infinite loop"],
        "name": "Apple Infinite Loop",
        "place_formatted": "1 Infinite Loop, Cupertino, CA",
        "latitude": 37.3318,
        "longitude": -122.0312,
        "feature_type": "address",
    },
    {
        "id": "demo:googleplex",
        "aliases": ["1600 amphitheatre parkway, mountain view, ca", "googleplex", "google headquarters"],
        "name": "Googleplex",
        "place_formatted": "1600 Amphitheatre Parkway, Mountain View, CA",
        "latitude": 37.4220,
        "longitude": -122.0841,
        "feature_type": "poi",
    },
    {
        "id": "demo:mit",
        "aliases": ["mit", "massachusetts institute of technology"],
        "name": "MIT",
        "place_formatted": "77 Massachusetts Avenue, Cambridge, MA",
        "latitude": 42.3601,
        "longitude": -71.0942,
        "feature_type": "poi",
    },
    {
        "id": "demo:stanford",
        "aliases": ["stanford", "stanford university"],
        "name": "Stanford University",
        "place_formatted": "450 Jane Stanford Way, Stanford, CA",
        "latitude": 37.4275,
        "longitude": -122.1697,
        "feature_type": "poi",
    },
    {
        "id": "demo:uc-berkeley",
        "aliases": ["uc berkeley", "university of california berkeley", "berkeley campus"],
        "name": "UC Berkeley",
        "place_formatted": "Berkeley, CA",
        "latitude": 37.8719,
        "longitude": -122.2585,
        "feature_type": "poi",
    },
]

_KNOWN_ADDRESSES: dict[str, tuple[float, float]] = {
    alias: (place["latitude"], place["longitude"])
    for place in _DEMO_PLACES
    for alias in place["aliases"]
}


def _full_address(name: str, place_formatted: str | None) -> str:
    return f"{name}, {place_formatted}" if place_formatted else name


def _demo_suggestion(place: dict[str, Any]) -> GeocodeSuggestion:
    place_formatted = str(place["place_formatted"])
    name = str(place["name"])
    return GeocodeSuggestion(
        suggestion_id=str(place["id"]),
        name=name,
        place_formatted=place_formatted,
        full_address=_full_address(name, place_formatted),
        feature_type=str(place["feature_type"]),
        source="demo",
    )


def _demo_response(place: dict[str, Any]) -> GeocodeResponse:
    return GeocodeResponse(
        address=_full_address(str(place["name"]), str(place["place_formatted"])),
        latitude=round(float(place["latitude"]), 6),
        longitude=round(float(place["longitude"]), 6),
        confidence="known_demo",
    )


def _fallback_suggestions(query: str, limit: int) -> list[GeocodeSuggestion]:
    normalized = query.strip().lower()
    if not normalized:
        return []

    matches = []
    for place in _DEMO_PLACES:
        haystack = " ".join([str(place["name"]), str(place["place_formatted"]), *place["aliases"]]).lower()
        if normalized in haystack or all(part in haystack for part in normalized.split()):
            matches.append(_demo_suggestion(place))

    return matches[:limit]


def _demo_place_by_id(suggestion_id: str) -> dict[str, Any] | None:
    return next((place for place in _DEMO_PLACES if place["id"] == suggestion_id), None)


def _mapbox_suggestion(raw: dict[str, Any]) -> GeocodeSuggestion:
    name = str(raw.get("name") or raw.get("name_preferred") or "Unnamed location")
    place_formatted = raw.get("place_formatted")
    if not place_formatted and raw.get("address"):
        place_formatted = str(raw["address"])
    full_address = str(raw.get("full_address") or _full_address(name, place_formatted))
    return GeocodeSuggestion(
        suggestion_id=str(raw["mapbox_id"]),
        name=name,
        place_formatted=str(place_formatted) if place_formatted else None,
        full_address=full_address,
        feature_type=str(raw.get("feature_type") or "place"),
        source="mapbox",
    )


def _parse_mapbox_feature(payload: dict[str, Any]) -> GeocodeResponse:
    features = payload.get("features") or []
    if not features:
        raise ValueError("Mapbox retrieve returned no features.")

    feature = features[0]
    geometry = feature.get("geometry") or {}
    coordinates = geometry.get("coordinates") or []
    if len(coordinates) < 2:
        raise ValueError("Mapbox retrieve returned no coordinates.")

    properties = feature.get("properties") or {}
    name = str(properties.get("name") or "Selected location")
    place_formatted = properties.get("place_formatted")
    address = str(properties.get("full_address") or _full_address(name, place_formatted))

    return GeocodeResponse(
        address=address,
        latitude=round(float(coordinates[1]), 6),
        longitude=round(float(coordinates[0]), 6),
        confidence="mapbox_searchbox",
    )


def geocode_address(address: str) -> GeocodeResponse:
    normalized = address.strip().lower()
    lat_lon = _KNOWN_ADDRESSES.get(normalized)

    if lat_lon is None:
        # Deterministic mock fallback near the U.S. Northeast, so the demo works
        # without a geocoding key while still responding to arbitrary input.
        seed = sum(ord(char) for char in normalized)
        latitude = 39.5 + (seed % 300) / 100
        longitude = -77.5 + (seed % 250) / 100
        confidence = "mock_fallback"
    else:
        latitude, longitude = lat_lon
        confidence = "known_demo"

    return GeocodeResponse(
        address=address,
        latitude=round(latitude, 6),
        longitude=round(longitude, 6),
        confidence=confidence,
    )


def search_address_suggestions(
    request: GeocodeSuggestRequest,
    *,
    access_token: str | None = None,
    http_get: HttpGet = requests.get,
) -> GeocodeSuggestResponse:
    settings = get_settings()
    resolved_access_token = access_token if access_token is not None else settings.mapbox_access_token
    query = request.query.strip()

    if len(query) < 2:
        return GeocodeSuggestResponse(suggestions=[], provider="local_demo")

    if not resolved_access_token:
        return GeocodeSuggestResponse(
            suggestions=_fallback_suggestions(query, request.limit),
            provider="local_demo",
        )

    params: dict[str, Any] = {
        "q": query,
        "access_token": resolved_access_token,
        "session_token": request.session_token or "sunsight-demo-session",
        "language": "en",
        "limit": request.limit,
    }
    if settings.mapbox_country:
        params["country"] = settings.mapbox_country
    if request.latitude is not None and request.longitude is not None:
        params["proximity"] = f"{request.longitude},{request.latitude}"

    try:
        response = http_get(
            f"{settings.mapbox_search_base_url.rstrip('/')}/suggest",
            params=params,
            timeout=settings.mapbox_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        return GeocodeSuggestResponse(
            suggestions=[_mapbox_suggestion(raw) for raw in payload.get("suggestions") or []],
            provider="mapbox_searchbox",
            attribution=payload.get("attribution"),
        )
    except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
        logger.warning("Mapbox suggest failed; using demo suggestions: %s", exc)
        return GeocodeSuggestResponse(
            suggestions=_fallback_suggestions(query, request.limit),
            provider="local_demo_fallback",
        )


def retrieve_geocode_selection(
    request: GeocodeRetrieveRequest,
    *,
    access_token: str | None = None,
    http_get: HttpGet = requests.get,
) -> GeocodeResponse:
    place = _demo_place_by_id(request.suggestion_id)
    if place is not None:
        return _demo_response(place)

    settings = get_settings()
    resolved_access_token = access_token if access_token is not None else settings.mapbox_access_token
    if not resolved_access_token:
        return geocode_address(request.suggestion_id)

    params = {
        "access_token": resolved_access_token,
        "session_token": request.session_token or "sunsight-demo-session",
        "language": "en",
    }

    try:
        response = http_get(
            f"{settings.mapbox_search_base_url.rstrip('/')}/retrieve/{request.suggestion_id}",
            params=params,
            timeout=settings.mapbox_timeout_seconds,
        )
        response.raise_for_status()
        return _parse_mapbox_feature(response.json())
    except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
        logger.warning("Mapbox retrieve failed; falling back to direct geocode: %s", exc)
        return geocode_address(request.suggestion_id)
