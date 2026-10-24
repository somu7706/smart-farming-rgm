import mongoose from "mongoose";
import { BulkOrder } from "../models/BulkOrder.js";
import { Address } from "../models/Address.js";
import { Consumer } from "../models/Consumer.js";
import { Farmer } from "../models/Farmer.js";
import { syncManager } from "../config/websocket.js";

/**
 * Create a new bulk crop demand order (Consumer)
 */
export const createBulkOrder = async (req, res) => {
  try {
    const customerId = req.user._id;
    const {
      cropName,
      quantityRequired,
      unit = "kg",
      region = "Any",
      expectedDeliveryStart,
      expectedDeliveryEnd,
      addressId,
      deliveryAddress,
      deliveryAddressSnapshot,
    } = req.body;

    // 1. Validation
    if (!cropName || cropName.trim().length === 0) {
      return res.status(400).json({ message: "Crop name is required" });
    }

    const qty = parseFloat(quantityRequired);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: "Please specify a valid quantity greater than zero" });
    }

    if (!["kg", "ton", "quintal"].includes(unit)) {
      return res.status(400).json({ message: "Unit must be 'kg', 'ton', or 'quintal'" });
    }

    if (!expectedDeliveryStart || !expectedDeliveryEnd) {
      return res.status(400).json({ message: "Both delivery start and end dates are required" });
    }

    const startDate = new Date(expectedDeliveryStart);
    const endDate = new Date(expectedDeliveryEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format provided for delivery dates" });
    }

    if (endDate < startDate) {
      return res.status(400).json({ message: "Expected delivery end date cannot be earlier than start date" });
    }

    // 2. Resolve Delivery Address & Snapshot
    let finalAddressText = "";
    let finalSnapshot = null;
    let resolvedAddressId = null;

    if (addressId && mongoose.Types.ObjectId.isValid(addressId)) {
      const savedAddr = await Address.findOne({ _id: addressId, userId: customerId });
      if (savedAddr) {
        resolvedAddressId = savedAddr._id;
        finalSnapshot = savedAddr.toSnapshot();
        finalAddressText = savedAddr.getFormattedAddress();
      }
    }

    if (!finalSnapshot && deliveryAddressSnapshot) {
      finalSnapshot = deliveryAddressSnapshot;
      finalAddressText =
        deliveryAddressSnapshot.formattedAddress ||
        deliveryAddress ||
        `${deliveryAddressSnapshot.houseNo || ""}, ${deliveryAddressSnapshot.street || ""}, ${deliveryAddressSnapshot.city || ""}, ${deliveryAddressSnapshot.state || ""} - ${deliveryAddressSnapshot.pincode || ""}`;
    } else if (!finalAddressText && deliveryAddress) {
      finalAddressText = deliveryAddress.trim();
      finalSnapshot = {
        formattedAddress: finalAddressText,
        recipientName: req.user.email.split("@")[0],
        phone: "",
      };
    }

    if (!finalAddressText || finalAddressText.trim().length === 0) {
      return res.status(400).json({
        message: "A complete delivery address is mandatory. Please select or add a delivery address.",
      });
    }

    // 3. Customer Info
    const consumer = await Consumer.findOne({ userId: customerId });
    const customerDetails = {
      fullName: finalSnapshot?.recipientName || consumer?.fullName || req.user.email.split("@")[0],
      phone: finalSnapshot?.phone || consumer?.phone || "",
      email: req.user.email,
    };

    // 4. Generate Unique Bulk Reference Number
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bulkOrderNumber = `BLK-${datePrefix}-${randomSuffix}`;

    // 5. Create Bulk Order
    const bulkOrder = await BulkOrder.create({
      bulkOrderNumber,
      customerId,
      customerDetails,
      cropName: cropName.trim(),
      quantityRequired: qty,
      unit,
      region: region ? region.trim() : "Any",
      expectedDeliveryStart: startDate,
      expectedDeliveryEnd: endDate,
      addressId: resolvedAddressId,
      deliveryAddress: finalAddressText,
      deliveryAddressSnapshot: finalSnapshot,
      status: "open",
      totalCommitted: 0,
      commitments: [],
    });

    const formattedOrder = bulkOrder.toFrontend();

    // 6. Broadcast Real-Time WebSocket Event (Farmers receive demand immediately)
    syncManager.broadcast({
      entity: "demand_supply",
      action: "create",
      id: bulkOrder._id.toString(),
      data: formattedOrder,
      customerId: customerId.toString(),
    });

    return res.status(201).json({
      success: true,
      message: `Bulk demand #${bulkOrder.bulkOrderNumber} created and listed successfully!`,
      order: formattedOrder,
    });
  } catch (err) {
    console.error("[BulkOrderController] Creation error:", err);
    return res.status(500).json({
      message: "Failed to create bulk order: " + (err.message || "Internal server error"),
    });
  }
};

/**
 * List bulk orders (Consumers see their orders, Farmers see market demand)
 */
export const getBulkOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = {};
    if (userRole === "consumer") {
      // Consumers view their own placed bulk orders
      query = { customerId: userId };
    } else {
      // Farmers view all open/active bulk demands from the market
      query = { status: { $in: ["open", "committed", "in_progress", "fulfilled"] } };
    }

    const orders = await BulkOrder.find(query).sort({ createdAt: -1 });
    const formatted = orders.map((o) => o.toFrontend());

    return res.json({
      success: true,
      count: formatted.length,
      orders: formatted,
    });
  } catch (err) {
    console.error("[BulkOrderController] Fetch error:", err);
    return res.status(500).json({ message: "Failed to retrieve bulk orders" });
  }
};

/**
 * Get details of a single bulk order
 */
export const getBulkOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid bulk order ID" });
    }

    const order = await BulkOrder.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Bulk order not found" });
    }

    return res.json({
      success: true,
      order: order.toFrontend(),
    });
  } catch (err) {
    console.error("[BulkOrderController] Fetch single error:", err);
    return res.status(500).json({ message: "Failed to retrieve bulk order" });
  }
};

/**
 * Commit production supply towards a bulk order (Farmer)
 */
export const commitToBulkOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { committedQuantity, notes } = req.body;

    const qty = parseFloat(committedQuantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: "Committed quantity must be greater than zero" });
    }

    const order = await BulkOrder.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Bulk order not found" });
    }

    const farmer = await Farmer.findOne({ userId });
    if (!farmer) {
      return res.status(403).json({ message: "Only registered farmers can commit to bulk demands" });
    }

    // Add commitment
    order.commitments.push({
      farmerId: farmer._id,
      farmerUserId: userId,
      farmerName: farmer.fullName,
      farmerPhone: farmer.phone,
      farmerRegion: farmer.region,
      committedQuantity: qty,
      notes: notes || "",
    });

    order.recalculateCommitted();
    await order.save();

    const formatted = order.toFrontend();

    // Broadcast update
    syncManager.broadcast({
      entity: "demand_supply",
      action: "update",
      id: order._id.toString(),
      data: formatted,
    });

    return res.json({
      success: true,
      message: `Committed ${qty} ${order.unit} successfully!`,
      order: formatted,
    });
  } catch (err) {
    console.error("[BulkOrderController] Commit error:", err);
    return res.status(500).json({ message: "Failed to submit commitment: " + err.message });
  }
};
