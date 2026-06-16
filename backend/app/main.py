from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
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
DEFAULT_STATIC_DIR = Path(__file__).resolve().parents[2] / "frontend" / "out"
STATIC_DIR = Path(settings.static_dir).resolve() if settings.static_dir else DEFAULT_STATIC_DIR

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials="*" not in settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sunsight-api"}


@app.get("/api/health")
def api_health() -> dict[str, str]:
    return health()


for api_prefix in ("", "/api"):
    app.include_router(routes_geocode.router, prefix=api_prefix)
    app.include_router(routes_projects.router, prefix=api_prefix)
    app.include_router(routes_geometry.router, prefix=api_prefix)
    app.include_router(routes_solar.router, prefix=api_prefix)
    app.include_router(routes_financial.router, prefix=api_prefix)
    app.include_router(routes_reports.router, prefix=api_prefix)


@app.api_route(
    "/api",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    include_in_schema=False,
)
@app.api_route(
    "/api/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    include_in_schema=False,
)
def missing_api_route(full_path: str = "") -> None:
    raise HTTPException(status_code=404, detail="API route not found")


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
def frontend(full_path: str = "") -> FileResponse:
    if not STATIC_DIR.exists():
        raise HTTPException(status_code=404, detail="Frontend build not found. Run `npm run build` in frontend first.")

    requested = (STATIC_DIR / full_path).resolve()
    candidates = []
    if full_path:
        candidates.extend(
            [
                requested,
                STATIC_DIR / f"{full_path}.html",
                requested / "index.html",
            ]
        )
    candidates.append(STATIC_DIR / "index.html")

    for candidate in candidates:
        candidate = candidate.resolve()
        if candidate.is_file() and candidate.is_relative_to(STATIC_DIR):
            return FileResponse(candidate)

    raise HTTPException(status_code=404, detail="Not found")
