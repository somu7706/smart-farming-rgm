import mongoose from "mongoose";
import { Address } from "../models/Address.js";
import { User } from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://somu7706:8555938459@cluster0.o510m.mongodb.net/agriassist_db?retryWrites=true&w=majority";

/**
 * Normalizes OpenStreetMap Nominatim address components into structured fields
 * with specialized handling for Indian addresses (urban colonies, villages, mandals, tehsils, and districts).
 */
function normalizeNominatimAddress(lat, lng, rawAddress, displayName) {
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
  const streetParts = [];
  if (road) streetParts.push(road);
  if (locality && locality !== road) streetParts.push(locality);
  if (village && !streetParts.includes(village)) streetParts.push(village);
  if (streetParts.length === 0 && subdistrict) streetParts.push(subdistrict);
  if (streetParts.length === 0 && displayName) {
    const parts = displayName.split(",").map((p) => p.trim());
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

async function runAutofillVerification() {
  console.log("==========================================================");
  console.log(" AGRIASSIST DYNAMIC ADDRESS AUTOFILL VERIFICATION SUITE");
  console.log("==========================================================");

  // 1. Test Address Normalization Cases
  console.log("\n--- Test 1: Urban Location (Benz Circle, Vijayawada) ---");
  const urbanOsmAddress = {
    highway: "Benz Circle",
    road: "MG Road",
    residential: "Vijayawada Urban",
    suburb: "Krishna Lanka",
    city: "Vijayawada",
    county: "Vijayawada Urban Mandal",
    state_district: "NTR District",
    state: "Andhra Pradesh",
    postcode: "520001",
    country: "India",
  };
  const urbanResult = normalizeNominatimAddress(16.4984, 80.6527, urbanOsmAddress, "Benz Circle, MG Road, Vijayawada");
  console.log("Urban Normalized:", urbanResult);

  if (urbanResult.city !== "Vijayawada") throw new Error("Urban city mismatch");
  if (urbanResult.district !== "NTR") throw new Error("Urban district should strip 'District' suffix");
  if (urbanResult.state !== "Andhra Pradesh") throw new Error("Urban state mismatch");
  if (urbanResult.pincode !== "520001") throw new Error("Urban pincode mismatch");
  if (!urbanResult.street.includes("MG Road")) throw new Error("Urban street should contain road");
  if (urbanResult.houseNo !== "") throw new Error("House number must not be invented when missing");
  console.log("✔ Urban Normalization passed!");

  console.log("\n--- Test 2: Rural Village Location (Tummalapalem Village) ---");
  const ruralOsmAddress = {
    village: "Tummalapalem",
    county: "Prathipadu Mandal",
    state_district: "Guntur District",
    state: "Andhra Pradesh",
    postcode: "522019",
    country: "India",
  };
  const ruralResult = normalizeNominatimAddress(16.2000, 80.3000, ruralOsmAddress, "Tummalapalem, Prathipadu Mandal");
  console.log("Rural Normalized:", ruralResult);

  if (ruralResult.city !== "Tummalapalem") throw new Error("Rural village should serve as town/village");
  if (ruralResult.district !== "Guntur") throw new Error("Rural district should be Guntur");
  if (ruralResult.subdistrict !== "Prathipadu Mandal") throw new Error("Rural mandal mismatch");
  if (ruralResult.pincode !== "522019") throw new Error("Rural pincode mismatch");
  console.log("✔ Rural Village Normalization passed!");

  console.log("\n--- Test 3: Location with House Number (Door 40-1-12) ---");
  const houseOsmAddress = {
    house_number: "40-1-12",
    road: "Brindavan Gardens 3rd Line",
    suburb: "Brindavan Gardens",
    city: "Guntur",
    state_district: "Guntur District",
    state: "Andhra Pradesh",
    postcode: "522006",
    country: "India",
  };
  const houseResult = normalizeNominatimAddress(16.3067, 80.4365, houseOsmAddress, "40-1-12, Brindavan Gardens");
  console.log("House Normalized:", houseResult);

  if (houseResult.houseNo !== "40-1-12") throw new Error("House number should be extracted when present");
  if (houseResult.city !== "Guntur") throw new Error("City mismatch");
  console.log("✔ House Number extraction passed!");

  // 2. Connect to MongoDB and verify saving address with GPS coordinates
  console.log("\n--- Test 4: Database Persistence & Snapshotting ---");
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB Atlas.");

  const consumerUser = await User.findOne({ role: "consumer" });
  if (!consumerUser) throw new Error("No consumer found in database for test");

  // Create address using the autofilled urban location with user's manual door number
  const testAddr = await Address.create({
    userId: consumerUser._id,
    recipientName: "Test Consumer",
    phone: "9876543210",
    houseNo: "Plot 101, Green Heights",
    street: urbanResult.street,
    landmark: "Near Benz Circle",
    city: urbanResult.city,
    district: urbanResult.district,
    state: urbanResult.state,
    pincode: urbanResult.pincode,
    label: "Home",
    isDefault: false,
    latitude: urbanResult.lat,
    longitude: urbanResult.lng,
  });

  const clientAddr = testAddr.toFrontend();
  console.log("Created Address with Autofilled Data & Coordinates:", {
    id: clientAddr.id,
    formattedAddress: clientAddr.formattedAddress,
    coordinates: [clientAddr.latitude, clientAddr.longitude],
  });

  if (!clientAddr.latitude || !clientAddr.longitude) throw new Error("Coordinates were not persisted with address");
  if (!clientAddr.formattedAddress.includes("NTR")) throw new Error("District missing from formatted address");
  console.log("✔ Address persisted with exact coordinates and formatted string!");

  // Cleanup test address
  await Address.findByIdAndDelete(testAddr._id);
  console.log("✔ Cleaned up test address record.");

  await mongoose.disconnect();
  console.log("\n==========================================================");
  console.log(" ✔ ALL DYNAMIC ADDRESS AUTOFILL TESTS PASSED 100%!");
  console.log("==========================================================");
}

runAutofillVerification().catch((err) => {
  console.error("❌ Autofill Verification Failed:", err);
  process.exit(1);
});
