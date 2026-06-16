# CONTEXT

## Project Goal

SunSight is an AI-assisted solar planning demo. It should let a user enter an address, select a rooftop or parcel on a satellite map, fit solar panels, and estimate capacity, production, savings, payback, and CO2 avoided.

## Current Product State

The repo now contains a first end-to-end MVP loop:

- Address autocomplete with Mapbox Search Box support and a local demo catalog fallback.
- Single-container deployment path: Next.js exports static files, FastAPI serves the UI plus `/api/*` from one origin.
- Frontend-only previews remain demoable through browser-side location, layout, solar, and financial fallbacks, but the preferred online path is the Dockerized FastAPI server.
- Satellite map using Leaflet and Esri World Imagery.
- Click-to-draw site polygons.
- Click-to-draw exclusion zones.
- Area calculation.
- Three layout modes: Max Capacity, Conservative, Best ROI.
- Panel overlay on the map.
- Production, savings, payback, demand offset, and CO2 cards.
- Monthly production and layout comparison charts.
- JSON report export.
- A polished dark application shell with a three-step workflow, focused site sidebar, edge-to-edge map workspace, responsive charts, and report summary.
- A dedicated map toolbar that remains visible above the satellite canvas on desktop and mobile.
- Address search supports button and Enter-key submission, resets stale site state, and recenters the map.
- Address recommendations support debouncing, mouse selection, arrow-key navigation, Enter selection, and exact coordinate retrieval.

## Current Architecture

```text
backend/app/main.py                  FastAPI app setup, `/api/*` routing, exported frontend serving
backend/app/api/                     Route modules
backend/app/schemas/                 Pydantic request/response models
backend/app/services/                Geocoding, geometry, layout, solar, financial, report logic
frontend/src/app/                    Next.js App Router pages
frontend/src/components/map/         Leaflet map drawing and overlays
frontend/src/components/layout/      Main planner flow
frontend/src/lib/                    API client, types, formatters, fallback logic
Dockerfile                           Builds frontend export and runs FastAPI as the single web service
render.yaml                          Render Docker Web Service blueprint
```

## Key Technical Decisions

- Use manual polygon selection for MVP.
- Use local equirectangular projection math for first-pass meter calculations.
- Use grid panel packing before advanced geometry optimization.
- Use PVWatts V8 when configured, with a regional fallback for missing keys or API failures.
- Proxy Mapbox Search Box `suggest` and `retrieve` calls through FastAPI so provider credentials stay server-side.
- Keep a curated local suggestion catalog so autocomplete remains demonstrable without a Mapbox token.
- Default browser API calls go to same-origin `/api/*` so online deployment avoids CORS and `localhost` failures.
- Use one Dockerized web service as the primary deployment model.
- Use JSON export before PDF export.

## What Works

- The app can run without external API keys.
- The frontend can still demo analysis if the backend is down, but Docker deployment keeps backend logic online.
- Address autocomplete can still suggest known demo locations if the backend is down.
- Backend endpoints match the PRD's first API surface.
- Sample GeoJSON is available at `data/sample/demo_polygon.geojson`.
- Frontend lint and production build pass.
- Backend API smoke tests pass in `backend/venv`.
- Browser verification passes for the sample roof optimization path, layout switching, populated dashboard, and report state.
- Desktop and 390px mobile layouts render without horizontal overflow.
- All map drawing controls are visible at 390px mobile width.
- Address autocomplete works on desktop and mobile through mouse and keyboard selection.
- Mapbox Search Box is ready when `MAPBOX_ACCESS_TOKEN` is configured.
- PVWatts V8 integration is implemented against `developer.nlr.gov`.
- Eleven backend unit tests cover geocoding, solar parsing, fallback behavior, and financial calculations.

## What Is Broken / Incomplete

- No database persistence.
- No hosted Docker deployment has been created yet; Render/Fly/Railway credentials are still needed for a public one-container backend-backed URL.
- No automatic building footprints.
- No PDF export.
- No computer vision features.
- Setback and exclusion handling are approximate.
- npm reports two moderate vulnerabilities in frontend dependencies.

## Next Priority

Improve polygon vertex editing, then add persisted projects.

## Important Commands

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
npm run build
```

```bash
docker compose up --build
```

```bash
python scripts/run_layout_optimizer.py --sample data/sample/demo_polygon.geojson
```

## Dataset/API Assumptions

- Esri World Imagery is used for satellite tiles.
- Mapbox Search Box is optional; without a token, autocomplete uses the local demo catalog.
- PVWatts uses `https://developer.nlr.gov/api/pvwatts/v8.json`.
- The former `developer.nrel.gov` domain was retired on May 29, 2026.
- A configured `PVWATTS_API_KEY` enables live estimates.
- Utility rates are user-entered with a default of `$0.18/kWh`.

## Known Limitations

This is a feasibility and interview-demo tool, not an installer-ready engineering platform. Results should be treated as directional estimates.
