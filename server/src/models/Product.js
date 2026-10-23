import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farmer",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    supabaseFarmerId: {
      type: String,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Product / Crop name is required"],
      trim: true,
    },
    category: {
      type: String,
      default: "Produce",
      trim: true,
    },
    farmingType: {
      type: String,
      default: "Mixed",
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: 0,
    },
    quantity: {
      type: Number,
      required: [true, "Available quantity / yield is required"],
      min: 0,
    },
    unit: {
      type: String,
      default: "kg",
    },
    region: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["available", "out_of_stock", "archived"],
      default: "available",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Product = mongoose.model("Product", productSchema);
