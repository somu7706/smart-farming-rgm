import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Navigation, MapPin, Loader2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { GeocodedAddress, normalizeNominatimAddress } from "./addressUtils";
export type { GeocodedAddress };
export { normalizeNominatimAddress };

// Fix standard Leaflet marker icons in React Vite bundler
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const deliveryPinIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationSelect: (data: GeocodedAddress) => void;
  height?: string;
}

interface PlaceSuggestion {
  id: string | number;
  mainText: string;
  secondaryText: string;
  lat: number;
  lng: number;
  rawAddress?: any;
  displayName: string;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Controller to smoothly pan the map and handle container resizing
const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 1.0 });
  }, [center, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  return null;
};

// Map click listener component
const MapClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export const LocationPickerMap = ({
  initialLat,
  initialLng,
  onLocationSelect,
  height = "240px",
}: LocationPickerProps) => {
  // Default to Vijayawada / Andhra Pradesh center if none provided
  const defaultPos: [number, number] = [initialLat || 16.5062, initialLng || 80.648];
  const [markerPos, setMarkerPos] = useState<[number, number]>(defaultPos);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);

  const markerRef = useRef<L.Marker>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const currentReqSeqRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const ignoreNextSearchDebounceRef = useRef<boolean>(false);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Perform reverse geocoding with stale response prevention
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      // Avoid calling geocoder repeatedly if coords have not meaningfully shifted (> 5 meters)
      if (
        lastCoordsRef.current &&
        getDistanceKm(lat, lng, lastCoordsRef.current.lat, lastCoordsRef.current.lng) < 0.005
      ) {
        return;
      }

      const reqId = ++currentReqSeqRef.current;
      setGeocoding(true);
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const res = await fetch(url, {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "AgriAssist-App/1.0",
          },
        });

        // Discard stale response if a newer request began
        if (reqId !== currentReqSeqRef.current) return;

        if (res.ok) {
          const data = await res.json();
          lastCoordsRef.current = { lat, lng };
          const normalized = normalizeNominatimAddress(lat, lng, data.address, data.display_name);
          onLocationSelect(normalized);
        } else {
          onLocationSelect({ lat, lng });
        }
      } catch (err) {
        console.warn("[LocationPicker] Reverse geocoding network note:", err);
        if (reqId === currentReqSeqRef.current) {
          onLocationSelect({ lat, lng });
        }
      } finally {
        if (reqId === currentReqSeqRef.current) {
          setGeocoding(false);
        }
      }
    },
    [onLocationSelect]
  );

  // Debounced autocomplete search on input change
  useEffect(() => {
    if (ignoreNextSearchDebounceRef.current) {
      ignoreNextSearchDebounceRef.current = false;
      return;
    }

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=in&limit=5&addressdetails=1`;
        const res = await fetch(url, {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "AgriAssist-App/1.0",
          },
        });

        if (res.ok) {
          const results = await res.json();
          const parsed: PlaceSuggestion[] = (results || []).map((r: any) => {
            const parts = (r.display_name || "").split(",").map((s: string) => s.trim());
            const mainText = r.name || parts[0] || "Unknown Place";
            const secondaryText = parts.slice(1).join(", ");
            return {
              id: r.place_id,
              mainText,
              secondaryText,
              lat: parseFloat(r.lat),
              lng: parseFloat(r.lon),
              rawAddress: r.address,
              displayName: r.display_name,
            };
          });

          setSuggestions(parsed);
          setShowSuggestions(parsed.length > 0);
        }
      } catch (err) {
        console.warn("[LocationPicker] Autocomplete search note:", err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle suggestion selection from autocomplete dropdown
  const handleSelectSuggestion = (item: PlaceSuggestion) => {
    ignoreNextSearchDebounceRef.current = true;
    setSearchQuery(item.mainText);
    setShowSuggestions(false);
    setSuggestions([]);
    setMarkerPos([item.lat, item.lng]);

    // Fast autofill from search result address details
    if (item.rawAddress) {
      const normalized = normalizeNominatimAddress(
        item.lat,
        item.lng,
        item.rawAddress,
        item.displayName
      );
      onLocationSelect(normalized);
      lastCoordsRef.current = { lat: item.lat, lng: item.lng };
    }

    // Also trigger reverse geocoding to resolve ultra-local road details
    reverseGeocode(item.lat, item.lng);
    toast.success(`Location set: ${item.mainText}`);
  };

  const handleMarkerDragEnd = useCallback(() => {
    const marker = markerRef.current;
    if (marker) {
      const { lat, lng } = marker.getLatLng();
      setMarkerPos([lat, lng]);
      reverseGeocode(lat, lng);
    }
  }, [reverseGeocode]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      setMarkerPos([lat, lng]);
      reverseGeocode(lat, lng);
    },
    [reverseGeocode]
  );

  // Search places on Enter press or Search button
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setShowSuggestions(false);
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery.trim()
      )}&countrycodes=in&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "AgriAssist-App/1.0" },
      });

      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const first = results[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          setMarkerPos([lat, lng]);
          const normalized = normalizeNominatimAddress(lat, lng, first.address, first.display_name);
          onLocationSelect(normalized);
          lastCoordsRef.current = { lat, lng };
          reverseGeocode(lat, lng);
          toast.success("Location found on map!");
        } else {
          toast.error("Location not found. Try searching with a nearby city or PIN code.");
        }
      }
    } catch (err) {
      toast.error("Search error. You can click on the map directly.");
    } finally {
      setSearching(false);
    }
  };

  // Browser Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerPos([lat, lng]);
        reverseGeocode(lat, lng);
        toast.success("Marker moved to your current location!");
      },
      (err) => {
        setLocating(false);
        console.warn("Geolocation denied/failed:", err);
        toast.info("Location permission not granted. You can search or tap on the map.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      {/* Search & GPS Controls with Autocomplete Dropdown */}
      <div className="flex flex-col sm:flex-row gap-2 relative z-[1000]">
        <div ref={searchContainerRef} className="relative flex-1">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder="Search village, city, locality, or 6-digit PIN"
            className="text-xs h-9 pr-14 w-full"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearchSubmit(e);
              } else if (e.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
          />
          <div className="absolute right-1 top-1 flex items-center gap-0.5">
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSearchSubmit}
              disabled={searching}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label="Search location"
            >
              {searching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl z-[1050] max-h-56 overflow-y-auto">
              <div className="p-1">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left p-2.5 hover:bg-muted/80 rounded-md flex items-start gap-2.5 transition-colors border-b last:border-b-0 border-border/40"
                  >
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-foreground truncate">
                        {item.mainText}
                      </p>
                      {item.secondaryText && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {item.secondaryText}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="text-xs h-9 gap-1.5 whitespace-nowrap shrink-0 justify-center"
        >
          {locating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-primary" />
          )}
          <span>Use My Location</span>
        </Button>
      </div>

      {/* Embedded Leaflet Map */}
      <div
        className="rounded-lg overflow-hidden border border-border shadow-inner relative w-full min-w-0"
        style={{ height }}
      >
        <MapContainer
          center={markerPos}
          zoom={14}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController center={markerPos} />
          <MapClickHandler onMapClick={handleMapClick} />
          <Marker
            ref={markerRef}
            position={markerPos}
            draggable={true}
            icon={deliveryPinIcon}
            eventHandlers={{ dragend: handleMarkerDragEnd }}
          />
        </MapContainer>

        {/* Status / Instructions Overlay */}
        <div className="absolute bottom-2 left-2 z-[400] flex items-center gap-1.5 bg-background/90 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] shadow-sm border border-border/60 max-w-[70%] sm:max-w-[80%] truncate">
          <MapPin className="w-3 h-3 text-primary shrink-0" />
          {geocoding ? (
            <span className="flex items-center gap-1 text-primary font-medium truncate">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" /> Resolving address...
            </span>
          ) : (
            <span className="text-muted-foreground truncate">
              Tap map or drag marker to update address
            </span>
          )}
        </div>

        {/* Coordinates Pill */}
        <div className="absolute top-2 right-2 z-[400]">
          <Badge variant="secondary" className="bg-background/90 text-[10px] font-mono shadow-sm">
            {markerPos[0].toFixed(4)}, {markerPos[1].toFixed(4)}
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerMap;
