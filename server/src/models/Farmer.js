import mongoose from "mongoose";

const farmerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    supabaseId: {
      type: String,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    region: {
      type: String,
      required: [true, "Region is required"],
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    primaryCrop: {
      type: String,
      default: "",
    },
    secondaryCrop: {
      type: String,
      default: "",
    },
    landArea: {
      type: Number,
      default: 0,
    },
    totalYield: {
      type: Number,
      default: 0,
    },
    monthlyProduction: {
      type: Number,
      default: 0,
    },
    expectedPrice: {
      type: Number,
      default: 0,
    },
    waterAvailability: {
      type: String,
      default: "Medium",
    },
    farmingType: {
      type: String,
      default: "Mixed",
    },
    harvestCycle: {
      type: String,
      default: "Seasonal",
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    state: {
      type: String,
      default: "",
    },
    district: {
      type: String,
      default: "",
    },
    mandal: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    farmName: {
      type: String,
      default: "",
    },
    totalLandArea: {
      type: Number,
      default: null,
    },
    irrigationType: {
      type: String,
      default: "",
    },
    soilType: {
      type: String,
      default: "",
    },
    yearsOfExperience: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Farmer = mongoose.model("Farmer", farmerSchema);
