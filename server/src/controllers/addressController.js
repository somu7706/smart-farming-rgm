import { Address } from "../models/Address.js";

const PHONE_REGEX = /^(\+91[\-\s]?)?[6-9]\d{9}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/**
 * Get all saved addresses for the authenticated consumer
 */
export const getAddresses = async (req, res) => {
  try {
    const userId = req.user._id;
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, updatedAt: -1 });

    return res.json({
      success: true,
      count: addresses.length,
      addresses: addresses.map((a) => a.toFrontend()),
    });
  } catch (err) {
    console.error("[AddressController] Fetch error:", err);
    return res.status(500).json({ message: "Failed to retrieve saved addresses" });
  }
};

/**
 * Add a new delivery address
 */
export const addAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      recipientName,
      phone,
      houseNo,
      street,
      landmark,
      city,
      district,
      state,
      pincode,
      label,
      instructions,
      isDefault,
      latitude,
      longitude,
    } = req.body;

    // Field validations
    if (!recipientName || recipientName.trim().length < 2) {
      return res.status(400).json({ message: "Recipient full name is required (min 2 characters)" });
    }

    if (!phone || !PHONE_REGEX.test(phone.trim())) {
      return res.status(400).json({ message: "Please provide a valid 10-digit Indian mobile number" });
    }

    if (!houseNo || houseNo.trim().length === 0) {
      return res.status(400).json({ message: "Flat, House, or Building number is required" });
    }

    if (!street || street.trim().length === 0) {
      return res.status(400).json({ message: "Street, Locality, or Village is required" });
    }

    if (!city || city.trim().length === 0) {
      return res.status(400).json({ message: "City or Town is required" });
    }

    if (!district || district.trim().length === 0) {
      return res.status(400).json({ message: "District is required" });
    }

    if (!state || state.trim().length === 0) {
      return res.status(400).json({ message: "State is required" });
    }

    if (!pincode || !PINCODE_REGEX.test(pincode.trim())) {
      return res.status(400).json({ message: "Please provide a valid 6-digit Indian PIN code" });
    }

    // Check existing addresses
    const existingCount = await Address.countDocuments({ userId });
    const shouldBeDefault = isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await Address.updateMany({ userId }, { $set: { isDefault: false } });
    }

    const newAddress = await Address.create({
      userId,
      recipientName: recipientName.trim(),
      phone: phone.trim().replace(/^(\+91[\-\s]?)/, ""),
      houseNo: houseNo.trim(),
      street: street.trim(),
      landmark: landmark ? landmark.trim() : "",
      city: city.trim(),
      district: district.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      label: label && ["Home", "Work", "Other"].includes(label) ? label : "Home",
      instructions: instructions ? instructions.trim() : "",
      isDefault: shouldBeDefault,
      latitude: latitude !== undefined && latitude !== null ? Number(latitude) : null,
      longitude: longitude !== undefined && longitude !== null ? Number(longitude) : null,
    });

    return res.status(201).json({
      success: true,
      message: "Delivery address saved successfully",
      address: newAddress.toFrontend(),
    });
  } catch (err) {
    console.error("[AddressController] Add error:", err);
    return res.status(500).json({ message: "Failed to save address: " + err.message });
  }
};

/**
 * Update an existing delivery address
 */
export const updateAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const address = await Address.findOne({ _id: id, userId });
    if (!address) {
      return res.status(404).json({ message: "Address not found or unauthorized" });
    }

    const {
      recipientName,
      phone,
      houseNo,
      street,
      landmark,
      city,
      district,
      state,
      pincode,
      label,
      instructions,
      isDefault,
      latitude,
      longitude,
    } = req.body;

    if (recipientName !== undefined) {
      if (recipientName.trim().length < 2) {
        return res.status(400).json({ message: "Recipient name must be at least 2 characters" });
      }
      address.recipientName = recipientName.trim();
    }

    if (phone !== undefined) {
      if (!PHONE_REGEX.test(phone.trim())) {
        return res.status(400).json({ message: "Invalid 10-digit Indian phone number" });
      }
      address.phone = phone.trim().replace(/^(\+91[\-\s]?)/, "");
    }

    if (houseNo !== undefined) address.houseNo = houseNo.trim();
    if (street !== undefined) address.street = street.trim();
    if (landmark !== undefined) address.landmark = landmark.trim();
    if (city !== undefined) address.city = city.trim();
    if (district !== undefined) address.district = district.trim();
    if (state !== undefined) address.state = state.trim();

    if (pincode !== undefined) {
      if (!PINCODE_REGEX.test(pincode.trim())) {
        return res.status(400).json({ message: "Invalid 6-digit Indian PIN code" });
      }
      address.pincode = pincode.trim();
    }

    if (label !== undefined && ["Home", "Work", "Other"].includes(label)) {
      address.label = label;
    }

    if (instructions !== undefined) address.instructions = instructions.trim();

    if (latitude !== undefined) address.latitude = latitude !== null ? Number(latitude) : null;
    if (longitude !== undefined) address.longitude = longitude !== null ? Number(longitude) : null;

    if (isDefault === true && !address.isDefault) {
      await Address.updateMany({ userId }, { $set: { isDefault: false } });
      address.isDefault = true;
    }

    await address.save();

    return res.json({
      success: true,
      message: "Delivery address updated successfully",
      address: address.toFrontend(),
    });
  } catch (err) {
    console.error("[AddressController] Update error:", err);
    return res.status(500).json({ message: "Failed to update address: " + err.message });
  }
};

/**
 * Delete a saved delivery address
 */
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const address = await Address.findOneAndDelete({ _id: id, userId });
    if (!address) {
      return res.status(404).json({ message: "Address not found or unauthorized" });
    }

    // If deleted address was default, promote the newest remaining address
    if (address.isDefault) {
      const remaining = await Address.findOne({ userId }).sort({ updatedAt: -1 });
      if (remaining) {
        remaining.isDefault = true;
        await remaining.save();
      }
    }

    return res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (err) {
    console.error("[AddressController] Delete error:", err);
    return res.status(500).json({ message: "Failed to delete address" });
  }
};

/**
 * Mark a specific address as the default
 */
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const address = await Address.findOne({ _id: id, userId });
    if (!address) {
      return res.status(404).json({ message: "Address not found or unauthorized" });
    }

    await Address.updateMany({ userId }, { $set: { isDefault: false } });
    address.isDefault = true;
    await address.save();

    const all = await Address.find({ userId }).sort({ isDefault: -1, updatedAt: -1 });

    return res.json({
      success: true,
      message: "Default address updated",
      addresses: all.map((a) => a.toFrontend()),
    });
  } catch (err) {
    console.error("[AddressController] Set default error:", err);
    return res.status(500).json({ message: "Failed to set default address" });
  }
};
