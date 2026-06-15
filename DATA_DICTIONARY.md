# DATA_DICTIONARY

## Input Fields

| Field | Type | Description |
| --- | --- | --- |
| `address` | string | User-entered site address. |
| `latitude` | number | Site latitude. |
| `longitude` | number | Site longitude. |
| `project_mode` | enum | `residential`, `commercial`, or `open_land`. |
| `selected_polygon` | GeoJSON Polygon | User-selected site boundary. |
| `exclusion_polygons` | GeoJSON Polygon[] | Areas that should not receive panels. |
| `setback_margin_m` | number | Required edge clearance in meters. |
| `panel.watts` | number | DC wattage per panel. |
| `panel.length_m` | number | Panel length in meters. |
| `panel.width_m` | number | Panel width in meters. |
| `panel.gap_m` | number | Gap between panels in meters. |
| `tilt` | number | Array tilt in degrees. |
| `azimuth` | number | Array azimuth in degrees. |
| `monthly_bill` | number | Monthly electricity bill in USD. |
| `annual_demand_kwh` | number | Annual electricity demand. |
| `electricity_rate_per_kwh` | number | Retail electricity rate. |
| `install_cost_per_watt` | number | Installed cost per watt DC. |
| `incentive_pct` | number | Incentive percentage as decimal. |

## Output Fields

| Field | Type | Description |
| --- | --- | --- |
| `gross_area_sq_m` | number | Selected polygon area in square meters. |
| `usable_area_sq_m` | number | Area after exclusions and setback approximation. |
| `panel_count` | number | Number of fitted panels. |
| `system_size_kw_dc` | number | DC system size. |
| `coverage_ratio` | number | Panel area divided by usable area. |
| `annual_production_kwh` | number | Annual AC production estimate. |
| `monthly_production_kwh` | number[] | Monthly production estimate. |
| `model_source` | string | `pvwatts_v8` or `regional_fallback`. |
| `fallback_reason` | string or null | Reason a live PVWatts result was not used. |
| `weather_data_source` | string or null | PVWatts weather dataset description. |
| `station_distance_m` | number or null | Distance to the selected PVWatts weather data point. |
| `demand_offset_pct` | number | Annual production divided by annual demand. |
| `annual_savings` | number | Estimated yearly bill savings. |
| `simple_payback_years` | number | Net cost divided by annual savings. |
| `co2_avoided_kg_per_year` | number | Annual avoided emissions estimate. |

## API Response Fields

### `POST /geocode`

Returns `address`, `latitude`, `longitude`, and `confidence`.

### `POST /geocode/suggest`

Accepts `query`, `session_token`, optional current `latitude`/`longitude`, and `limit`.

Returns:

- `suggestions[].suggestion_id`
- `suggestions[].name`
- `suggestions[].place_formatted`
- `suggestions[].full_address`
- `suggestions[].feature_type`
- `suggestions[].source`
- `provider`
- `attribution`

### `POST /geocode/retrieve`

Accepts `suggestion_id` and `session_token`, then returns the selected `address`, `latitude`, `longitude`, and `confidence`.

### `POST /geometry/area`

Returns area fields, exclusion area, and setback loss percentage.

### `POST /geometry/optimize-layout`

Returns `layout_id`, `layout_mode`, panel count, system size, orientation, and panel GeoJSON coordinates.

### `POST /solar/pvwatts`

Returns monthly production, annual production, specific yield, capacity factor, model source, solar radiation, weather-data metadata, warnings, and fallback reason.

### `POST /financial/estimate`

Returns demand, install cost, net cost, savings, payback, demand offset, 25-year savings, and CO2 avoided.

## Geometry Schema

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [-73.98603, 40.74867],
      [-73.98545, 40.74867],
      [-73.98545, 40.74828],
      [-73.98603, 40.74828],
      [-73.98603, 40.74867]
    ]
  ]
}
```

Coordinates are GeoJSON order: longitude, latitude.

## Layout Schema

```json
{
  "layout_id": "layout_001",
  "layout_mode": "max_capacity",
  "panel_count": 42,
  "system_size_kw_dc": 18.06,
  "orientation_degrees": 90,
  "panels": []
}
```

## Solar Estimate Schema

```json
{
  "monthly_production_kwh": [1000, 1100],
  "annual_production_kwh": 23650,
  "specific_yield_kwh_per_kw": 1350,
  "capacity_factor": 0.154,
  "model_source": "pvwatts_v8",
  "weather_data_source": "NSRDB PSM V3 GOES tmy-2020 3.2.0",
  "station_distance_m": 1000,
  "warnings": [],
  "fallback_reason": null
}
```

## Financial Estimate Schema

```json
{
  "gross_install_cost": 50568,
  "net_install_cost": 35397.6,
  "annual_savings": 4257,
  "simple_payback_years": 8.31,
  "demand_offset_pct": 84.46,
  "twenty_five_year_savings": 71027.4
}
```

## Assumptions

- Default panel: `430 W`, `1.72 m x 1.13 m`.
- Default setback: `0.9 m`.
- Default system losses: `14%`.
- Default electricity rate: `$0.18/kWh`.
- Default install cost: `$2.80/W`.
- Default incentive: `30%`.
- Default CO2 factor: `0.386 kg/kWh`.
