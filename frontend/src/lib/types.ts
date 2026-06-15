export type ProjectMode = "residential" | "commercial" | "open_land";
export type LayoutMode = "max_capacity" | "conservative" | "best_roi";

export type LngLat = [number, number];

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: LngLat[][];
}

export interface LocationResult {
  address: string;
  latitude: number;
  longitude: number;
  confidence: string;
}

export interface GeocodeSuggestion {
  suggestion_id: string;
  name: string;
  place_formatted?: string | null;
  full_address: string;
  feature_type: string;
  source: string;
}

export interface GeocodeSuggestResponse {
  suggestions: GeocodeSuggestion[];
  provider: string;
  attribution?: string | null;
}

export interface AreaResult {
  gross_area_sq_m: number;
  gross_area_sq_ft: number;
  usable_area_sq_m: number;
  usable_area_sq_ft: number;
  exclusion_area_sq_m: number;
  setback_area_loss_pct: number;
}

export interface PanelSpec {
  watts: number;
  length_m: number;
  width_m: number;
  gap_m: number;
}

export interface PanelPlacement {
  panel_id: string;
  coordinates: LngLat[][];
}

export interface LayoutResult {
  layout_id: string;
  layout_mode: LayoutMode;
  panel_count: number;
  system_size_kw_dc: number;
  gross_area_sq_m: number;
  usable_area_sq_m: number;
  coverage_ratio: number;
  unused_area_sq_m: number;
  orientation_degrees: number;
  panels: PanelPlacement[];
}

export interface SolarResult {
  monthly_production_kwh: number[];
  annual_production_kwh: number;
  specific_yield_kwh_per_kw: number;
  capacity_factor: number;
  model_source: string;
  solar_radiation_monthly_kwh_per_m2_day?: number[] | null;
  solar_radiation_annual_kwh_per_m2_day?: number | null;
  weather_data_source?: string | null;
  station_distance_m?: number | null;
  warnings?: string[];
  fallback_reason?: string | null;
}

export interface FinancialResult {
  annual_demand_kwh: number;
  gross_install_cost: number;
  net_install_cost: number;
  annual_savings: number;
  monthly_savings_estimate: number;
  simple_payback_years: number | null;
  demand_offset_pct: number;
  twenty_five_year_savings: number;
  co2_avoided_kg_per_year: number;
  co2_avoided_tons_per_year: number;
}

export interface Assumptions {
  panel: PanelSpec;
  setback_margin_m: number;
  tilt: number;
  azimuth: number;
  monthly_bill: number;
  annual_demand_kwh: number;
  electricity_rate_per_kwh: number;
  install_cost_per_watt: number;
  incentive_pct: number;
}

export interface LayoutAnalysis {
  layout: LayoutResult;
  solar: SolarResult;
  financial: FinancialResult;
}
