import mongoose from "mongoose";

const commitmentSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Farmer",
  },
  farmerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  farmerName: {
    type: String,
    required: true,
  },
  farmerPhone: {
    type: String,
    default: "",
  },
  farmerRegion: {
    type: String,
    default: "",
  },
  committedQuantity: {
    type: Number,
    required: true,
    min: [0.01, "Committed quantity must be greater than zero"],
  },
  status: {
    type: String,
    enum: ["committed", "in_production", "ready", "fulfilled"],
    default: "committed",
  },
  notes: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const bulkOrderSchema = new mongoose.Schema(
  {
    bulkOrderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer ID is required"],
      index: true,
    },
    customerDetails: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    cropName: {
      type: String,
      required: [true, "Crop name is required"],
      trim: true,
    },
    quantityRequired: {
      type: Number,
      required: [true, "Required quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    unit: {
      type: String,
      enum: ["kg", "ton", "quintal"],
      default: "kg",
    },
    region: {
      type: String,
      default: "Any",
      trim: true,
    },
    expectedDeliveryStart: {
      type: Date,
      required: [true, "Expected delivery start date is required"],
    },
    expectedDeliveryEnd: {
      type: Date,
      required: [true, "Expected delivery end date is required"],
    },
    deliveryAddress: {
      type: String,
      required: [true, "Complete delivery address is required"],
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
      enum: ["open", "committed", "in_progress", "fulfilled", "cancelled"],
      default: "open",
      index: true,
    },
    totalCommitted: {
      type: Number,
      default: 0,
      min: 0,
    },
    commitments: [commitmentSchema],
    supabaseBulkOrderId: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Method to recalculate total committed
bulkOrderSchema.methods.recalculateCommitted = function () {
  this.totalCommitted = (this.commitments || []).reduce(
    (sum, c) => sum + (c.committedQuantity || 0),
    0
  );

  if (this.totalCommitted >= this.quantityRequired) {
    this.status = "fulfilled";
  } else if (this.totalCommitted > 0) {
    this.status = "committed";
  } else {
    this.status = "open";
  }
};

// Serializer for both snake_case and camelCase consumers
bulkOrderSchema.methods.toFrontend = function () {
  const idStr = this._id.toString();
  return {
    id: idStr,
    _id: idStr,
    bulk_order_number: this.bulkOrderNumber,
    bulkOrderNumber: this.bulkOrderNumber,
    customer_id: this.customerId.toString(),
    customerId: this.customerId.toString(),
    customer_name: this.customerDetails?.fullName || "Bulk Buyer",
    customerName: this.customerDetails?.fullName || "Bulk Buyer",
    customer_phone: this.customerDetails?.phone || "",
    customerPhone: this.customerDetails?.phone || "",
    customer_email: this.customerDetails?.email || "",
    customerEmail: this.customerDetails?.email || "",
    crop_name: this.cropName,
    cropName: this.cropName,
    quantity_required: this.quantityRequired,
    quantityRequired: this.quantityRequired,
    unit: this.unit,
    region: this.region,
    expected_delivery_start: this.expectedDeliveryStart
      ? this.expectedDeliveryStart.toISOString().split("T")[0]
      : null,
    expectedDeliveryStart: this.expectedDeliveryStart?.toISOString(),
    expected_delivery_end: this.expectedDeliveryEnd
      ? this.expectedDeliveryEnd.toISOString().split("T")[0]
      : null,
    expectedDeliveryEnd: this.expectedDeliveryEnd?.toISOString(),
    delivery_address: this.deliveryAddress,
    deliveryAddress: this.deliveryAddress,
    address_id: this.addressId?.toString() || null,
    addressId: this.addressId?.toString() || null,
    delivery_address_snapshot: this.deliveryAddressSnapshot || null,
    deliveryAddressSnapshot: this.deliveryAddressSnapshot || null,
    status: this.status,
    total_committed: this.totalCommitted,
    totalCommitted: this.totalCommitted,
    commitments: (this.commitments || []).map((c) => ({
      id: c._id.toString(),
      farmerId: c.farmerId?.toString() || "",
      farmerName: c.farmerName,
      farmerPhone: c.farmerPhone,
      farmerRegion: c.farmerRegion,
      committedQuantity: c.committedQuantity,
      status: c.status,
      notes: c.notes,
      createdAt: c.createdAt?.toISOString(),
    })),
    created_at: this.createdAt?.toISOString() || new Date().toISOString(),
    createdAt: this.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: this.updatedAt?.toISOString() || new Date().toISOString(),
    updatedAt: this.updatedAt?.toISOString() || new Date().toISOString(),
  };
};

export const BulkOrder = mongoose.model("BulkOrder", bulkOrderSchema);
