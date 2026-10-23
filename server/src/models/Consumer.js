import mongoose from "mongoose";

const consumerSchema = new mongoose.Schema(
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
      default: "",
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    deliveryAddress: {
      type: String,
      default: "",
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
    businessName: {
      type: String,
      default: "",
    },
    businessType: {
      type: String,
      default: "",
    },
    preferredCrops: {
      type: String,
      default: "",
    },
    purchaseVolumeCapacity: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Consumer = mongoose.model("Consumer", consumerSchema);
