import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    recipientName: {
      type: String,
      required: [true, "Recipient full name is required"],
      trim: true,
      minlength: [2, "Recipient name must be at least 2 characters"],
      maxlength: [100, "Recipient name cannot exceed 100 characters"],
    },
    phone: {
      type: String,
      required: [true, "Mobile phone number is required"],
      trim: true,
      validate: {
        validator: function (v) {
          // Standard Indian 10-digit mobile number, optional +91 prefix
          return /^(\+91[\-\s]?)?[6-9]\d{9}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid 10-digit Indian mobile number`,
      },
    },
    houseNo: {
      type: String,
      required: [true, "Flat / House / Building details are required"],
      trim: true,
      maxlength: [150, "House details cannot exceed 150 characters"],
    },
    street: {
      type: String,
      required: [true, "Street / Locality / Village details are required"],
      trim: true,
      maxlength: [200, "Street details cannot exceed 200 characters"],
    },
    landmark: {
      type: String,
      default: "",
      trim: true,
      maxlength: [150, "Landmark cannot exceed 150 characters"],
    },
    city: {
      type: String,
      required: [true, "City / Town is required"],
      trim: true,
      maxlength: [100, "City name cannot exceed 100 characters"],
    },
    district: {
      type: String,
      required: [true, "District is required"],
      trim: true,
      maxlength: [100, "District name cannot exceed 100 characters"],
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      maxlength: [100, "State name cannot exceed 100 characters"],
    },
    pincode: {
      type: String,
      required: [true, "PIN Code is required"],
      trim: true,
      validate: {
        validator: function (v) {
          // Indian 6-digit postal code
          return /^[1-9][0-9]{5}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid 6-digit Indian PIN code`,
      },
    },
    label: {
      type: String,
      enum: ["Home", "Work", "Other"],
      default: "Home",
    },
    instructions: {
      type: String,
      default: "",
      trim: true,
      maxlength: [300, "Delivery instructions cannot exceed 300 characters"],
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    latitude: {
      type: Number,
      default: null,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      default: null,
      min: -180,
      max: 180,
    },
  },
  {
    timestamps: true,
  }
);

// Formatted single-line address generator
addressSchema.methods.getFormattedAddress = function () {
  const parts = [
    this.houseNo,
    this.street,
    this.landmark ? `Near ${this.landmark}` : null,
    this.city,
    this.district,
    this.state,
    this.pincode,
  ].filter(Boolean);

  return parts.join(", ");
};

// Snapshot for embedding into orders
addressSchema.methods.toSnapshot = function () {
  return {
    addressId: this._id ? this._id.toString() : null,
    recipientName: this.recipientName,
    phone: this.phone,
    houseNo: this.houseNo,
    street: this.street,
    landmark: this.landmark || "",
    city: this.city,
    district: this.district,
    state: this.state,
    pincode: this.pincode,
    label: this.label,
    instructions: this.instructions || "",
    formattedAddress: this.getFormattedAddress(),
    latitude: this.latitude,
    longitude: this.longitude,
  };
};

// Frontend JSON serializer
addressSchema.methods.toFrontend = function () {
  const idStr = this._id.toString();
  return {
    id: idStr,
    _id: idStr,
    userId: this.userId.toString(),
    recipientName: this.recipientName,
    phone: this.phone,
    houseNo: this.houseNo,
    street: this.street,
    landmark: this.landmark || "",
    city: this.city,
    district: this.district,
    state: this.state,
    pincode: this.pincode,
    label: this.label,
    instructions: this.instructions || "",
    isDefault: this.isDefault,
    latitude: this.latitude,
    longitude: this.longitude,
    formattedAddress: this.getFormattedAddress(),
    createdAt: this.createdAt?.toISOString(),
    updatedAt: this.updatedAt?.toISOString(),
  };
};

export const Address = mongoose.model("Address", addressSchema);
