import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Farmer } from "../models/Farmer.js";
import { Consumer } from "../models/Consumer.js";
import { syncManager } from "../config/websocket.js";

// Helper to validate state transitions
const VALID_TRANSITIONS = {
  pending: ["accepted", "rejected"],
  accepted: ["packed"],
  packed: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  rejected: [],
  delivered: [],
  cancelled: [],
};

/**
 * Place a new order (Consumer)
 */
export const createOrder = async (req, res) => {
  try {
    const { productId, quantity, deliveryAddress } = req.body;
    const consumerUserId = req.user._id;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: "Please specify a valid quantity greater than zero" });
    }

    // 1. Fetch Product
    let product;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    } else {
      product = await Product.findOne({
        $or: [{ supabaseFarmerId: productId }, { name: new RegExp(`^${productId}$`, "i") }],
      });
    }

    if (!product) {
      return res.status(404).json({ message: "Crop or product listing not found" });
    }

    if (product.status !== "available" && product.status !== "low_stock") {
      return res.status(400).json({ message: "This crop is currently marked as unavailable or sold out" });
    }

    // 2. Stock Verification
    if (product.quantity < qty) {
      return res.status(400).json({
        message: `Insufficient inventory available. Only ${product.quantity} ${product.unit} left in stock.`,
        availableQuantity: product.quantity,
      });
    }

    // 3. Fetch Farmer
    const farmer = await Farmer.findById(product.farmerId);
    if (!farmer) {
      return res.status(404).json({ message: "Farmer profile associated with this product could not be located" });
    }

    // 4. Fetch Consumer Profile (if present)
    const consumer = await Consumer.findOne({ userId: consumerUserId });

    const finalAddress =
      deliveryAddress && deliveryAddress.trim().length > 0
        ? deliveryAddress.trim()
        : consumer?.deliveryAddress && consumer.deliveryAddress.trim().length > 0
        ? consumer.deliveryAddress.trim()
        : "Standard Doorstep Delivery";

    // 5. Authoritative Server-side Price Calculations
    const pricePerKg = Number(product.price);
    const totalPrice = Math.round(pricePerKg * qty * 100) / 100;

    // 6. Atomic Inventory Decrement
    product.quantity = Math.max(0, product.quantity - qty);
    if (product.quantity === 0) {
      product.status = "sold";
    } else if (product.quantity < 20) {
      product.status = "low_stock";
    }
    await product.save();

    // 7. Generate Human-Friendly Order Reference
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${datePrefix}-${randomSuffix}`;

    // 8. Create Order Document
    const order = await Order.create({
      orderNumber,
      consumerId: consumerUserId,
      farmerId: farmer._id,
      farmerUserId: farmer.userId,
      productId: product._id,
      cropName: product.name,
      quantity: qty,
      pricePerKg,
      totalPrice,
      deliveryAddress: finalAddress,
      status: "pending",
      statusHistory: [
        {
          status: "pending",
          timestamp: new Date(),
          note: "Order placed by consumer",
        },
      ],
      consumerDetails: {
        fullName: consumer?.fullName || req.user.email.split("@")[0],
        phone: consumer?.phone || "",
        email: req.user.email,
        deliveryAddress: finalAddress,
      },
      farmerDetails: {
        fullName: farmer.fullName,
        phone: farmer.phone,
        email: farmer.email,
        region: farmer.region,
      },
      tracking: {
        currentLatitude: farmer.latitude || 28.6139,
        currentLongitude: farmer.longitude || 77.209,
        speed: 0,
        lastUpdated: new Date(),
      },
    });

    const formattedOrder = order.toFrontend();

    // 9. Real-Time WebSocket Notification to Farmer & Consumer
    syncManager.broadcast({
      entity: "order",
      action: "create",
      id: order._id.toString(),
      data: formattedOrder,
      targetFarmerId: farmer._id.toString(),
      targetFarmerUserId: farmer.userId.toString(),
      targetConsumerId: consumerUserId.toString(),
    });

    // Also notify product inventory update
    syncManager.broadcast({
      entity: "product",
      action: "update",
      id: product._id.toString(),
      data: product,
    });

    return res.status(201).json({
      success: true,
      message: `Order #${order.orderNumber} for ${qty} kg of ${product.name} placed successfully!`,
      order: formattedOrder,
    });
  } catch (err) {
    console.error("[Order Controller] Order creation error:", err);
    return res.status(500).json({
      message: "Failed to place order: " + (err.message || "Internal server error"),
    });
  }
};

/**
 * List orders for the authenticated user (Farmer or Consumer)
 */
export const getOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = {};

    if (userRole === "farmer") {
      const farmer = await Farmer.findOne({ userId });
      if (farmer) {
        query = {
          $or: [{ farmerUserId: userId }, { farmerId: farmer._id }],
        };
      } else {
        query = { farmerUserId: userId };
      }
    } else {
      // Default to consumer
      query = { consumerId: userId };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });
    const formatted = orders.map((o) => o.toFrontend());

    return res.json({
      success: true,
      count: formatted.length,
      orders: formatted,
    });
  } catch (err) {
    console.error("[Order Controller] Fetch orders error:", err);
    return res.status(500).json({
      message: "Failed to retrieve orders",
    });
  }
};

