import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    consumerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Consumer ID is required"],
      index: true,
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farmer",
      required: [true, "Farmer ID is required"],
      index: true,
    },
    farmerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      index: true,
    },
    cropName: {
      type: String,
      required: [true, "Crop / Product name is required"],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0.01, "Quantity must be greater than zero"],
    },
    pricePerKg: {
      type: Number,
      required: [true, "Price per kg is required"],
      min: [0, "Price cannot be negative"],
    },
    totalPrice: {
      type: Number,
      required: [true, "Total price is required"],
      min: [0, "Total price cannot be negative"],
    },
    deliveryAddress: {
      type: String,
      required: [true, "Delivery address is required"],
      trim: true,
    },
    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      default: null,
    },
    deliveryAddressSnapshot: {
      addressId: { type: String, default: null },
      recipientName: { type: String, default: "" },
      phone: { type: String, default: "" },
      houseNo: { type: String, default: "" },
      street: { type: String, default: "" },
      landmark: { type: String, default: "" },
      city: { type: String, default: "" },
      district: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      label: { type: String, default: "Home" },
      instructions: { type: String, default: "" },
      formattedAddress: { type: String, default: "" },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "packed", "out_for_delivery", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "cod"],
      default: "cod",
    },
    paymentMethod: {
      type: String,
      default: "cash_on_delivery",
      trim: true,
    },
    tracking: {
      currentLatitude: { type: Number, default: null },
      currentLongitude: { type: Number, default: null },
      speed: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: null },
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
    consumerDetails: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      deliveryAddress: { type: String, default: "" },
    },
    farmerDetails: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      region: { type: String, default: "" },
    },
    supabaseOrderId: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Helper method to format object for both snake_case and camelCase consumers
orderSchema.methods.toFrontend = function () {
  const idStr = this._id.toString();
  return {
    id: idStr,
    _id: idStr,
    orderNumber: this.orderNumber,
    consumer_id: this.consumerId?.toString() || "",
    consumerId: this.consumerId?.toString() || "",
    consumer_name: this.consumerDetails?.fullName || "Consumer",
    consumer_phone: this.consumerDetails?.phone || "",
    consumer_email: this.consumerDetails?.email || "",
    farmer_id: this.farmerId?.toString() || "",
    farmerId: this.farmerId?.toString() || "",
    farmer_name: this.farmerDetails?.fullName || "Farmer",
    farmer_phone: this.farmerDetails?.phone || "",
    farmer_email: this.farmerDetails?.email || "",
    farmer_region: this.farmerDetails?.region || "",
    crop_name: this.cropName,
    cropName: this.cropName,
    crop_id: this.productId?.toString() || "",
    productId: this.productId?.toString() || "",
    quantity: this.quantity,
    price_per_kg: this.pricePerKg,
    pricePerKg: this.pricePerKg,
    total_price: this.totalPrice,
    totalPrice: this.totalPrice,
    status: this.status,
    rejection_reason: this.rejectionReason,
    rejectionReason: this.rejectionReason,
    delivery_address: this.deliveryAddress,
    deliveryAddress: this.deliveryAddress,
    address_id: this.addressId?.toString() || null,
    addressId: this.addressId?.toString() || null,
    delivery_address_snapshot: this.deliveryAddressSnapshot || null,
    deliveryAddressSnapshot: this.deliveryAddressSnapshot || null,
    payment_status: this.paymentStatus,
    paymentStatus: this.paymentStatus,
    payment_method: this.paymentMethod,
    paymentMethod: this.paymentMethod,
    tracking: this.tracking,
    status_history: this.statusHistory,
    statusHistory: this.statusHistory,
    created_at: this.createdAt?.toISOString() || new Date().toISOString(),
    createdAt: this.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: this.updatedAt?.toISOString() || new Date().toISOString(),
    updatedAt: this.updatedAt?.toISOString() || new Date().toISOString(),
  };
};

export const Order = mongoose.model("Order", orderSchema);
