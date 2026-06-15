"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BatteryCharging,
  Building2,
  ChevronDown,
  CircleDot,
  Download,
  Factory,
  FileText,
  Gauge,
  Home,
  LandPlot,
  Leaf,
  Map,
  MapPin,
  PanelTop,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";

import { AddressAutocomplete } from "@/components/location/address-autocomplete";
import { SiteMap } from "@/components/map/site-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { postJson } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import {
  calculateAreaLocal,
  estimateFinancialLocal,
  estimateSolarLocal,
  makeRectanglePolygon,
  mockGeocode,
  optimizeLayoutLocal,
} from "@/lib/mock-analysis";
import type {
  AreaResult,
  Assumptions,
  FinancialResult,
  GeoJsonPolygon,
  LayoutAnalysis,
  LayoutMode,
  LayoutResult,
  LocationResult,
  ProjectMode,
  SolarResult,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const LAYOUT_MODES: LayoutMode[] = ["max_capacity", "conservative", "best_roi"];

const ProductionChart = dynamic(
  () => import("@/components/charts/production-chart").then((module) => module.ProductionChart),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-2xl border border-white/10 bg-slate-950/30" />,
  },
);

const LayoutComparison = dynamic(
  () => import("@/components/charts/layout-comparison").then((module) => module.LayoutComparison),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-2xl border border-white/10 bg-slate-950/30" />,
  },
);

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  max_capacity: "Max Capacity",
  conservative: "Conservative",
  best_roi: "Best ROI",
};

const MODE_LABELS: Record<ProjectMode, string> = {
  residential: "Residential rooftop",
  commercial: "Commercial rooftop",
  open_land: "Open land / parking lot",
};

const MODE_SHORT_LABELS: Record<ProjectMode, string> = {
  residential: "Home",
  commercial: "Commercial",
  open_land: "Open land",
};

const MODE_ICONS = {
  residential: Home,
  commercial: Building2,
  open_land: LandPlot,
} as const;

const DEFAULT_ASSUMPTIONS: Assumptions = {
  panel: {
    watts: 430,
    length_m: 1.72,
    width_m: 1.13,
    gap_m: 0.1,
  },
  setback_margin_m: 0.9,
  tilt: 20,
  azimuth: 180,
  monthly_bill: 450,
  annual_demand_kwh: 30000,
  electricity_rate_per_kwh: 0.18,
  install_cost_per_watt: 2.8,
  incentive_pct: 0.3,
};

interface PlannerAppProps {
  initialSection?: "map" | "results" | "report";
}

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function emptyMonthly() {
  return Array.from({ length: 12 }, () => 0);
}

