# DEVLOG

## 2026-06-16

### Completed
- Converted the app toward a one-package deployment model: Next.js static export served by FastAPI from the same container.
- Added a Vercel Services entrypoint so the same FastAPI app serves `/api/*` and the frontend online.
- Moved the committed static frontend export into `backend/static` because Vercel Services packages service-owned files.
- Deployed production to `https://sunsight-eight.vercel.app`.
- Added same-origin frontend API calls through `/api/*`.
- Added `/api` backend routes while preserving legacy local endpoints.
- Added Dockerfile, `.dockerignore`, Render blueprint, and single-service Docker Compose config.
- Added FastAPI static serving for exported frontend routes and assets.
- Added a frontend demo-location fallback for address autocomplete so deployed frontend previews remain usable without a running FastAPI backend.
- Expanded the frontend demo geocoder with Stanford, MIT, Apple Park, Googleplex, UC Berkeley, Empire State Building, and Tesla Fremont Factory.
- Verified no-backend autocomplete behavior in the in-app browser by typing `stan`, selecting Stanford University, and confirming coordinates updated.
- Re-ran frontend lint, frontend production build, and backend unit tests.

### Decisions Made
- Use one FastAPI-owned web service as the preferred online deployment path so frontend and backend share a domain.
- Use Vercel Services for the fastest controlled public deployment and keep Docker/Render as the portable fallback.
- Keep frontend fallbacks as demo resilience, not as the primary production architecture.

### Bugs / Issues
- Live Mapbox Search Box and PVWatts behavior still need production provider keys in Vercel.

### Next
- Add production Mapbox and PVWatts keys in Vercel.
- Persist projects and estimates.

## 2026-06-15

### Completed
- Added a frontend demo-location fallback for address autocomplete so deployed frontend previews remain usable without a running FastAPI backend.
- Expanded the frontend demo geocoder with Stanford, MIT, Apple Park, Googleplex, UC Berkeley, Empire State Building, and Tesla Fremont Factory.
- Verified no-backend autocomplete behavior in the in-app browser by typing `stan`, selecting Stanford University, and confirming coordinates updated.
- Re-ran frontend lint, frontend production build, and backend unit tests.

### Decisions Made
- Keep frontend fallbacks as demo resilience when an API host is unavailable.

### Bugs / Issues
- Full production behavior requires a hosted backend and provider keys for live Mapbox and PVWatts behavior.

### Next
- Deploy a backend-backed online app.
- Persist projects and estimates.

## 2026-06-08

### Completed
- Integrated PVWatts V8 with structured fallback behavior and resource metadata.
- Added seven backend unit tests for solar and financial calculations.
- Migrated the PVWatts host to `developer.nlr.gov`; the former domain was retired on May 29, 2026.
- Verified a live PVWatts V8 response using the public `DEMO_KEY`.
- Added dashboard status for live PVWatts results versus regional fallback estimates.
- Reworked the frontend into a restrained graphite, solar-yellow, and electric-blue visual system.
- Added a sticky application shell, three-step workflow, focused site controls, edge-to-edge map workspace, deliberate empty state, and polished report summary.
- Made production and layout charts responsive and aligned their styling with the shared design system.
- Prevented unnecessary Leaflet map recreation when geocoding changes the center.
- Verified desktop and mobile layouts with no horizontal overflow.
- Verified the live browser flow from sample site through three PVWatts-backed layouts, layout switching, dashboard metrics, and report state.
- Captured the refreshed desktop interface and added it to the README.
- Moved map drawing controls into a dedicated toolbar above the satellite canvas so Leaflet layers and viewport height cannot hide them.
- Fixed address search submission through both the visible Search button and the Enter key.
- Reset site geometry, layout results, and active drawing state when a new address is selected.
- Verified search against known demo locations and confirmed all map controls remain visible at 390px width.
- Added a debounced address autocomplete combobox with mouse selection, arrow-key navigation, and Enter selection.
- Added FastAPI `/geocode/suggest` and `/geocode/retrieve` endpoints backed by Mapbox Search Box when configured.
- Added a curated local location catalog so autocomplete still works without a Mapbox token.
- Added four geocoder unit tests and verified autocomplete selection on desktop and mobile.
- Re-ran backend tests, frontend lint/build, and the optimizer smoke test.

### Decisions Made
- Send the PVWatts API key in the `X-Api-Key` header instead of query parameters.
- Normalize PVWatts capacity factor from percentage to the app's decimal representation.
- Preserve analysis continuity by falling back on missing keys, low system capacity, malformed responses, or network/API failures.
- Keep engineering assumptions available but collapsed by default so the primary planning flow stays focused.
- Use a single warm primary accent and reserve blue, green, and violet for metric differentiation.
- Keep Mapbox credentials server-side and group autocomplete calls with Search Box session tokens.

### Bugs / Issues
- Full address autocomplete requires a user-provided `MAPBOX_ACCESS_TOKEN`; without it, only curated demo recommendations are available.
- A user-provided PVWatts key is required for production use; `DEMO_KEY` is rate-limited.

### Next
- Persist projects and estimates.
- Add editable polygon vertices after initial drawing.

## 2026-06-07

### Completed
- Created the SunSight repo structure.
- Added FastAPI backend skeleton with health, geocode, geometry, solar, financial, project, and report routes.
- Added deterministic mock geocoding and fallback production/financial models.
- Added local meter-plane geometry calculations and a simple panel grid optimizer.
- Added Next.js App Router frontend with satellite map, polygon drawing, exclusion zones, dashboard cards, charts, and JSON export.
- Installed frontend and backend dependencies.
- Verified frontend lint and production build.
- Verified backend health/geocode/solar/financial/layout endpoints.
- Verified browser happy path: load sample roof, optimize layout, and render dashboard/report controls.

### Decisions Made
- Keep the first demo free of required API keys.
- Use Esri World Imagery through Leaflet for satellite tiles.
- Keep panel packing deterministic and explainable before adding advanced geometry or CV.
- Use frontend fallback calculations if the backend is not running.

### Bugs / Issues
- Geocoding is mocked.
- Setback area is approximate.
- Report export is JSON only.
- `npm install` reports two moderate dependency vulnerabilities; no force upgrade was applied.

### Next
- Replace fallback solar model with PVWatts.
- Add PDF report generation.
- Add real README screenshots.
