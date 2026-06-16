import unittest
from unittest.mock import Mock

from app.schemas.project import GeocodeRetrieveRequest, GeocodeSuggestRequest
from app.services.geocoder import (
    geocode_address,
    retrieve_geocode_selection,
    search_address_suggestions,
)


class GeocoderServiceTests(unittest.TestCase):
    def test_demo_suggestions_work_without_mapbox_token(self) -> None:
        result = search_address_suggestions(
            GeocodeSuggestRequest(query="tesla", limit=5),
            access_token="",
        )

        self.assertEqual(result.provider, "local_demo")
        self.assertGreaterEqual(len(result.suggestions), 1)
        self.assertEqual(result.suggestions[0].suggestion_id, "demo:tesla-fremont-factory")
        self.assertEqual(result.suggestions[0].source, "demo")

    def test_demo_retrieve_returns_coordinates(self) -> None:
        result = retrieve_geocode_selection(
            GeocodeRetrieveRequest(suggestion_id="demo:mit"),
            access_token="",
        )

        self.assertEqual(result.address, "MIT, 77 Massachusetts Avenue, Cambridge, MA")
        self.assertEqual(result.latitude, 42.3601)
        self.assertEqual(result.longitude, -71.0942)
        self.assertEqual(result.confidence, "known_demo")

    def test_mapbox_suggest_response_is_normalized(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "suggestions": [
                {
                    "mapbox_id": "mapbox.123",
                    "name": "Michigan Stadium",
                    "place_formatted": "1201 S Main St, Ann Arbor, MI",
                    "feature_type": "poi",
                }
            ],
            "attribution": "Mapbox attribution",
        }
        http_get = Mock(return_value=response)

        result = search_address_suggestions(
            GeocodeSuggestRequest(
                query="michigan stadium",
                session_token="session-1",
                latitude=42.2658,
                longitude=-83.7487,
            ),
            access_token="mapbox-token",
            http_get=http_get,
        )

        self.assertEqual(result.provider, "mapbox_searchbox")
        self.assertEqual(result.attribution, "Mapbox attribution")
        self.assertEqual(result.suggestions[0].suggestion_id, "mapbox.123")
        self.assertEqual(result.suggestions[0].source, "mapbox")

        _call_args, call_kwargs = http_get.call_args
        self.assertEqual(call_kwargs["params"]["session_token"], "session-1")
        self.assertEqual(call_kwargs["params"]["proximity"], "-83.7487,42.2658")
        self.assertEqual(call_kwargs["params"]["access_token"], "mapbox-token")

    def test_mapbox_retrieve_response_is_normalized(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "features": [
                {
                    "geometry": {"coordinates": [-83.748708, 42.265837]},
                    "properties": {
                        "name": "Michigan Stadium",
                        "full_address": "Michigan Stadium, 1201 S Main St, Ann Arbor, MI",
                    },
                }
            ]
        }

        result = retrieve_geocode_selection(
            GeocodeRetrieveRequest(suggestion_id="mapbox.123", session_token="session-1"),
            access_token="mapbox-token",
            http_get=Mock(return_value=response),
        )

        self.assertEqual(result.address, "Michigan Stadium, 1201 S Main St, Ann Arbor, MI")
        self.assertEqual(result.latitude, 42.265837)
        self.assertEqual(result.longitude, -83.748708)
        self.assertEqual(result.confidence, "mapbox_searchbox")

    def test_openstreetmap_suggest_response_is_used_without_mapbox_token(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = [
            {
                "display_name": "Michigan Stadium, 1201, South Main Street, Ann Arbor, Michigan, United States",
                "name": "Michigan Stadium",
                "lat": "42.265837",
                "lon": "-83.748708",
                "class": "amenity",
                "type": "stadium",
            }
        ]
        http_get = Mock(return_value=response)

        result = search_address_suggestions(
            GeocodeSuggestRequest(query="michigan stadium", limit=5),
            access_token="",
            http_get=http_get,
        )

        self.assertEqual(result.provider, "openstreetmap")
        self.assertEqual(result.attribution, "Search data from OpenStreetMap Nominatim")
        self.assertEqual(result.suggestions[0].name, "Michigan Stadium")
        self.assertEqual(result.suggestions[0].source, "openstreetmap")
        self.assertTrue(result.suggestions[0].suggestion_id.startswith("osm:42.265837:-83.748708:"))

        _call_args, call_kwargs = http_get.call_args
        self.assertEqual(call_kwargs["params"]["q"], "michigan stadium")
        self.assertEqual(call_kwargs["params"]["format"], "jsonv2")
        self.assertIn("User-Agent", call_kwargs["headers"])

    def test_openstreetmap_retrieve_uses_encoded_suggestion_coordinates(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = [
            {
                "display_name": "Michigan Stadium, 1201, South Main Street, Ann Arbor, Michigan, United States",
                "name": "Michigan Stadium",
                "lat": "42.265837",
                "lon": "-83.748708",
                "class": "amenity",
                "type": "stadium",
            }
        ]

        suggestions = search_address_suggestions(
            GeocodeSuggestRequest(query="michigan stadium", limit=5),
            access_token="",
            http_get=Mock(return_value=response),
        )
        result = retrieve_geocode_selection(
            GeocodeRetrieveRequest(suggestion_id=suggestions.suggestions[0].suggestion_id),
            access_token="",
        )

        self.assertEqual(result.address, "Michigan Stadium, 1201, South Main Street, Ann Arbor, Michigan, United States")
        self.assertEqual(result.latitude, 42.265837)
        self.assertEqual(result.longitude, -83.748708)
        self.assertEqual(result.confidence, "openstreetmap")

    def test_direct_geocode_uses_openstreetmap_before_mock_fallback(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = [
            {
                "display_name": "Michigan Stadium, 1201, South Main Street, Ann Arbor, Michigan, United States",
                "lat": "42.265837",
                "lon": "-83.748708",
            }
        ]

        result = geocode_address("Michigan Stadium", http_get=Mock(return_value=response))

        self.assertEqual(result.address, "Michigan Stadium, 1201, South Main Street, Ann Arbor, Michigan, United States")
        self.assertEqual(result.latitude, 42.265837)
        self.assertEqual(result.longitude, -83.748708)
        self.assertEqual(result.confidence, "openstreetmap")


if __name__ == "__main__":
    unittest.main()