export function PlannerApp({ initialSection }: PlannerAppProps) {
  const [address, setAddress] = useState("350 Fifth Avenue, New York, NY");
  const [projectMode, setProjectMode] = useState<ProjectMode>("commercial");
  const [location, setLocation] = useState<LocationResult>({
    address: "350 Fifth Avenue, New York, NY",
    latitude: 40.7484,
    longitude: -73.9857,
    confidence: "default_demo",
  });
  const [polygon, setPolygon] = useState<GeoJsonPolygon | null>(null);
  const [exclusions, setExclusions] = useState<GeoJsonPolygon[]>([]);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [area, setArea] = useState<AreaResult | null>(null);
  const [analyses, setAnalyses] = useState<LayoutAnalysis[]>([]);
  const [activeMode, setActiveMode] = useState<LayoutMode>("max_capacity");
  const [status, setStatus] = useState("Ready to analyze a site.");
  const [isRunning, setIsRunning] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [dataSource, setDataSource] = useState<"backend" | "frontend">("frontend");

  const activeAnalysis = useMemo(
    () => analyses.find((analysis) => analysis.layout.layout_mode === activeMode) ?? analyses[0],
    [activeMode, analyses],
  );

  useEffect(() => {
    if (initialSection) {
      document.getElementById(initialSection)?.scrollIntoView({ block: "start" });
    }
  }, [initialSection]);

  const liveArea = useMemo(
    () => (polygon ? calculateAreaLocal(polygon, exclusions, assumptions.setback_margin_m) : null),
    [assumptions.setback_margin_m, exclusions, polygon],
  );
  const displayArea = area ?? liveArea;

  function updateAssumption<TKey extends keyof Assumptions>(key: TKey, value: Assumptions[TKey]) {
    setAssumptions((current) => ({ ...current, [key]: value }));
    if (key === "setback_margin_m") {
      setArea(null);
    }
  }

  function updatePanel(key: keyof Assumptions["panel"], value: number) {
    setAssumptions((current) => ({
      ...current,
      panel: {
        ...current.panel,
        [key]: value,
      },
    }));
  }

  function applyGeocodeResult(result: LocationResult, source: "backend" | "frontend") {
    setLocation(result);
    setAddress(result.address);
    setPolygon(null);
    setExclusions([]);
    setArea(null);
    setAnalyses([]);
    setActiveMode("max_capacity");
    setDataSource(source);
    window.setTimeout(() => {
      document.getElementById("map")?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
  }

  async function handleGeocode(queryOverride?: string) {
    const query = (queryOverride ?? address).trim();
    if (!query) {
      setStatus("Enter an address before searching.");
      return;
    }

    setIsGeocoding(true);
    setStatus("Locating address...");
    try {
      const result = await postJson<{ address: string }, LocationResult>("/geocode", { address: query });
      applyGeocodeResult(result, "backend");
      setStatus(`Centered map on ${result.address}.`);
    } catch {
      const result = mockGeocode(query);
      applyGeocodeResult(result, "frontend");
      setStatus("Backend geocoding unavailable; using deterministic mock location.");
    } finally {
      setIsGeocoding(false);
    }
  }

  function handleAutocompleteSelect(result: LocationResult) {
    applyGeocodeResult(result, "backend");
    setStatus(`Centered map on ${result.address}.`);
  }

  function handleSampleSite() {
    const nextPolygon = makeRectanglePolygon(location.latitude, location.longitude);
    setPolygon(nextPolygon);
    setExclusions([]);
    setArea(null);
    setAnalyses([]);
    setStatus("Loaded a sample rectangular rooftop around the current address.");
  }

  function handlePolygonChange(nextPolygon: GeoJsonPolygon | null) {
    setPolygon(nextPolygon);
    setArea(null);
    setAnalyses([]);
  }

  function handleExclusionsChange(nextExclusions: GeoJsonPolygon[]) {
    setExclusions(nextExclusions);
    setArea(null);
    setAnalyses([]);
  }

  async function runBackendAnalysis(targetPolygon: GeoJsonPolygon): Promise<{ areaResult: AreaResult; results: LayoutAnalysis[] }> {
    const areaResult = await postJson<
      { polygon: GeoJsonPolygon; exclusion_polygons: GeoJsonPolygon[]; setback_margin_m: number },
      AreaResult
    >("/geometry/area", {
      polygon: targetPolygon,
      exclusion_polygons: exclusions,
      setback_margin_m: assumptions.setback_margin_m,
    });

    const results = await Promise.all(
      LAYOUT_MODES.map(async (mode) => {
        const layout = await postJson<
          {
            project_id: string;
            latitude: number;
            longitude: number;
            polygon: GeoJsonPolygon;
            exclusion_polygons: GeoJsonPolygon[];
            panel: Assumptions["panel"];
            setback_margin_m: number;
            layout_mode: LayoutMode;
            candidate_angles: number[];
            annual_demand_kwh: number;
          },
          LayoutResult
        >("/geometry/optimize-layout", {
          project_id: "proj_demo",
          latitude: location.latitude,
          longitude: location.longitude,
          polygon: targetPolygon,
          exclusion_polygons: exclusions,
          panel: assumptions.panel,
          setback_margin_m: assumptions.setback_margin_m,
          layout_mode: mode,
          candidate_angles: [0, 90],
          annual_demand_kwh: assumptions.annual_demand_kwh,
        });

        const solar = await postJson<
          {
            latitude: number;
            longitude: number;
            system_capacity_kw: number;
            tilt: number;
            azimuth: number;
            losses: number;
          },
          SolarResult
        >("/solar/pvwatts", {
          latitude: location.latitude,
          longitude: location.longitude,
          system_capacity_kw: layout.system_size_kw_dc,
          tilt: assumptions.tilt,
          azimuth: assumptions.azimuth,
          losses: 14,
        });

        const financial = await postJson<
          {
            system_size_kw_dc: number;
            annual_production_kwh: number;
            annual_demand_kwh: number;
            monthly_bill: number;
            electricity_rate_per_kwh: number;
            install_cost_per_watt: number;
            incentive_pct: number;
          },
          FinancialResult
        >("/financial/estimate", {
          system_size_kw_dc: layout.system_size_kw_dc,
          annual_production_kwh: solar.annual_production_kwh,
          annual_demand_kwh: assumptions.annual_demand_kwh,
          monthly_bill: assumptions.monthly_bill,
          electricity_rate_per_kwh: assumptions.electricity_rate_per_kwh,
          install_cost_per_watt: assumptions.install_cost_per_watt,
          incentive_pct: assumptions.incentive_pct,
        });

        return { layout, solar, financial };
      }),
    );

    return { areaResult, results };
  }

  function runFrontendAnalysis(targetPolygon: GeoJsonPolygon): { areaResult: AreaResult; results: LayoutAnalysis[] } {
    const areaResult = calculateAreaLocal(targetPolygon, exclusions, assumptions.setback_margin_m);
    const results = LAYOUT_MODES.map((mode) => {
      const layout = optimizeLayoutLocal(targetPolygon, exclusions, assumptions, mode);
      const solar = estimateSolarLocal(location.latitude, location.longitude, layout.system_size_kw_dc, assumptions);
      const financial = estimateFinancialLocal(layout, solar, assumptions);
      return { layout, solar, financial };
    });
    return { areaResult, results };
  }

  async function handleOptimize() {
    const targetPolygon = polygon ?? makeRectanglePolygon(location.latitude, location.longitude);
    if (!polygon) {
      setPolygon(targetPolygon);
    }

    setIsRunning(true);
    setStatus("Optimizing panel layouts...");
    try {
      const result = await runBackendAnalysis(targetPolygon);
      setArea(result.areaResult);
      setAnalyses(result.results);
      setActiveMode("max_capacity");
      setDataSource("backend");
      setStatus("Generated three layouts with backend geometry, production, and ROI services.");
    } catch {
      const result = runFrontendAnalysis(targetPolygon);
      setArea(result.areaResult);
      setAnalyses(result.results);
      setActiveMode("max_capacity");
      setDataSource("frontend");
      setStatus("Backend unavailable; generated demo layouts with frontend fallback logic.");
    } finally {
      setIsRunning(false);
    }
  }

  function downloadReport() {
    const report = {
      project: {
        address: location.address,
        project_mode: projectMode,
        latitude: location.latitude,
        longitude: location.longitude,
      },
      geometry: displayArea,
      selected_layout: activeAnalysis,
      assumptions,
      disclaimer:
        "SunSight MVP estimates are for early feasibility only and should be validated with detailed engineering, utility, and permitting analysis.",
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sunsight-solar-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const metricArea = displayArea?.usable_area_sq_m ?? 0;
  const activePanels = activeAnalysis?.layout.panels ?? [];
  const monthlyProduction = activeAnalysis?.solar.monthly_production_kwh ?? emptyMonthly();
  const demandOffset = Math.min(activeAnalysis?.financial.demand_offset_pct ?? 0, 100);
  const isLivePvwatts = activeAnalysis?.solar.model_source === "pvwatts_v8";
  const productionSourceLabel = isLivePvwatts ? "PVWatts V8" : "Regional fallback";
  const productionSourceDetail = isLivePvwatts
    ? activeAnalysis?.solar.weather_data_source ?? "NLR solar resource data"
    : activeAnalysis?.solar.fallback_reason?.replaceAll("_", " ") ?? "Production model pending";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[1000] border-b border-white/7 bg-[#07090c]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="SunSight home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sun className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.02em] text-zinc-50">SunSight</span>
              <span className="hidden text-[10px] uppercase tracking-[0.18em] text-zinc-600 sm:block">Solar intelligence</span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 rounded-xl border border-white/7 bg-white/[0.025] p-1 md:flex" aria-label="Planner sections">
            <a href="#map" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/6 hover:text-white">
              Site plan
            </a>
            <a href="#results" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-white/6 hover:text-white">
              Analysis
            </a>
            <a href="#report" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-white/6 hover:text-white">
              Report
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
              <span className={cn("h-1.5 w-1.5 rounded-full", dataSource === "backend" ? "bg-emerald-400" : "bg-amber-300")} />
              {dataSource === "backend" ? "Services online" : "Local fallback"}
            </span>
            <Button type="button" className="min-h-9 px-3" variant="ghost" onClick={handleSampleSite}>
              New analysis
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-end lg:py-14">
          <div>
            <Badge className="border-primary/20 bg-primary/8 text-primary">
              <Sparkles className="mr-1.5 h-3 w-3" />
              Solar feasibility workspace
            </Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-medium tracking-[-0.055em] text-zinc-50 sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]">
              Plan the site.
              <br />
              See the return.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
              Turn a rooftop or parcel into an optimized solar layout, production forecast, and financial case in
              one clean planning flow.
            </p>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-[20px] border border-white/8 bg-white/[0.025]">
            {[
              { number: "01", label: "Select site", icon: Map },
              { number: "02", label: "Fit panels", icon: PanelTop },
              { number: "03", label: "Model return", icon: BarChart3 },
            ].map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div key={step.number} className={cn("p-4 sm:p-5", index > 0 && "border-l border-white/8")}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-zinc-600">{step.number}</span>
                    <StepIcon className="h-4 w-4 text-zinc-600" />
                  </div>
                  <p className="mt-4 text-xs font-medium text-zinc-300 sm:text-sm">{step.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="map" className="grid scroll-mt-24 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <Card>
              <CardHeader>
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    <span>Step 01</span>
                    <span className="h-px w-5 bg-primary/40" />
                    <span>Site</span>
                  </div>
                  <CardTitle>Site details</CardTitle>
                  <CardDescription>Choose a location and project type.</CardDescription>
                </div>
                <MapPin className="h-4 w-4 text-zinc-600" />
              </CardHeader>

              <div className="space-y-5">
                <AddressAutocomplete
                  value={address}
                  latitude={location.latitude}
                  longitude={location.longitude}
                  disabled={isGeocoding}
                  onValueChange={setAddress}
                  onLocationSelect={handleAutocompleteSelect}
                  onSubmit={handleGeocode}
                />

                <div>
                  <span className="mb-2 block text-xs font-medium text-zinc-400">Project type</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(MODE_SHORT_LABELS) as ProjectMode[]).map((mode) => {
                      const ModeIcon = MODE_ICONS[mode];
                      const selected = projectMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setProjectMode(mode)}
                          className={cn(
                            "flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-xl border px-2 text-[11px] font-medium transition",
                            selected
                              ? "border-primary/35 bg-primary/8 text-zinc-100"
                              : "border-white/7 bg-black/15 text-zinc-500 hover:border-white/12 hover:text-zinc-300",
                          )}
                        >
                          <ModeIcon className={cn("h-4 w-4", selected ? "text-primary" : "text-zinc-600")} />
                          {MODE_SHORT_LABELS[mode]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between border-y border-white/7 py-3 text-xs">
                  <span className="text-zinc-600">Coordinates</span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="ghost" onClick={handleSampleSite}>
                    Load sample
                  </Button>
                  <Button type="button" onClick={handleOptimize} disabled={isRunning}>
                    <Zap className="mr-2 h-3.5 w-3.5" />
                    {isRunning ? "Running..." : "Optimize"}
                  </Button>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.025] px-3 py-2.5 text-xs leading-5 text-zinc-500">
                  <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  <span>{status}</span>
                </div>
              </div>
            </Card>

            <details className="glass-card group rounded-[22px]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-zinc-500">
                    <SlidersHorizontal className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Engineering assumptions</p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">Panel, demand, and financial inputs</p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-zinc-600 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-white/7 px-5 pb-5 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Panel watts", value: assumptions.panel.watts, step: "1", change: (value: number) => updatePanel("watts", value), fallback: 430 },
                    { label: "Setback m", value: assumptions.setback_margin_m, step: "0.1", change: (value: number) => updateAssumption("setback_margin_m", value), fallback: 0.9 },
                    { label: "Monthly bill", value: assumptions.monthly_bill, step: "1", change: (value: number) => updateAssumption("monthly_bill", value), fallback: 450 },
                    { label: "Annual kWh", value: assumptions.annual_demand_kwh, step: "1", change: (value: number) => updateAssumption("annual_demand_kwh", value), fallback: 30000 },
                    { label: "Rate $/kWh", value: assumptions.electricity_rate_per_kwh, step: "0.01", change: (value: number) => updateAssumption("electricity_rate_per_kwh", value), fallback: 0.18 },
                    { label: "Cost $/W", value: assumptions.install_cost_per_watt, step: "0.1", change: (value: number) => updateAssumption("install_cost_per_watt", value), fallback: 2.8 },
                    { label: "Tilt", value: assumptions.tilt, step: "1", change: (value: number) => updateAssumption("tilt", value), fallback: 20 },
                    { label: "Azimuth", value: assumptions.azimuth, step: "1", change: (value: number) => updateAssumption("azimuth", value), fallback: 180 },
                  ].map((field) => (
                    <label key={field.label} className="block">
                      <span className="mb-1.5 block text-[11px] text-zinc-500">{field.label}</span>
                      <Input
                        type="number"
                        step={field.step}
                        value={field.value}
                        onChange={(event) => field.change(numberValue(event.target.value, field.fallback))}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </details>
          </aside>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[#101318] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
              <div className="flex flex-col gap-3 border-b border-white/7 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-100">{location.address}</h2>
                    <Badge>{MODE_LABELS[projectMode]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">Satellite imagery · editable geometry · panel overlay</p>
                </div>
                <div className="flex items-center gap-2">
                  {displayArea ? <Badge>{formatNumber(displayArea.usable_area_sq_m)} m² usable</Badge> : null}
                  <Badge className={polygon ? "border-emerald-400/20 text-emerald-300" : ""}>
                    {polygon ? "Boundary ready" : "Awaiting boundary"}
                  </Badge>
                </div>
              </div>
              <SiteMap
                center={location}
                polygon={polygon}
                exclusions={exclusions}
                panels={activePanels}
                onPolygonChange={handlePolygonChange}
                onExclusionsChange={handleExclusionsChange}
              />
              <div className="grid gap-px border-t border-white/7 bg-white/7 sm:grid-cols-2 xl:grid-cols-4">
                <div className="bg-[#101318] p-3">
                  <MetricCard
                    label="Usable Area"
                    value={`${formatNumber(metricArea, 0)} m²`}
                    detail={displayArea ? `${formatNumber(displayArea.gross_area_sq_ft, 0)} gross ft²` : "Draw or load a site"}
                    icon={<PanelTop className="h-4 w-4" />}
                    tone="blue"
                  />
                </div>
                <div className="bg-[#101318] p-3">
                  <MetricCard
                    label="Panels Fit"
                    value={formatNumber(activeAnalysis?.layout.panel_count ?? 0)}
                    detail={activeAnalysis ? LAYOUT_LABELS[activeAnalysis.layout.layout_mode] : "No layout yet"}
                    icon={<PanelTop className="h-4 w-4" />}
                    tone="yellow"
                  />
                </div>
                <div className="bg-[#101318] p-3">
                  <MetricCard
                    label="System Size"
                    value={`${formatNumber(activeAnalysis?.layout.system_size_kw_dc ?? 0, 1)} kW`}
                    detail={`${formatNumber(activeAnalysis?.layout.coverage_ratio ? activeAnalysis.layout.coverage_ratio * 100 : 0)}% coverage`}
                    icon={<Zap className="h-4 w-4" />}
                    tone="green"
                  />
                </div>
                <div className="bg-[#101318] p-3">
                  <MetricCard
                    label="Payback"
                    value={activeAnalysis?.financial.simple_payback_years ? `${activeAnalysis.financial.simple_payback_years} yr` : "—"}
                    detail={activeAnalysis ? `${formatCurrency(activeAnalysis.financial.annual_savings)} / year` : "Run optimizer"}
                    icon={<BatteryCharging className="h-4 w-4" />}
                    tone="violet"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="results" className="scroll-mt-24 py-16">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                <span>Step 02–03</span>
                <span className="h-px w-5 bg-primary/40" />
                <span>Analysis</span>
              </div>
              <h2 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-zinc-50">Capacity, production, and return</h2>
              <p className="mt-2 text-sm text-zinc-500">Compare layout strategies and review the financial case.</p>
            </div>
            {activeAnalysis ? (
              <Badge
                className={
                  isLivePvwatts
                    ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-200"
                    : "border-primary/20 bg-primary/8 text-primary"
                }
              >
                {productionSourceLabel}
              </Badge>
            ) : null}
          </div>

          {!activeAnalysis ? (
            <Card className="subtle-grid flex min-h-[320px] items-center justify-center text-center">
              <div className="max-w-md px-4">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/8 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-medium text-zinc-100">Your analysis will appear here</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Define a site boundary, confirm the assumptions, and run the optimizer to compare capacity,
                  production, savings, and payback.
                </p>
                <Button type="button" className="mt-5" onClick={handleOptimize} disabled={isRunning}>
                  Run first analysis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_390px]">
              <Card>
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Layout comparison</CardTitle>
                    <CardDescription>Switch strategies without changing the selected site.</CardDescription>
                  </div>
                  <div className="flex rounded-xl border border-white/7 bg-black/20 p-1">
                    {LAYOUT_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={activeMode === mode}
                        onClick={() => setActiveMode(mode)}
                        className={cn(
                          "rounded-lg px-3 py-2 text-xs font-medium transition",
                          activeMode === mode ? "bg-zinc-100 text-zinc-950" : "text-zinc-500 hover:text-zinc-200",
                        )}
                      >
                        {LAYOUT_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Annual Gen"
                    value={`${formatNumber(activeAnalysis.solar.annual_production_kwh)} kWh`}
                    detail={productionSourceDetail}
                    tone="yellow"
                  />
                  <MetricCard
                    label="Offset"
                    value={formatPercent(demandOffset)}
                    detail={`${formatNumber(activeAnalysis.financial.annual_demand_kwh)} kWh demand`}
                    tone="blue"
                  />
                  <MetricCard
                    label="Net Cost"
                    value={formatCurrency(activeAnalysis.financial.net_install_cost)}
                    detail={`${formatPercent(assumptions.incentive_pct * 100)} incentive`}
                    tone="violet"
                  />
                  <MetricCard
                    label="CO₂ Avoided"
                    value={`${formatNumber(activeAnalysis.financial.co2_avoided_tons_per_year, 1)} t`}
                    detail="Annual displacement"
                    tone="green"
                  />
                </div>

                {!isLivePvwatts ? (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.055] p-3.5 text-xs leading-5 text-zinc-400">
                    <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    This run used SunSight&apos;s regional production fallback. Add a PVWatts API key for live NLR
                    solar-resource modeling.
                  </div>
                ) : null}

                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <div className="overflow-hidden rounded-2xl border border-white/7 bg-black/15 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-200">Monthly production</h3>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">kWh</span>
                    </div>
                    <ProductionChart monthlyProduction={monthlyProduction} />
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-white/7 bg-black/15 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-200">Strategy comparison</h3>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Panels / kW</span>
                    </div>
                    <LayoutComparison analyses={analyses} />
                  </div>
                </div>
              </Card>

              <Card id="report" className="scroll-mt-24">
                <CardHeader>
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                      <FileText className="h-3 w-3" />
                      Report
                    </div>
                    <CardTitle>Feasibility summary</CardTitle>
                    <CardDescription>Ready to share or continue refining.</CardDescription>
                  </div>
                  <Download className="h-4 w-4 text-zinc-600" />
                </CardHeader>

                <div className="space-y-5">
                  <div className="border-b border-white/7 pb-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Selected site</p>
                    <p className="mt-2 text-base font-medium leading-6 text-zinc-100">{location.address}</p>
                    <p className="mt-1 text-xs text-zinc-500">{MODE_LABELS[projectMode]}</p>
                  </div>

                  <dl className="space-y-3">
                    {[
                      { label: "Layout", value: `${activeAnalysis.layout.panel_count} panels`, icon: Factory },
                      { label: "System", value: `${formatNumber(activeAnalysis.layout.system_size_kw_dc, 1)} kW DC`, icon: Zap },
                      { label: "Annual savings", value: formatCurrency(activeAnalysis.financial.annual_savings), icon: Leaf },
                      { label: "25-year value", value: formatCurrency(activeAnalysis.financial.twenty_five_year_savings), icon: BarChart3 },
                    ].map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.025] px-3.5 py-3">
                          <dt className="flex items-center gap-2 text-xs text-zinc-500">
                            <ItemIcon className="h-3.5 w-3.5" />
                            {item.label}
                          </dt>
                          <dd className="font-mono text-sm text-zinc-200">{item.value}</dd>
                        </div>
                      );
                    })}
                  </dl>

                  <p className="text-xs leading-5 text-zinc-600">
                    Early feasibility estimate based on selected geometry, current assumptions, and simplified
                    utility economics. Validate with site engineering before procurement.
                  </p>

                  <Button type="button" className="w-full" onClick={downloadReport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export JSON report
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/7 py-7 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>SunSight · AI-assisted solar feasibility planning</span>
          <span>Human-correctable geometry · PVWatts-ready modeling</span>
        </footer>
      </main>
    </div>
  );
}
