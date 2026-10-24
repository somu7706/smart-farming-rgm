import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Navigation, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

export interface GeocodedAddress {
  lat: number;
  lng: number;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  street?: string;
  displayName?: string;
}

interface LocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationSelect: (data: GeocodedAddress) => void;
  height?: string;
}

// Controller to smoothly pan the map and handle container resizing
const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 1.2 });
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
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const markerRef = useRef<L.Marker>(null);

  // Perform reverse geocoding using OpenStreetMap Nominatim
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      setGeocoding(true);
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const res = await fetch(url, {
          headers: {
            "Accept-Language": "en",
          },
        });

        if (res.ok) {
          const data = await res.json();
          const addr = data.address || {};

          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.suburb ||
            addr.municipality ||
            "";

          const district =
            addr.state_district ||
            addr.county ||
            addr.district ||
            city ||
            "";

          const state = addr.state || "";
          const pincode = addr.postcode || "";
          const street =
            [addr.road, addr.neighbourhood, addr.residential].filter(Boolean).join(", ") ||
            data.display_name?.split(",").slice(0, 2).join(",") ||
            "";

          onLocationSelect({
            lat,
            lng,
            city,
            district,
            state,
            pincode,
            street,
            displayName: data.display_name,
          });
        } else {
          onLocationSelect({ lat, lng });
        }
      } catch (err) {
        console.warn("[LocationPicker] Reverse geocoding note:", err);
        onLocationSelect({ lat, lng });
      } finally {
        setGeocoding(false);
      }
    },
    [onLocationSelect]
  );

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

  // Search places via Nominatim
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery.trim()
      )}&countrycodes=in&limit=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" },
      });

      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const first = results[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          setMarkerPos([lat, lng]);
          reverseGeocode(lat, lng);
          toast.success("Location found on map!");
        } else {
          toast.error("Location not found. Try searching with city or PIN code.");
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
      {/* Search & GPS Controls (Responsive Flex) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search village, city, locality, or 6-digit PIN"
            className="text-xs h-9 pr-8 w-full"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch(e);
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSearch}
            disabled={searching}
            className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            aria-label="Search location"
          >
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="text-xs h-9 gap-1.5 whitespace-nowrap shrink-0 justify-center"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-primary" />}
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
        <div className="absolute bottom-2 left-2 z-[400] flex items-center gap-1.5 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-[11px] shadow-sm border border-border/60 max-w-[70%] sm:max-w-[80%] truncate">
          <MapPin className="w-3 h-3 text-primary shrink-0 animate-pulse" />
          {geocoding ? (
            <span className="flex items-center gap-1 text-muted-foreground truncate">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" /> Locating address...
            </span>
          ) : (
            <span className="text-muted-foreground truncate">
              Tap map or drag marker to set delivery entrance
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
