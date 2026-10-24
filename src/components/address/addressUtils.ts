export interface GeocodedAddress {
  lat: number;
  lng: number;
  houseNo?: string;
  street?: string;
  locality?: string;
  subdistrict?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  country?: string;
  displayName?: string;
}

/**
 * Normalizes OpenStreetMap Nominatim address components into structured fields
 * with specialized handling for Indian addresses (urban colonies, villages, mandals, tehsils, and districts).
 */
export function normalizeNominatimAddress(
  lat: number,
  lng: number,
  rawAddress: any,
  displayName?: string
): GeocodedAddress {
  const raw = rawAddress || {};

  // 1. House / Flat / Building details (NEVER invent; only set if present in map data)
  const houseNo = raw.house_number || raw.house_name || raw.building || raw.flat || "";

  // 2. Road / Street components
  const road = raw.road || raw.street || raw.highway || raw.pedestrian || raw.footway || raw.path || "";

  // 3. Locality / Neighbourhood / Residential area / Village
  const locality =
    raw.suburb ||
    raw.neighbourhood ||
    raw.residential ||
    raw.subdivision ||
    raw.colony ||
    raw.sector ||
    "";
  const village = raw.village || raw.hamlet || raw.isolated_dwelling || "";
  const subdistrict =
    raw.mandal || raw.tehsil || raw.subdistrict || raw.taluk || raw.county || "";

  // 4. Street / Locality combination for Indian address form
  const streetParts: string[] = [];
  if (road) streetParts.push(road);
  if (locality && locality !== road) streetParts.push(locality);
  if (village && !streetParts.includes(village)) streetParts.push(village);
  if (streetParts.length === 0 && subdistrict) streetParts.push(subdistrict);
  if (streetParts.length === 0 && displayName) {
    const parts = displayName.split(",").map((p: string) => p.trim());
    streetParts.push(parts.slice(0, 2).join(", "));
  }
  const street = streetParts.join(", ");

  // 5. City / Town (fallback to village, town, or locality in rural areas)
  const city =
    raw.city ||
    raw.town ||
    raw.municipality ||
    raw.city_district ||
    village ||
    (locality && !raw.city ? locality : "") ||
    "";

  // 6. District (clean up " District" or " Mandal" suffixes)
  let district = raw.state_district || raw.district || "";
  if (!district && subdistrict && /district/i.test(subdistrict)) district = subdistrict;
  if (!district && raw.county) district = raw.county;
  district = district.replace(/\s+district$/i, "").replace(/\s+mandal$/i, "").trim();
  if (!district && city) district = city;

  // 7. State
  const state = raw.state || "";

  // 8. 6-digit Indian PIN Code
  let pincode = raw.postcode || "";
  const pinMatch = String(pincode).match(/\b[1-9][0-9]{5}\b/);
  if (pinMatch) pincode = pinMatch[0];

  return {
    lat,
    lng,
    houseNo,
    street,
    locality: locality || village,
    subdistrict,
    city,
    district,
    state,
    pincode,
    country: raw.country || "India",
    displayName: displayName || "",
  };
}
