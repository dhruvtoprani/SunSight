from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    routes_financial,
    routes_geocode,
    routes_geometry,
    routes_projects,
    routes_reports,
    routes_solar,
)
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sunsight-api"}


app.include_router(routes_geocode.router)
app.include_router(routes_projects.router)
app.include_router(routes_geometry.router)
app.include_router(routes_solar.router)
app.include_router(routes_financial.router)
app.include_router(routes_reports.router)

