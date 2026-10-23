import { Farmer } from "../models/Farmer.js";
import { Consumer } from "../models/Consumer.js";
import { User } from "../models/User.js";
import { broadcastSyncEvent } from "../config/websocket.js";

// GET CURRENT USER'S PROFILE
export const getProfile = async (req, res) => {
  try {
    const user = req.user;
    let profile = null;

    if (user.role === "farmer") {
      profile = await Farmer.findOne({ userId: user._id });
    } else {
      profile = await Consumer.findOne({ userId: user._id });
    }

    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    return res.status(200).json(profile);
  } catch (error) {
    console.error("[Profile] Get error:", error);
    return res.status(500).json({ message: "Failed to get profile. " + error.message });
  }
};

// UPDATE CURRENT USER'S PROFILE
export const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const updates = req.body;

    // Security: Do not allow direct modification of userId or supabaseId
    delete updates.userId;
    delete updates.supabaseId;
    delete updates._id;

    let updatedProfile = null;

    if (user.role === "farmer") {
      // Validate numeric fields if present
      if (updates.landArea !== undefined) updates.landArea = parseFloat(updates.landArea) || 0;
      if (updates.totalYield !== undefined) updates.totalYield = parseFloat(updates.totalYield) || 0;
      if (updates.monthlyProduction !== undefined) updates.monthlyProduction = parseFloat(updates.monthlyProduction) || 0;
      if (updates.expectedPrice !== undefined) updates.expectedPrice = parseFloat(updates.expectedPrice) || 0;
      if (updates.latitude !== undefined) updates.latitude = updates.latitude ? parseFloat(updates.latitude) : null;
      if (updates.longitude !== undefined) updates.longitude = updates.longitude ? parseFloat(updates.longitude) : null;

      updatedProfile = await Farmer.findOneAndUpdate(
        { userId: user._id },
        { $set: updates },
        { new: true, runValidators: true }
      );
    } else {
      if (updates.latitude !== undefined) updates.latitude = updates.latitude ? parseFloat(updates.latitude) : null;
      if (updates.longitude !== undefined) updates.longitude = updates.longitude ? parseFloat(updates.longitude) : null;
      if (updates.purchaseVolumeCapacity !== undefined) {
        updates.purchaseVolumeCapacity = updates.purchaseVolumeCapacity ? parseFloat(updates.purchaseVolumeCapacity) : null;
      }

      updatedProfile = await Consumer.findOneAndUpdate(
        { userId: user._id },
        { $set: updates },
        { new: true, runValidators: true }
      );
    }

    if (!updatedProfile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    // Broadcast change to all connected consumer clients in real time
    if (user.role === "farmer") {
      broadcastSyncEvent({
        entity: "farmer_profile",
        action: "update",
        id: updatedProfile.supabaseId || updatedProfile._id.toString(),
        data: {
          id: updatedProfile.supabaseId || updatedProfile._id.toString(),
          full_name: updatedProfile.fullName,
          phone: updatedProfile.phone,
          region: updatedProfile.region,
          primary_crop: updatedProfile.primaryCrop,
          secondary_crop: updatedProfile.secondaryCrop,
          land_area: updatedProfile.landArea,
          total_yield: updatedProfile.totalYield,
          monthly_production: updatedProfile.monthlyProduction,
          expected_price: updatedProfile.expectedPrice,
          water_availability: updatedProfile.waterAvailability,
          farming_type: updatedProfile.farmingType,
          latitude: updatedProfile.latitude,
          longitude: updatedProfile.longitude,
          avatar_url: updatedProfile.avatarUrl,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("[Profile] Update error:", error);
    return res.status(500).json({ message: "Failed to update profile. " + error.message });
  }
};

// GET ALL FARMERS (Public / Marketplace Directory)
export const getFarmers = async (req, res) => {
  try {
    const { region, search, crop } = req.query;
    const filter = {};

    if (region && region !== "all") {
      filter.region = new RegExp(region, "i");
    }

    if (crop && crop !== "all") {
      filter.$or = [
        { primaryCrop: new RegExp(crop, "i") },
        { secondaryCrop: new RegExp(crop, "i") },
      ];
    }

    if (search) {
      filter.$or = [
        { fullName: new RegExp(search, "i") },
        { region: new RegExp(search, "i") },
        { primaryCrop: new RegExp(search, "i") },
      ];
    }

    const farmers = await Farmer.find(filter).sort({ createdAt: -1 });

    // Map to structure expected by frontend (with id = supabaseId or _id)
    const formatted = farmers.map((f) => ({
      id: f.supabaseId || f._id.toString(),
      mongoId: f._id.toString(),
      user_id: f.supabaseId || f.userId.toString(),
      full_name: f.fullName,
      email: f.email,
      phone: f.phone,
      region: f.region,
      primary_crop: f.primaryCrop,
      secondary_crop: f.secondaryCrop,
      land_area: f.landArea,
      total_yield: f.totalYield,
      monthly_production: f.monthlyProduction,
      expected_price: f.expectedPrice,
      water_availability: f.waterAvailability,
      farming_type: f.farmingType,
      harvest_cycle: f.harvestCycle,
      latitude: f.latitude,
      longitude: f.longitude,
      avatar_url: f.avatarUrl,
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error("[Profile] Get farmers error:", error);
    return res.status(500).json({ message: "Failed to fetch farmers. " + error.message });
  }
};

// GET SINGLE FARMER BY ID
export const getFarmerById = async (req, res) => {
  try {
    const { id } = req.params;
    let farmer = null;

    // Search by supabaseId or ObjectId
    if (id.includes("-")) {
      farmer = await Farmer.findOne({ supabaseId: id });
    } else {
      farmer = await Farmer.findById(id);
    }

    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }

    return res.status(200).json({
      id: farmer.supabaseId || farmer._id.toString(),
      mongoId: farmer._id.toString(),
      user_id: farmer.supabaseId || farmer.userId.toString(),
      full_name: farmer.fullName,
      email: farmer.email,
      phone: farmer.phone,
      region: farmer.region,
      primary_crop: farmer.primaryCrop,
      secondary_crop: farmer.secondaryCrop,
      land_area: farmer.landArea,
      total_yield: farmer.totalYield,
      monthly_production: farmer.monthlyProduction,
      expected_price: farmer.expectedPrice,
      water_availability: farmer.waterAvailability,
      farming_type: farmer.farmingType,
      harvest_cycle: farmer.harvestCycle,
      latitude: farmer.latitude,
      longitude: farmer.longitude,
      avatar_url: farmer.avatarUrl,
    });
  } catch (error) {
    console.error("[Profile] Get farmer by ID error:", error);
    return res.status(500).json({ message: "Failed to get farmer. " + error.message });
  }
};
