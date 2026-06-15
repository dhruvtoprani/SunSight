from fastapi import APIRouter

from app.schemas.project import (
    GeocodeRequest,
    GeocodeResponse,
    GeocodeRetrieveRequest,
    GeocodeSuggestRequest,
    GeocodeSuggestResponse,
)
from app.services.geocoder import (
    geocode_address,
    retrieve_geocode_selection,
    search_address_suggestions,
)

router = APIRouter(tags=["geocode"])


@router.post("/geocode", response_model=GeocodeResponse)
def geocode(request: GeocodeRequest) -> GeocodeResponse:
    return geocode_address(request.address)


@router.post("/geocode/suggest", response_model=GeocodeSuggestResponse)
def suggest_geocode(request: GeocodeSuggestRequest) -> GeocodeSuggestResponse:
    return search_address_suggestions(request)


@router.post("/geocode/retrieve", response_model=GeocodeResponse)
def retrieve_geocode(request: GeocodeRetrieveRequest) -> GeocodeResponse:
    return retrieve_geocode_selection(request)
