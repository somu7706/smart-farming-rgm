import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Farmer } from "../models/Farmer.js";
import { Product } from "../models/Product.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://aqgdfejglksbvtzzwoth.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const migrate = async () => {
  try {
    console.log("[Migration] Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("[Migration] Connected to MongoDB.");

    console.log("[Migration] Fetching public farmer profiles from Supabase...");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_farmer_profiles`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from Supabase: ${response.statusText}`);
    }

    const profiles = await response.json();
    console.log(`[Migration] Found ${profiles.length} farmer profiles in Supabase.`);

    let importedCount = 0;
    for (const p of profiles) {
      const existingFarmer = await Farmer.findOne({ supabaseId: p.id });
      if (!existingFarmer) {
        // Create dummy user or placeholder for profile compatibility
        let user = await User.findOne({ supabaseId: p.id });
        if (!user) {
          user = await User.create({
            email: `farmer_${p.id.substring(0, 8)}@agriassist.local`,
            password: "$2a$12$PLACEHOLDER_HASH_MIGRATED_ACCOUNT_REQUIRE_RESET",
            role: "farmer",
            supabaseId: p.id,
            isEmailVerified: true,
          });
        }

        const farmer = await Farmer.create({
          userId: user._id,
          supabaseId: p.id,
          fullName: p.full_name || "Local Farmer",
          email: user.email,
          phone: "9876543210",
          region: p.region || "Andhra Pradesh",
          primaryCrop: "Rice",
          landArea: 5,
          totalYield: 2500,
          monthlyProduction: 500,
          expectedPrice: 45,
          waterAvailability: "Medium",
          farmingType: "Mixed",
        });

        // Add sample product for marketplace
        await Product.create({
          farmerId: farmer._id,
          userId: user._id,
          supabaseFarmerId: p.id,
          name: "Rice",
          category: "Grain",
          farmingType: "Mixed",
          price: 45,
          quantity: 2500,
          unit: "kg",
          region: p.region || "Andhra Pradesh",
          description: `Freshly harvested Rice from ${p.full_name}`,
          status: "available",
        });

        importedCount++;
      }
    }

    console.log(`[Migration] Successfully imported ${importedCount} new farmers into MongoDB.`);
    process.exit(0);
  } catch (error) {
    console.error("[Migration] Error:", error.message);
    process.exit(1);
  }
};

migrate();
