import type {
  AreaResult,
  Assumptions,
  FinancialResult,
  GeoJsonPolygon,
  LayoutMode,
  LayoutResult,
  LocationResult,
  LngLat,
  PanelPlacement,
  SolarResult,
} from "@/lib/types";

const EARTH_METERS_PER_DEGREE = 111_320;
const SQFT_PER_SQM = 10.7639104167;
const MONTHLY_PROFILE = [0.055, 0.065, 0.085, 0.095, 0.105, 0.108, 0.11, 0.102, 0.088, 0.075, 0.06, 0.052];

type XY = [number, number];

const LOCAL_DEMO_PLACES = [
  {
    id: "demo:empire-state",
    name: "Empire State Building",
    address: "350 Fifth Avenue, New York, NY 10118",
    latitude: 40.7484,
    longitude: -73.9857,
    aliases: ["350 fifth", "fifth avenue", "empire", "empire state"],
  },
  {
    id: "demo:tesla-fremont",
    name: "Tesla Fremont Factory",
    address: "45500 Fremont Boulevard, Fremont, CA 94538",
    latitude: 37.4947,
    longitude: -121.944,
    aliases: ["tesla", "fremont", "tesla factory"],
  },
  {
    id: "demo:stanford",
    name: "Stanford University",
    address: "450 Jane Stanford Way, Stanford, CA 94305",
    latitude: 37.4275,
    longitude: -122.1697,
    aliases: ["stanford", "stanford university"],
  },
  {
    id: "demo:mit",
    name: "MIT Campus",
    address: "77 Massachusetts Avenue, Cambridge, MA 02139",
    latitude: 42.3601,
    longitude: -71.0942,
    aliases: ["mit", "massachusetts institute", "cambridge ma"],
  },
  {
    id: "demo:apple-park",
    name: "Apple Park",
    address: "One Apple Park Way, Cupertino, CA 95014",
    latitude: 37.3349,
    longitude: -122.009,
    aliases: ["apple", "apple park", "cupertino"],
  },
  {
    id: "demo:googleplex",
    name: "Googleplex",
    address: "1600 Amphitheatre Parkway, Mountain View, CA 94043",
    latitude: 37.422,
    longitude: -122.0841,
    aliases: ["google", "googleplex", "amphitheatre", "mountain view"],
  },
  {
    id: "demo:berkeley",
    name: "UC Berkeley",
    address: "University Avenue and Oxford Street, Berkeley, CA 94720",
    latitude: 37.8719,
    longitude: -122.2585,
    aliases: ["berkeley", "uc berkeley", "cal campus"],
  },
];

function localFrame(ring: LngLat[]) {
  const openRing = ring[0]?.[0] === ring.at(-1)?.[0] && ring[0]?.[1] === ring.at(-1)?.[1] ? ring.slice(0, -1) : ring;
  const longitude = openRing.reduce((sum, point) => sum + point[0], 0) / Math.max(openRing.length, 1);
  const latitude = openRing.reduce((sum, point) => sum + point[1], 0) / Math.max(openRing.length, 1);
  return { latitude, longitude };
}

function toXY(point: LngLat, frame: { latitude: number; longitude: number }): XY {
  return [
    (point[0] - frame.longitude) * EARTH_METERS_PER_DEGREE * Math.cos((frame.latitude * Math.PI) / 180),
    (point[1] - frame.latitude) * EARTH_METERS_PER_DEGREE,
  ];
}

function toLngLat(point: XY, frame: { latitude: number; longitude: number }): LngLat {
  return [
    point[0] / (EARTH_METERS_PER_DEGREE * Math.cos((frame.latitude * Math.PI) / 180)) + frame.longitude,
    point[1] / EARTH_METERS_PER_DEGREE + frame.latitude,
  ];
}