/**
 * Get details of a specific order
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Access check: User must be either the consumer or the farmer
    const userIdStr = req.user._id.toString();
    const isConsumer = order.consumerId.toString() === userIdStr;
    const isFarmer = order.farmerUserId.toString() === userIdStr;

    if (!isConsumer && !isFarmer && req.user.role !== "admin") {
      return res.status(403).json({ message: "You are not authorized to view this order" });
    }

    return res.json({
      success: true,
      order: order.toFrontend(),
    });
  } catch (err) {
    console.error("[Order Controller] Fetch single order error:", err);
    return res.status(500).json({
      message: "Failed to retrieve order details",
    });
  }
};

/**
 * Update order status (Farmer: Accept, Reject, Packed, Out for Delivery, Delivered)
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus, reason, note } = req.body;
    const userId = req.user._id;

    if (!newStatus) {
      return res.status(400).json({ message: "New status is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Authorization: User must be the assigned farmer
    const farmer = await Farmer.findOne({ userId });
    const isFarmerOwner =
      order.farmerUserId.toString() === userId.toString() ||
      (farmer && order.farmerId.toString() === farmer._id.toString());

    if (!isFarmerOwner) {
      return res.status(403).json({ message: "Only the designated farmer can update the status of this order" });
    }

    // Validation of state machine transition
    const allowedNext = VALID_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid state transition: Cannot transition from '${order.status}' to '${newStatus}'. Permitted transitions: [${allowedNext.join(", ")}]`,
      });
    }

    // Handle rejection: Restore stock to Product
    if (newStatus === "rejected") {
      const product = await Product.findById(order.productId);
      if (product) {
        product.quantity += order.quantity;
        if (product.status === "sold" && product.quantity > 0) {
          product.status = "available";
        }
        await product.save();

        syncManager.broadcast({
          entity: "product",
          action: "update",
          id: product._id.toString(),
          data: product,
        });
      }
      order.rejectionReason = reason || "Declined by farmer";
    }

    // Update status
    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      note: note || `Order updated to ${newStatus}`,
    });

    if (newStatus === "delivered") {
      order.paymentStatus = "paid";
    }

    await order.save();
    const formatted = order.toFrontend();

    // Real-Time WebSocket broadcast
    syncManager.broadcast({
      entity: "order",
      action: "update",
      id: order._id.toString(),
      data: formatted,
      targetConsumerId: order.consumerId.toString(),
      targetFarmerId: order.farmerId.toString(),
    });

    return res.json({
      success: true,
      message: `Order status updated to ${newStatus}`,
      order: formatted,
    });
  } catch (err) {
    console.error("[Order Controller] Status update error:", err);
    return res.status(500).json({
      message: "Failed to update order status: " + (err.message || "Internal error"),
    });
  }
};

/**
 * Update real-time GPS delivery coordinates (Farmer)
 */
export const updateOrderTracking = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, speed } = req.body;
    const userId = req.user._id;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const isFarmerOwner = order.farmerUserId.toString() === userId.toString();
    if (!isFarmerOwner) {
      return res.status(403).json({ message: "Only the designated delivery farmer can stream GPS locations" });
    }

    order.tracking = {
      currentLatitude: Number(latitude),
      currentLongitude: Number(longitude),
      speed: Number(speed) || 0,
      lastUpdated: new Date(),
    };

    await order.save();

    // Stream GPS tracking event live via WebSocket
    syncManager.broadcast({
      entity: "order",
      action: "update",
      id: order._id.toString(),
      data: {
        ...order.toFrontend(),
        trackingUpdate: true,
      },
      targetConsumerId: order.consumerId.toString(),
    });

    return res.json({
      success: true,
      tracking: order.tracking,
    });
  } catch (err) {
    console.error("[Order Controller] Tracking update error:", err);
    return res.status(500).json({
      message: "Failed to update GPS delivery tracking",
    });
  }
};

/**
 * Get aggregated statistics for the farmer dashboard
 */
export const getOrderStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const farmer = await Farmer.findOne({ userId });

    const farmerFilter = farmer
      ? { $or: [{ farmerUserId: userId }, { farmerId: farmer._id }] }
      : { farmerUserId: userId };

    const orders = await Order.find(farmerFilter);

    const activeOrders = orders.filter((o) => ["accepted", "packed", "out_for_delivery"].includes(o.status)).length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;
    const deliveredOrders = orders.filter((o) => o.status === "delivered");
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    return res.json({
      success: true,
      stats: {
        activeOrders,
        pendingOrders,
        totalOrders: orders.length,
        deliveredCount: deliveredOrders.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[Order Controller] Stats error:", err);
    return res.status(500).json({
      message: "Failed to compute order statistics",
    });
  }
};
