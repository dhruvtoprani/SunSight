from __future__ import annotations

import base64
import binascii
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


def _encode_osm_payload(address: str) -> str:
    encoded = base64.urlsafe_b64encode(address.encode("utf-8")).decode("ascii")
    return encoded.rstrip("=")


def _decode_osm_payload(encoded: str) -> str:
    padded = encoded + ("=" * (-len(encoded) % 4))
    return base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")


def _nominatim_headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "Accept": "application/json",
        "User-Agent": settings.nominatim_user_agent,
    }


def _nominatim_search_params(query: str, limit: int) -> dict[str, Any]:
    settings = get_settings()
    params: dict[str, Any] = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": limit,
    }
    if settings.nominatim_country_codes:
        params["countrycodes"] = settings.nominatim_country_codes
    return params


def _display_parts(display_name: str) -> tuple[str, str | None]:
    parts = [part.strip() for part in display_name.split(",") if part.strip()]
    if not parts:
        return display_name, None
    return parts[0], ", ".join(parts[1:]) or None


def _nominatim_suggestion(raw: dict[str, Any]) -> GeocodeSuggestion:
    display_name = str(raw.get("display_name") or "Selected location")
    name = str(raw.get("name") or _display_parts(display_name)[0])
    place_formatted = _display_parts(display_name)[1]
    latitude = round(float(raw["lat"]), 6)
    longitude = round(float(raw["lon"]), 6)
    suggestion_id = f"osm:{latitude}:{longitude}:{_encode_osm_payload(display_name)}"
    return GeocodeSuggestion(
        suggestion_id=suggestion_id,
        name=name,
        place_formatted=place_formatted,
        full_address=display_name,
        feature_type=str(raw.get("type") or raw.get("class") or "place"),
        source="openstreetmap",
    )


def _openstreetmap_response(raw: dict[str, Any]) -> GeocodeResponse:
    display_name = str(raw.get("display_name") or raw.get("name") or "Selected location")
    return GeocodeResponse(
        address=display_name,
        latitude=round(float(raw["lat"]), 6),
        longitude=round(float(raw["lon"]), 6),
        confidence="openstreetmap",
    )


def _response_from_osm_suggestion_id(suggestion_id: str) -> GeocodeResponse | None:
    if not suggestion_id.startswith("osm:"):
        return None
    try:
        _prefix, latitude, longitude, encoded_address = suggestion_id.split(":", 3)
        return GeocodeResponse(
            address=_decode_osm_payload(encoded_address),
            latitude=round(float(latitude), 6),
            longitude=round(float(longitude), 6),
            confidence="openstreetmap",
        )
    except (binascii.Error, UnicodeDecodeError, ValueError, TypeError):
        return None


def _search_nominatim(
    query: str,
    limit: int,
    *,
    http_get: HttpGet = requests.get,
) -> list[dict[str, Any]]:
    settings = get_settings()
    response = http_get(
        f"{settings.nominatim_base_url.rstrip('/')}/search",
        params=_nominatim_search_params(query, limit),
        headers=_nominatim_headers(),
        timeout=settings.nominatim_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        raise ValueError("Nominatim search returned a non-list payload.")
    return payload


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


def geocode_address(address: str, *, http_get: HttpGet = requests.get) -> GeocodeResponse:
    normalized = address.strip().lower()
    lat_lon = _KNOWN_ADDRESSES.get(normalized)

    if lat_lon is not None:
        latitude, longitude = lat_lon
        return GeocodeResponse(
            address=address,
            latitude=round(latitude, 6),
            longitude=round(longitude, 6),
            confidence="known_demo",
        )

    try:
        matches = _search_nominatim(address, 1, http_get=http_get)
        if matches:
            return _openstreetmap_response(matches[0])
    except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
        logger.warning("Nominatim geocode failed; using deterministic fallback: %s", exc)

    # Deterministic mock fallback near the U.S. Northeast, so the demo works
    # even if external geocoding is unavailable.
    seed = sum(ord(char) for char in normalized)
    latitude = 39.5 + (seed % 300) / 100
    longitude = -77.5 + (seed % 250) / 100
    return GeocodeResponse(
        address=address,
        latitude=round(latitude, 6),
        longitude=round(longitude, 6),
        confidence="mock_fallback",
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

    demo_suggestions = _fallback_suggestions(query, request.limit)

    if not resolved_access_token:
        if demo_suggestions:
            return GeocodeSuggestResponse(suggestions=demo_suggestions, provider="local_demo")

        try:
            osm_results = _search_nominatim(query, request.limit, http_get=http_get)
            return GeocodeSuggestResponse(
                suggestions=[_nominatim_suggestion(raw) for raw in osm_results],
                provider="openstreetmap",
                attribution="Search data from OpenStreetMap Nominatim",
            )
        except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
            logger.warning("Nominatim suggest failed; using demo suggestions: %s", exc)

        return GeocodeSuggestResponse(
            suggestions=demo_suggestions,
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
        logger.warning("Mapbox suggest failed; trying OpenStreetMap fallback: %s", exc)
        try:
            osm_results = _search_nominatim(query, request.limit, http_get=http_get)
            return GeocodeSuggestResponse(
                suggestions=[_nominatim_suggestion(raw) for raw in osm_results],
                provider="openstreetmap_fallback",
                attribution="Search data from OpenStreetMap Nominatim",
            )
        except (requests.RequestException, KeyError, TypeError, ValueError) as osm_exc:
            logger.warning("Nominatim suggest failed; using demo suggestions: %s", osm_exc)
        return GeocodeSuggestResponse(
            suggestions=demo_suggestions,
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

    osm_response = _response_from_osm_suggestion_id(request.suggestion_id)
    if osm_response is not None:
        return osm_response

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