function closeRing<T extends number[]>(ring: T[]): T[] {
  if (ring.length === 0) {
    return ring;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

function area(points: XY[]) {
  const ring = closeRing(points);
  return Math.abs(
    ring.slice(0, -1).reduce((sum, point, index) => {
      const next = ring[index + 1];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2,
  );
}

function perimeter(points: XY[]) {
  const ring = closeRing(points);
  return ring.slice(0, -1).reduce((sum, point, index) => {
    const next = ring[index + 1];
    return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
  }, 0);
}

function pointInPolygon(point: XY, polygon: XY[]) {
  const [x, y] = point;
  let inside = false;
  const ring = closeRing(polygon);
  ring.slice(0, -1).forEach((start, index) => {
    const end = ring[index + 1];
    const intersects = start[1] > y !== end[1] > y;
    if (intersects) {
      const xCross = ((end[0] - start[0]) * (y - start[1])) / (end[1] - start[1] || 1e-9) + start[0];
      if (x < xCross) {
        inside = !inside;
      }
    }
  });
  return inside;
}

function rectangle(cx: number, cy: number, length: number, width: number): XY[] {
  return [
    [cx - length / 2, cy - width / 2],
    [cx + length / 2, cy - width / 2],
    [cx + length / 2, cy + width / 2],
    [cx - length / 2, cy + width / 2],
  ];
}

export function mockGeocode(address: string): LocationResult {
  const normalized = address.trim().toLowerCase();
  const place = LOCAL_DEMO_PLACES.find(
    (candidate) =>
      candidate.id === normalized ||
      candidate.address.toLowerCase() === normalized ||
      candidate.name.toLowerCase() === normalized ||
      candidate.aliases.some((alias) => normalized.includes(alias)),
  );
  if (place) {
    return {
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      confidence: "frontend_demo",
    };
  }
  const seed = [...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    address,
    latitude: Number((39.5 + (seed % 300) / 100).toFixed(6)),
    longitude: Number((-77.5 + (seed % 250) / 100).toFixed(6)),
    confidence: "frontend_mock_fallback",
  };
}

export function searchLocalPlaceSuggestions(query: string, limit = 6) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) {
    return [];
  }

  return LOCAL_DEMO_PLACES.filter((place) => {
    const haystack = [place.name, place.address, ...place.aliases].join(" ").toLowerCase();
    return haystack.includes(normalized);
  })
    .slice(0, limit)
    .map((place) => ({
      suggestion_id: place.id,
      name: place.name,
      place_formatted: place.address,
      full_address: place.address,
      feature_type: "poi",
      source: "frontend_demo",
    }));
}

export function geocodeLocalSuggestion(suggestionId: string): LocationResult | null {
  const place = LOCAL_DEMO_PLACES.find((candidate) => candidate.id === suggestionId);
  if (!place) {
    return null;
  }
  return {
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    confidence: "frontend_demo",
  };
}

export function makeRectanglePolygon(latitude: number, longitude: number, widthM = 68, heightM = 42): GeoJsonPolygon {
  const frame = { latitude, longitude };
  const corners: XY[] = [
    [-widthM / 2, -heightM / 2],
    [widthM / 2, -heightM / 2],
    [widthM / 2, heightM / 2],
    [-widthM / 2, heightM / 2],
  ];
  return {
    type: "Polygon",
    coordinates: [closeRing(corners.map((point) => toLngLat(point, frame)))],
  };
}

export function calculateAreaLocal(polygon: GeoJsonPolygon, exclusions: GeoJsonPolygon[], setback: number): AreaResult {
  const ring = polygon.coordinates[0];
  const frame = localFrame(ring);
  const projected = ring.slice(0, -1).map((point) => toXY(point, frame));
  const gross = area(projected);
  const exclusionArea = exclusions.reduce((sum, exclusion) => {
    const exclusionProjected = exclusion.coordinates[0].slice(0, -1).map((point) => toXY(point, frame));
    return sum + area(exclusionProjected);
  }, 0);
  const setbackLoss = Math.min(gross, perimeter(projected) * setback);
  const usable = Math.max(gross - exclusionArea - setbackLoss, 0);
  return {
    gross_area_sq_m: Number(gross.toFixed(2)),
    gross_area_sq_ft: Number((gross * SQFT_PER_SQM).toFixed(2)),
    usable_area_sq_m: Number(usable.toFixed(2)),
    usable_area_sq_ft: Number((usable * SQFT_PER_SQM).toFixed(2)),
    exclusion_area_sq_m: Number(exclusionArea.toFixed(2)),
    setback_area_loss_pct: gross ? Number(((setbackLoss / gross) * 100).toFixed(2)) : 0,
  };
}

function buildPanels(
  polygon: GeoJsonPolygon,
  exclusions: GeoJsonPolygon[],
  assumptions: Assumptions,
  mode: LayoutMode,
): { panels: PanelPlacement[]; orientation: number; usableArea: number; grossArea: number } {
  const ring = polygon.coordinates[0];
  const frame = localFrame(ring);
  const projected = ring.slice(0, -1).map((point) => toXY(point, frame));
  const projectedExclusions = exclusions.map((exclusion) => exclusion.coordinates[0].slice(0, -1).map((point) => toXY(point, frame)));
  const areaResult = calculateAreaLocal(polygon, exclusions, assumptions.setback_margin_m);
  const xs = projected.map((point) => point[0]);
  const ys = projected.map((point) => point[1]);
  const setback = assumptions.setback_margin_m + (mode === "conservative" ? 0.8 : 0);
  const gap = assumptions.panel.gap_m + (mode === "conservative" ? 0.08 : 0);
  const candidates = [0, 90].map((orientation) => {
    const length = orientation === 90 ? assumptions.panel.width_m : assumptions.panel.length_m;
    const width = orientation === 90 ? assumptions.panel.length_m : assumptions.panel.width_m;
    const placed: PanelPlacement[] = [];
    let row = 0;
    for (let y = Math.min(...ys) + setback + width / 2; y <= Math.max(...ys) - setback - width / 2; y += width + gap) {
      row += 1;
      let column = 0;
      for (let x = Math.min(...xs) + setback + length / 2; x <= Math.max(...xs) - setback - length / 2; x += length + gap) {
        column += 1;
        const rect = rectangle(x, y, length, width);
        const insideSite = rect.every((point) => pointInPolygon(point, projected));
        const hitsExclusion = projectedExclusions.some((exclusion) => rect.some((point) => pointInPolygon(point, exclusion)));
        if (insideSite && !hitsExclusion) {
          const lngLatRing = closeRing(rect.map((point) => toLngLat(point, frame)));
          placed.push({
            panel_id: `p_${row}_${column}`,
            coordinates: [lngLatRing],
          });
        }
      }
    }
    return { orientation, placed };
  });

  const best = candidates.sort((a, b) => b.placed.length - a.placed.length)[0];
  return {
    panels: best.placed,
    orientation: best.orientation,
    usableArea: areaResult.usable_area_sq_m,
    grossArea: areaResult.gross_area_sq_m,
  };
}

export function optimizeLayoutLocal(
  polygon: GeoJsonPolygon,
  exclusions: GeoJsonPolygon[],
  assumptions: Assumptions,
  mode: LayoutMode,
): LayoutResult {
  const packed = buildPanels(polygon, exclusions, assumptions, mode);
  let panels = packed.panels;
  if (mode === "best_roi") {
    const targetKw = assumptions.annual_demand_kwh / 1350;
    const targetPanels = Math.ceil((targetKw * 1000) / assumptions.panel.watts);
    panels = panels.slice(0, Math.min(panels.length, Math.ceil(targetPanels * 1.05)));
  }
  const systemSize = (panels.length * assumptions.panel.watts) / 1000;
  const panelArea = assumptions.panel.length_m * assumptions.panel.width_m;
  return {
    layout_id: `local_${mode}`,
    layout_mode: mode,
    panel_count: panels.length,
    system_size_kw_dc: Number(systemSize.toFixed(2)),
    gross_area_sq_m: packed.grossArea,
    usable_area_sq_m: packed.usableArea,
    coverage_ratio: packed.usableArea ? Number(((panels.length * panelArea) / packed.usableArea).toFixed(3)) : 0,
    unused_area_sq_m: Number(Math.max(packed.usableArea - panels.length * panelArea, 0).toFixed(2)),
    orientation_degrees: packed.orientation,
    panels,
  };
}

function specificYield(latitude: number) {
  const absLat = Math.abs(latitude);
  if (absLat < 30) return 1550;
  if (absLat < 38) return 1450;
  if (absLat < 45) return 1350;
  return 1225;
}

export function estimateSolarLocal(latitude: number, longitude: number, systemCapacityKw: number, assumptions: Assumptions): SolarResult {
  void longitude;
  const yieldValue = specificYield(latitude);
  const annual = systemCapacityKw * yieldValue;
  const monthly = MONTHLY_PROFILE.map((weight) => Number((annual * weight).toFixed(1)));
  const monthlyTotal = monthly.reduce((sum, value) => sum + value, 0);
  return {
    monthly_production_kwh: monthly.map((value) => Number(((value / monthlyTotal) * annual).toFixed(1))),
    annual_production_kwh: Number(annual.toFixed(1)),
    specific_yield_kwh_per_kw: yieldValue,
    capacity_factor: systemCapacityKw ? Number((annual / (systemCapacityKw * 8760)).toFixed(3)) : 0,
    model_source: `frontend_fallback_tilt_${assumptions.tilt}_azimuth_${assumptions.azimuth}`,
  };
}

export function estimateFinancialLocal(layout: LayoutResult, solar: SolarResult, assumptions: Assumptions): FinancialResult {
  const demand = assumptions.annual_demand_kwh || (assumptions.monthly_bill / assumptions.electricity_rate_per_kwh) * 12;
  const selfConsumed = Math.min(solar.annual_production_kwh, demand);
  const exported = Math.max(solar.annual_production_kwh - demand, 0);
  const annualSavings = selfConsumed * assumptions.electricity_rate_per_kwh + exported * assumptions.electricity_rate_per_kwh * 0.5;
  const grossInstallCost = layout.system_size_kw_dc * 1000 * assumptions.install_cost_per_watt;
  const netInstallCost = grossInstallCost * (1 - assumptions.incentive_pct);
  const payback = annualSavings > 0 ? netInstallCost / annualSavings : null;
  const co2 = solar.annual_production_kwh * 0.386;
  return {
    annual_demand_kwh: Number(demand.toFixed(1)),
    gross_install_cost: Number(grossInstallCost.toFixed(2)),
    net_install_cost: Number(netInstallCost.toFixed(2)),
    annual_savings: Number(annualSavings.toFixed(2)),
    monthly_savings_estimate: Number((annualSavings / 12).toFixed(2)),
    simple_payback_years: payback === null ? null : Number(payback.toFixed(2)),
    demand_offset_pct: demand ? Number(((solar.annual_production_kwh / demand) * 100).toFixed(2)) : 0,
    twenty_five_year_savings: Number((annualSavings * 25 - netInstallCost).toFixed(2)),
    co2_avoided_kg_per_year: Number(co2.toFixed(1)),
    co2_avoided_tons_per_year: Number((co2 / 1000).toFixed(2)),
  };
}
