"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Building2, CornerDownLeft, Loader2, MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/api";
import { geocodeLocalSuggestion, searchLocalPlaceSuggestions } from "@/lib/mock-analysis";
import type { GeocodeSuggestion, GeocodeSuggestResponse, LocationResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  value: string;
  latitude: number;
  longitude: number;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  onLocationSelect: (result: LocationResult) => void;
  onSubmit: (query: string) => Promise<void>;
}

function createSessionToken() {
  return globalThis.crypto?.randomUUID?.() ?? `sunsight-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AddressAutocomplete({
  value,
  latitude,
  longitude,
  disabled = false,
  onValueChange,
  onLocationSelect,
  onSubmit,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestVersionRef = useRef(0);
  const sessionTokenRef = useRef(createSessionToken());
  const suppressQueryRef = useRef<string | null>(null);
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    const query = value.trim();
    if (!hasInteractedRef.current) {
      return;
    }
    if (suppressQueryRef.current === query) {
      suppressQueryRef.current = null;
      return;
    }
    if (query.length < 2) {
      return;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const timeout = window.setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const result = await postJson<
          {
            query: string;
            session_token: string;
            latitude: number;
            longitude: number;
            limit: number;
          },
          GeocodeSuggestResponse
        >("/geocode/suggest", {
          query,
          session_token: sessionTokenRef.current,
          latitude,
          longitude,
          limit: 6,
        });
        if (requestVersionRef.current !== requestVersion) {
          return;
        }
        setSuggestions(result.suggestions);
        setProvider(result.provider);
        setActiveIndex(result.suggestions.length > 0 ? 0 : -1);
        setIsOpen(result.suggestions.length > 0);
      } catch {
        if (requestVersionRef.current === requestVersion) {
          const localSuggestions = searchLocalPlaceSuggestions(query, 6);
          setSuggestions(localSuggestions);
          setProvider(localSuggestions.length > 0 ? "frontend_demo" : "unavailable");
          setActiveIndex(localSuggestions.length > 0 ? 0 : -1);
          setIsOpen(localSuggestions.length > 0);
        }
      } finally {
        if (requestVersionRef.current === requestVersion) {
          setIsSuggesting(false);
        }
      }
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [latitude, longitude, value]);

  async function selectSuggestion(suggestion: GeocodeSuggestion) {
    setIsSelecting(true);
    setIsOpen(false);
    suppressQueryRef.current = suggestion.full_address;
    onValueChange(suggestion.full_address);
    try {
      const result = await postJson<
        { suggestion_id: string; session_token: string },
        LocationResult
      >("/geocode/retrieve", {
        suggestion_id: suggestion.suggestion_id,
        session_token: sessionTokenRef.current,
      });
      suppressQueryRef.current = result.address;
      onLocationSelect(result);
      sessionTokenRef.current = createSessionToken();
    } catch {
      const localResult = geocodeLocalSuggestion(suggestion.suggestion_id);
      if (localResult) {
        suppressQueryRef.current = localResult.address;
        onLocationSelect(localResult);
      } else {
        await onSubmit(suggestion.full_address);
      }
    } finally {
      setIsSelecting(false);
    }
  }

  async function submitQuery(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setIsOpen(false);
    suppressQueryRef.current = value.trim();
    await onSubmit(value);
  }

  function handleValueChange(nextValue: string) {
    hasInteractedRef.current = true;
    onValueChange(nextValue);
    if (nextValue.trim().length < 2) {
      requestVersionRef.current += 1;
      setSuggestions([]);
      setProvider(null);
      setActiveIndex(-1);
      setIsOpen(false);
      setIsSuggesting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "Enter" && isOpen && activeIndex >= 0) {
      event.preventDefault();
      void selectSuggestion(suggestions[activeIndex]);
    }
  }

  const busy = disabled || isSelecting;
  const providerLabel =
    provider === "mapbox_searchbox"
      ? "Powered by Mapbox"
      : provider?.includes("demo")
        ? "Demo locations · add Mapbox token for full search"
        : null;

  return (
    <form className="relative" onSubmit={submitQuery}>
      <label htmlFor="site-address" className="mb-2 block text-xs font-medium text-zinc-400">
        Address or place
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input
            id="site-address"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls="address-suggestions"
            aria-activedescendant={isOpen && activeIndex >= 0 ? `address-suggestion-${activeIndex}` : undefined}
            className="pl-10 pr-10"
            value={value}
            onChange={(event) => handleValueChange(event.target.value)}
            onFocus={() => setIsOpen(suggestions.length > 0)}
            onBlur={() =>
              window.setTimeout(() => {
                setIsOpen(false);
              }, 120)
            }
            onKeyDown={handleKeyDown}
            placeholder="Search an address, campus, or landmark"
            autoComplete="off"
            disabled={busy}
          />
          {isSuggesting || isSelecting ? (
            <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
          ) : null}
        </div>
        <Button
          type="submit"
          className="w-11 shrink-0 px-0 sm:w-auto sm:px-4"
          disabled={busy || !value.trim()}
          aria-label="Search address"
        >
          {isSelecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">{isSelecting ? "Opening" : "Search"}</span>
        </Button>
      </div>

      {isOpen ? (
        <div
          id="address-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-[72px] z-[1200] overflow-hidden rounded-2xl border border-white/10 bg-[#101318]/98 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          {suggestions.map((suggestion, index) => (
            <button
              id={`address-suggestion-${index}`}
              key={suggestion.suggestion_id}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition",
                activeIndex === index ? "bg-primary/10" : "hover:bg-white/[0.045]",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => void selectSuggestion(suggestion)}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                  activeIndex === index
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-white/8 bg-white/[0.035] text-zinc-500",
                )}
              >
                {suggestion.feature_type === "poi" ? (
                  <Building2 className="h-3.5 w-3.5" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-100">{suggestion.name}</span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500">
                  {suggestion.place_formatted ?? suggestion.full_address}
                </span>
              </span>
              {activeIndex === index ? <CornerDownLeft className="mt-2 h-3.5 w-3.5 text-zinc-600" /> : null}
            </button>
          ))}
          {providerLabel ? (
            <div className="border-t border-white/7 px-3 py-2 text-[10px] uppercase tracking-[0.13em] text-zinc-600">
              {providerLabel}
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
