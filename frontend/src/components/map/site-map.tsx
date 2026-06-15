"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, Check, LocateFixed, MousePointer2, RotateCcw, Trash2 } from "lucide-react";
import type * as Leaflet from "leaflet";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GeoJsonPolygon, LngLat, PanelPlacement } from "@/lib/types";

interface SiteMapProps {
  center: { latitude: number; longitude: number };
  polygon: GeoJsonPolygon | null;
  exclusions: GeoJsonPolygon[];
  panels: PanelPlacement[];
  onPolygonChange: (polygon: GeoJsonPolygon | null) => void;
  onExclusionsChange: (polygons: GeoJsonPolygon[]) => void;
}

type DrawMode = "site" | "exclusion" | null;

function closeRing(ring: LngLat[]) {
  if (ring.length === 0) {
    return ring;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

function polygonFromDraft(draft: LngLat[]): GeoJsonPolygon {
  return {
    type: "Polygon",
    coordinates: [closeRing(draft)],
  };
}

function toLatLngs(polygon: GeoJsonPolygon): [number, number][][] {
  return polygon.coordinates.map((ring) => ring.map(([longitude, latitude]) => [latitude, longitude]));
}

function panelToPolygon(panel: PanelPlacement): GeoJsonPolygon {
  return {
    type: "Polygon",
    coordinates: panel.coordinates,
  };
}

export function SiteMap({
  center,
  polygon,
  exclusions,
  panels,
  onPolygonChange,
  onExclusionsChange,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerGroupRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const initialCenterRef = useRef(center);
  const drawModeRef = useRef<DrawMode>(null);
  const draftRef = useRef<LngLat[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let mounted = true;

    async function setupMap() {
      const L = await import("leaflet");
      if (!mounted || !containerRef.current || mapRef.current) {
        return;
      }

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([initialCenterRef.current.latitude, initialCenterRef.current.longitude], 19);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          maxZoom: 20,
        },
      ).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapRef.current = map;

      map.on("click", (event: Leaflet.LeafletMouseEvent) => {
        if (!drawModeRef.current) {
          return;
        }
        const nextPoint: LngLat = [event.latlng.lng, event.latlng.lat];
        const nextDraft = [...draftRef.current, nextPoint];
        draftRef.current = nextDraft;
        setDraft(nextDraft);
      });

      setLeafletReady(true);
    }

    setupMap();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    setDraft([]);
    draftRef.current = [];
    setDrawMode(null);
    drawModeRef.current = null;
    map.setView([center.latitude, center.longitude], Math.max(map.getZoom(), 18));
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const L = leafletRef.current;
    const layerGroup = layerGroupRef.current;
    if (!L || !layerGroup || !leafletReady) {
      return;
    }

    layerGroup.clearLayers();

    L.circleMarker([center.latitude, center.longitude], {
      radius: 7,
      color: "#17160c",
      fillColor: "#f5d547",
      fillOpacity: 0.85,
      weight: 2,
    }).addTo(layerGroup);

    if (polygon) {
      L.polygon(toLatLngs(polygon), {
        color: "#f5d547",
        fillColor: "#f5d547",
        fillOpacity: 0.12,
        weight: 3,
      }).addTo(layerGroup);
    }

    exclusions.forEach((exclusion) => {
      L.polygon(toLatLngs(exclusion), {
        color: "#fb7185",
        fillColor: "#fb7185",
        fillOpacity: 0.26,
        weight: 2,
      }).addTo(layerGroup);
    });

    panels.forEach((panel) => {
      L.polygon(toLatLngs(panelToPolygon(panel)), {
        color: "#d7f0ff",
        fillColor: "#8ccff1",
        fillOpacity: 0.3,
        weight: 1,
      }).addTo(layerGroup);
    });

    if (draft.length > 0) {
      const latLngs = draft.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
      L.polyline(latLngs, {
        color: drawMode === "exclusion" ? "#fb7185" : "#f5d547",
        dashArray: "8,8",
        weight: 2,
      }).addTo(layerGroup);
      latLngs.forEach((latLng) => {
        L.circleMarker(latLng, {
          radius: 4,
          color: "#ffffff",
          fillColor: drawMode === "exclusion" ? "#fb7185" : "#f5d547",
          fillOpacity: 1,
          weight: 1,
        }).addTo(layerGroup);
      });
    }
  }, [center.latitude, center.longitude, drawMode, draft, exclusions, leafletReady, panels, polygon]);

  function startDrawing(mode: Exclude<DrawMode, null>) {
    setDraft([]);
    draftRef.current = [];
    setDrawMode(mode);
  }

  function finishDrawing() {
    if (draft.length < 3 || !drawMode) {
      return;
    }
    const nextPolygon = polygonFromDraft(draft);
    if (drawMode === "site") {
      onPolygonChange(nextPolygon);
    } else {
      onExclusionsChange([...exclusions, nextPolygon]);
    }
    setDraft([]);
    draftRef.current = [];
    setDrawMode(null);
  }

  function undoPoint() {
    const nextDraft = draft.slice(0, -1);
    setDraft(nextDraft);
    draftRef.current = nextDraft;
  }

  function clearAll() {
    setDraft([]);
    draftRef.current = [];
    setDrawMode(null);
    onPolygonChange(null);
    onExclusionsChange([]);
  }

  return (
    <div>
      <div className="relative z-10 border-b border-white/8 bg-[#0b0d10] p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-100">
              <LocateFixed className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Site canvas</span>
              {draft.length > 0 ? (
                <Badge className="border-white/10 bg-white/[0.04] text-zinc-300">
                  {draft.length} {draft.length === 1 ? "vertex" : "vertices"}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[11px] text-zinc-400">
              {drawMode
                ? `Placing ${drawMode === "site" ? "site boundary" : "exclusion"} vertices`
                : polygon
                  ? "Boundary ready for optimization"
                  : "Draw a boundary or load the sample site"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-9 px-3"
              variant={drawMode === "site" ? "primary" : "ghost"}
              aria-pressed={drawMode === "site"}
              onClick={() => startDrawing("site")}
            >
              <MousePointer2 className="mr-2 h-3.5 w-3.5" />
              Draw boundary
            </Button>
            <Button
              type="button"
              className="min-h-9 px-3"
              variant={drawMode === "exclusion" ? "danger" : "ghost"}
              aria-pressed={drawMode === "exclusion"}
              onClick={() => startDrawing("exclusion")}
              disabled={!polygon}
            >
              <Ban className="mr-2 h-3.5 w-3.5" />
              Exclusion
            </Button>
            <Button
              type="button"
              className="min-h-9 px-3"
              variant="secondary"
              onClick={finishDrawing}
              disabled={draft.length < 3}
            >
              <Check className="mr-2 h-3.5 w-3.5" />
              Finish
            </Button>
            <Button
              type="button"
              className="min-h-9 px-3"
              variant="ghost"
              onClick={undoPoint}
              disabled={draft.length === 0}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Undo
            </Button>
            <Button type="button" className="min-h-9 px-3 text-zinc-500" variant="ghost" onClick={clearAll}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="relative isolate h-[520px] overflow-hidden map-shell sm:h-[600px] lg:h-[640px]">
        <div ref={containerRef} className="absolute inset-0 z-0" />
      </div>
    </div>
  );
}
