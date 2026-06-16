# SunSight

**AI Solar Layout & Savings Planner** — a full-stack geospatial energy demo that converts an address-based rooftop or parcel selection into a solar panel layout, production estimate, savings estimate, and payback summary.

## Demo Flow

1. Type an address, campus, or landmark and select an autocomplete recommendation.
2. Open the satellite planning map.
3. Draw a site polygon or load the sample roof.
4. Optionally draw exclusion zones.
5. Optimize three layouts: Max Capacity, Conservative, and Best ROI.
6. Review usable area, panel count, kW DC, monthly generation, savings, payback, and CO2 avoided.
7. Export the current report as JSON.

## Screenshots

Run the frontend and backend locally, then open `http://localhost:3000`. The current MVP renders a polished graphite planning workspace with a focused site sidebar, satellite map overlays, responsive charts, layout comparison, and report preview.

![SunSight UI preview](frontend/public/sunsight-ui-preview.jpg)

## Why This Matters

Most solar calculators return a broad address-level estimate. SunSight focuses on the more interesting engineering loop: user-selected geometry, usable area, panel packing, energy production, and ROI assumptions.

## Architecture

```text
frontend/ Next.js App Router + TypeScript + Tailwind + Leaflet + Recharts
backend/  FastAPI + Pydantic service modules
Dockerfile builds the frontend as static files and serves them from FastAPI
data/     sample GeoJSON inputs
scripts/  optimizer CLI smoke tests
cv/       stretch placeholders for roof/obstruction detection
```

Address autocomplete uses Mapbox Search Box when `MAPBOX_ACCESS_TOKEN` is configured and a curated demo catalog otherwise. Regional fallback solar production keeps the rest of the demo usable without external API keys.

The preferred deployment is a single Dockerized web service. FastAPI serves `/api/*` and the exported Next.js frontend from the same origin, so the online app does not depend on browser calls to `localhost` or cross-origin API wiring.

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, Leaflet, Esri World Imagery, Recharts, Lucide icons
- Backend: FastAPI, Pydantic, Python geometry services
- Production integrations: Mapbox Search Box and PVWatts V8 through the National Laboratory of the Rockies developer API
- Planned integrations: OpenEI, PostgreSQL/PostGIS

## Address Search

The search field is an accessible autocomplete combobox with:

- Debounced recommendations.
- Mouse selection.
- Arrow-key navigation and Enter selection.
- Exact coordinate retrieval after a recommendation is selected.
- Proximity bias around the current map center.
- A local demo catalog when Mapbox is not configured.

![SunSight address autocomplete](frontend/public/sunsight-address-autocomplete.jpg)

For full U.S. address and place search, create a repo-level `.env` file:

```bash
MAPBOX_ACCESS_TOKEN=pk_your_mapbox_token
MAPBOX_COUNTRY=US
```

The backend proxies Mapbox Search Box `/suggest` and `/retrieve` requests, so the token does not need to be exposed in the browser bundle.

## Panel Layout Algorithm

The MVP optimizer:

1. Converts GeoJSON longitude/latitude coordinates into a local meter plane.
2. Calculates gross area with the shoelace formula.
3. Applies an approximate setback area loss.
4. Generates rectangular panel candidates across the polygon bounding box.
5. Tests 0-degree and 90-degree orientations.
6. Keeps panels whose corners fall inside the selected polygon and outside exclusions.
7. Returns panel rectangles back in GeoJSON coordinates.

This is intentionally deterministic and explainable. It is not a production-grade solar design engine.

## Solar Production Model

The `/solar/pvwatts` endpoint calls PVWatts V8 when `PVWATTS_API_KEY` is configured. The API key is sent in the `X-Api-Key` header to:

```text
https://developer.nlr.gov/api/pvwatts/v8.json
```

The former `developer.nrel.gov` API domain was retired on May 29, 2026. SunSight uses the replacement NLR developer domain.

If the key is missing, system capacity is below the API minimum, or the request fails, SunSight uses:

```text
annual_kwh = system_size_kw * specific_yield
```

Specific yield is selected from latitude bands. Responses include `model_source` and `fallback_reason` so live and fallback estimates remain distinguishable.

## Financial Assumptions

Defaults:

- Electricity rate: `$0.18/kWh`
- Install cost: `$2.80/W`
- Incentive: `30%`
- Export value: `50%` of retail electricity rate
- Grid emissions factor: `0.386 kg CO2/kWh`

Savings account for self-consumption and discounted exported production.

## Run Locally

Fastest production-like path:

```bash
docker compose up --build
```

Open `http://localhost:8000`.

Split development path:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

Open `http://localhost:3000`.

Static one-package smoke test without Docker:

```bash
cd frontend
npm run build
cd ../backend
SUNSIGHT_STATIC_DIR=../frontend/out uvicorn app.main:app --port 8000
```

Open `http://localhost:8000`.

Optimizer smoke test:

```bash
python scripts/run_layout_optimizer.py --sample data/sample/demo_polygon.geojson
```

## Deploy

The current deployment target is one Docker web service:

```bash
docker build -t sunsight .
docker run --env-file .env -p 8000:8000 sunsight
```

On Render, import the repo and use `render.yaml`, or create a Docker Web Service pointing at the root `Dockerfile`.

Required production env vars for live provider-backed estimates:

```bash
MAPBOX_ACCESS_TOKEN=pk_your_mapbox_token
PVWATTS_API_KEY=your_pvwatts_key
```

If those keys are missing, the app still runs with curated geocoding and regional production fallbacks.

## Sample Site Result

Using the default Empire State Building-area sample site and current assumptions, the verified browser flow generated:

- Max Capacity: `1,166` panels and `501.4 kW DC`
- Best ROI: `55` panels and `23.7 kW DC`
- Best ROI annual generation: approximately `31,636 kWh`
- Best ROI simple payback: approximately `8.36 years`

Exact output depends on assumptions, current PVWatts data, and setback settings.

## Limitations

- Without `MAPBOX_ACCESS_TOKEN`, autocomplete is limited to the built-in demo location catalog and free-text search uses deterministic fallback coordinates.
- Solar production requires `PVWATTS_API_KEY` for live PVWatts results and otherwise uses the regional fallback.
- Setbacks are approximated for area reporting.
- Panel packing is simple grid packing.
- Shade, pitch, LiDAR, utility tariffs, permitting, and battery modeling are out of MVP scope.

## Future Work

- Surface PVWatts weather-data metadata and fallback status more prominently in the UI.
- Add persisted projects with PostgreSQL/PostGIS.
- Add Mapbox Draw or richer editing controls.
- Generate PDF reports.
- Add building footprint suggestions.
- Add optional computer-vision roof assist.

## Interview Story

I built SunSight as an AI-assisted solar planning platform that lets a user enter an address, select a rooftop or parcel on a satellite map, and estimate solar capacity, annual generation, savings, and payback. The core technical problem is converting messy real-world geography into a physical panel layout by projecting polygons into meters, applying setbacks and exclusions, fitting panels, and connecting the resulting system size to production and ROI modeling.
