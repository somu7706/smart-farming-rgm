import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Farmer } from "../models/Farmer.js";
import { Consumer } from "../models/Consumer.js";
import { Product } from "../models/Product.js";
import { Order } from "../models/Order.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret_agriassist_jwt_key_2026_x99a!";
const API_BASE = "http://localhost:5000/api";

const run = async () => {
  console.log("=================================================");
  console.log(" AGRIASSIST ORDER & REAL-TIME FLOW VERIFICATION");
  console.log("=================================================");

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas.");

  // 1. Get or Create Farmer
  let farmerUser = await User.findOne({ email: "somu7075267357@gmail.com" });
  if (!farmerUser) {
    farmerUser = await User.findOne({ role: "farmer" });
  }
  const farmer = await Farmer.findOne({ userId: farmerUser._id });
  console.log(`[Test] Farmer: ${farmer.fullName} (${farmerUser.email})`);

  // 2. Get or Create Consumer
  let consumerUser = await User.findOne({ role: "consumer" });
  if (!consumerUser) {
    consumerUser = await User.create({
      email: "test_consumer_flow@agriassist.local",
      password: "HashedPassword123!",
      role: "consumer",
      isEmailVerified: true,
    });
    await Consumer.create({
      userId: consumerUser._id,
      fullName: "Priya Sharma",
      email: consumerUser.email,
      phone: "+919876543210",
      region: "Andhra Pradesh",
      deliveryAddress: "Flat 402, Green Meadows, Guntur",
    });
  }
  const consumer = await Consumer.findOne({ userId: consumerUser._id });
  console.log(`[Test] Consumer: ${consumer?.fullName || "Consumer"} (${consumerUser.email})`);

  // 3. Find or Create a Test Product
  let product = await Product.findOne({ farmerId: farmer._id, status: "available" });
  if (!product) {
    product = await Product.create({
      farmerId: farmer._id,
      userId: farmerUser._id,
      name: "Organic Basmati Rice",
      price: 60,
      quantity: 500,
      unit: "kg",
      status: "available",
      region: farmer.region || "Andhra Pradesh",
      description: "Direct farm fresh crop",
    });
  }
  const initialQty = product.quantity;
  console.log(`[Test] Product: ${product.name} @ ?${product.price}/kg, Initial Stock: ${initialQty} kg`);

  // Generate tokens
  const consumerToken = jwt.sign(
    { id: consumerUser._id, email: consumerUser.email, role: "consumer" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const farmerToken = jwt.sign(
    { id: farmerUser._id, email: farmerUser.email, role: "farmer" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // 4. Test Server-authoritative Order Placement
  console.log("\n--- Step 1: Placing Order as Consumer ---");
  const orderQty = 25;
  const placeRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${consumerToken}`,
    },
    body: JSON.stringify({
      productId: product._id.toString(),
      quantity: orderQty,
      deliveryAddress: "Door 12-4, Market Road, Vijayawada",
    }),
  });

  const placeData = await placeRes.json();
  if (!placeRes.ok) {
    throw new Error(`Order placement failed: ${JSON.stringify(placeData)}`);
  }
  console.log(`? Order Placed Successfully! Order #: ${placeData.order.orderNumber}`);
  console.log(`  Total Price (Server-calculated): ?${placeData.order.total_price}`);
  console.log(`  Initial Status: ${placeData.order.status}`);

  const orderId = placeData.order.id;

  // 5. Verify Inventory Decrement
  console.log("\n--- Step 2: Verifying Stock Decrement ---");
  const updatedProduct = await Product.findById(product._id);
  console.log(`  Original: ${initialQty} kg -> New Stock: ${updatedProduct.quantity} kg`);
  if (updatedProduct.quantity !== initialQty - orderQty) {
    throw new Error("Inventory decrement mismatch!");
  }
  console.log("? Inventory decremented accurately on Product model.");

  // 6. Test Farmer Fetching Incoming Orders
  console.log("\n--- Step 3: Farmer Fetching Incoming Orders ---");
  const farmerOrdersRes = await fetch(`${API_BASE}/orders`, {
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  const farmerOrdersData = await farmerOrdersRes.json();
  const foundOrder = farmerOrdersData.orders.find((o) => o.id === orderId);
  if (!foundOrder) {
    throw new Error("Created order not found in Farmer's incoming order list!");
  }
  console.log(`? Farmer sees incoming order #${foundOrder.orderNumber} from ${foundOrder.consumer_name}`);

  // 7. Test Multi-Step State Progression
  console.log("\n--- Step 4: Farmer Order Status Lifecycle Progression ---");

  // Step 4a: Accept
  console.log("  Transition: pending -> accepted");
  const acceptRes = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${farmerToken}`,
    },
    body: JSON.stringify({ status: "accepted", note: "Order accepted by farmer" }),
  });
  const acceptData = await acceptRes.json();
  if (acceptData.order.status !== "accepted") throw new Error("Failed to transition to accepted");
  console.log("  ? Status is now: accepted");

  // Step 4b: Packed
  console.log("  Transition: accepted -> packed");
  const packRes = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${farmerToken}`,
    },
    body: JSON.stringify({ status: "packed", note: "Crop bagged and weighed" }),
  });
  const packData = await packRes.json();
  if (packData.order.status !== "packed") throw new Error("Failed to transition to packed");
  console.log("  ? Status is now: packed");

  // Step 4c: Out for Delivery
  console.log("  Transition: packed -> out_for_delivery");
  const dispatchRes = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${farmerToken}`,
    },
    body: JSON.stringify({ status: "out_for_delivery", note: "Driver dispatched" }),
  });
  const dispatchData = await dispatchRes.json();
  if (dispatchData.order.status !== "out_for_delivery") throw new Error("Failed to transition to out_for_delivery");
  console.log("  ? Status is now: out_for_delivery");

  // Step 4d: GPS Coordinates Update
  console.log("\n--- Step 5: Live GPS Tracking Stream ---");
  const gpsRes = await fetch(`${API_BASE}/orders/${orderId}/tracking`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${farmerToken}`,
    },
    body: JSON.stringify({
      latitude: 16.5062,
      longitude: 80.648,
      speed: 42.5,
    }),
  });
  const gpsData = await gpsRes.json();
  console.log(`? GPS location updated: Lat ${gpsData.tracking.currentLatitude}, Lng ${gpsData.tracking.currentLongitude}, Speed ${gpsData.tracking.speed} km/h`);

  // Step 4e: Delivered
  console.log("\n--- Step 6: Mark as Delivered ---");
  const deliverRes = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${farmerToken}`,
    },
    body: JSON.stringify({ status: "delivered", note: "Delivered to consumer doorstep" }),
  });
  const deliverData = await deliverRes.json();
  if (deliverData.order.status !== "delivered") throw new Error("Failed to transition to delivered");
  console.log(`? Status is now: delivered! Payment status: ${deliverData.order.payment_status}`);

  // 8. Test Rejection & Inventory Restoration
  console.log("\n--- Step 7: Testing Order Rejection and Inventory Restoration ---");
  const testStockBefore = (await Product.findById(product._id)).quantity;
  const rejectOrderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${consumerToken}`,
    },
    body: JSON.stringify({
      productId: product._id.toString(),
      quantity: 15,
      deliveryAddress: "Test Address",
    }),
  });
  const rejectOrderData = await rejectOrderRes.json();
  const testStockAfterOrder = (await Product.findById(product._id)).quantity;
  console.log(`  Placed 15 kg order. Stock: ${testStockBefore} -> ${testStockAfterOrder}`);

  const rejectRes = await fetch(`${API_BASE}/orders/${rejectOrderData.order.id}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${farmerToken}`,
    },
    body: JSON.stringify({ status: "rejected", reason: "Logistics vehicle unavailable" }),
  });
  const rejectData = await rejectRes.json();
  const testStockAfterReject = (await Product.findById(product._id)).quantity;
  console.log(`  Farmer rejected order. Stock restored: ${testStockAfterOrder} -> ${testStockAfterReject}`);
  if (testStockAfterReject !== testStockBefore) {
    throw new Error("Stock was not restored upon rejection!");
  }
  console.log("? Inventory accurately restored upon order rejection!");

  console.log("\n=================================================");
  console.log(" ? ALL ORDER LIFECYCLE TESTS PASSED PERFECTLY!");
  console.log("=================================================");

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
