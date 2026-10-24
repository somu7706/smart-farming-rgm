import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Farmer } from "../models/Farmer.js";
import { Consumer } from "../models/Consumer.js";
import { Product } from "../models/Product.js";
import { Address } from "../models/Address.js";
import { Order } from "../models/Order.js";
import { BulkOrder } from "../models/BulkOrder.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret_agriassist_jwt_key_2026_x99a!";
const API_BASE = "http://localhost:5000/api";

const run = async () => {
  console.log("==========================================================");
  console.log(" AGRIASSIST DELIVERY ADDRESS & BULK ORDER TEST SUITE");
  console.log("==========================================================");

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas.");

  // Get or Create Consumer
  let consumerUser = await User.findOne({ role: "consumer" });
  if (!consumerUser) {
    consumerUser = await User.create({
      email: "consumer_addr_test@agriassist.local",
      password: "HashedPassword123!",
      role: "consumer",
      isEmailVerified: true,
    });
  }
  const consumerToken = jwt.sign(
    { id: consumerUser._id, email: consumerUser.email, role: "consumer" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Get or Create Farmer
  let farmerUser = await User.findOne({ role: "farmer" });
  const farmer = await Farmer.findOne({ userId: farmerUser._id });
  const farmerToken = jwt.sign(
    { id: farmerUser._id, email: farmerUser.email, role: "farmer" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Clean old test addresses for this user
  await Address.deleteMany({ userId: consumerUser._id });

  // 1. Test Address Validation (Invalid Phone & PIN)
  console.log("\n--- Step 1: Validating Address Constraints ---");
  const invalidRes = await fetch(`${API_BASE}/addresses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${consumerToken}`,
    },
    body: JSON.stringify({
      recipientName: "A",
      phone: "12345",
      houseNo: "Flat 101",
      street: "Main St",
      city: "Vijayawada",
      district: "Krishna",
      state: "Andhra Pradesh",
      pincode: "999",
    }),
  });
  const invalidData = await invalidRes.json();
  if (invalidRes.status !== 400) {
    throw new Error("Failed to reject invalid address: " + JSON.stringify(invalidData));
  }
  console.log(`✔ Invalid address rejected as expected: "${invalidData.message}"`);

  // 2. Add Valid Home Address (with coordinates)
  console.log("\n--- Step 2: Creating Valid Home Address ---");
  const homeRes = await fetch(`${API_BASE}/addresses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${consumerToken}`,
    },
    body: JSON.stringify({
      recipientName: "Sita Ram",
      phone: "9876543210",
      houseNo: "Plot 42, Sunrise Towers",
      street: "Benz Circle Road",
      landmark: "Opposite Grand Mall",
      city: "Vijayawada",
      district: "Krishna",
      state: "Andhra Pradesh",
      pincode: "520010",
      label: "Home",
      instructions: "Ring doorbell twice",
      latitude: 16.5062,
      longitude: 80.648,
      isDefault: true,
    }),
  });
  const homeData = await homeRes.json();
  if (!homeRes.ok) throw new Error("Failed to add Home address: " + JSON.stringify(homeData));
  const homeAddrId = homeData.address.id;
  console.log(`✔ Home Address Created! ID: ${homeAddrId}, isDefault: ${homeData.address.isDefault}`);

  // 3. Add Work Address
  console.log("\n--- Step 3: Creating Work Address ---");
  const workRes = await fetch(`${API_BASE}/addresses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${consumerToken}`,
    },
    body: JSON.stringify({
      recipientName: "Sita Ram",
      phone: "9876543210",
      houseNo: "Tech Park Block B, Suite 300",
      street: "Autonagar Industrial Area",
      landmark: "Near Gateway Towers",
      city: "Vijayawada",
      district: "Krishna",
      state: "Andhra Pradesh",
      pincode: "520007",
      label: "Work",
      instructions: "Leave at security reception",
      latitude: 16.518,
      longitude: 80.672,
      isDefault: false,
    }),
  });
  const workData = await workRes.json();
  if (!workRes.ok) throw new Error("Failed to add Work address: " + JSON.stringify(workData));
  const workAddrId = workData.address.id;
  console.log(`✔ Work Address Created! ID: ${workAddrId}, isDefault: ${workData.address.isDefault}`);

  // 4. Retrieve All Addresses
  console.log("\n--- Step 4: Fetching All Saved Addresses ---");
  const listRes = await fetch(`${API_BASE}/addresses`, {
    headers: { Authorization: `Bearer ${consumerToken}` },
  });
  const listData = await listRes.json();
  console.log(`✔ Retrieved ${listData.addresses.length} addresses. Default is: ${listData.addresses[0].label}`);

  // 5. Test Normal Order Checkout with Mandatory Address Selection
  console.log("\n--- Step 5: Placing Normal Order with Address Snapshot ---");
  const product = await Product.findOne({ status: "available", quantity: { $gte: 10 } });
  if (!product) throw new Error("No product available for order test");

  const orderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${consumerToken}`,
    },
    body: JSON.stringify({
      productId: product._id.toString(),
      quantity: 5,
      addressId: homeAddrId,
    }),
  });
  const orderData = await orderRes.json();
  if (!orderRes.ok) throw new Error("Order placement failed: " + JSON.stringify(orderData));
  console.log(`✔ Order #${orderData.order.orderNumber} placed with delivery address:`);
  console.log(`  "${orderData.order.delivery_address}"`);
  console.log(`  Snapshot Label: ${orderData.order.delivery_address_snapshot?.label}, Coordinates: (${orderData.order.delivery_address_snapshot?.latitude}, ${orderData.order.delivery_address_snapshot?.longitude})`);

  // 6. Test Bulk Order Creation with Delivery Address
  console.log("\n--- Step 6: Creating Bulk Order with Address Selection ---");
  const bulkRes = await fetch(`${API_BASE}/bulk-orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${consumerToken}`,
    },
    body: JSON.stringify({
      cropName: "Organic Cotton",
      quantityRequired: 5000,
      unit: "kg",
      region: "Kodumur",
      expectedDeliveryStart: "2026-11-01",
      expectedDeliveryEnd: "2026-11-30",
      addressId: workAddrId,
    }),
  });
  const bulkData = await bulkRes.json();
  if (!bulkRes.ok) throw new Error("Bulk order failed: " + JSON.stringify(bulkData));
  const bulkOrderId = bulkData.order.id;
  console.log(`✔ Bulk Order #${bulkData.order.bulk_order_number} Created Successfully!`);
  console.log(`  Destination: "${bulkData.order.delivery_address}"`);
  console.log(`  Delivery Window: ${bulkData.order.expected_delivery_start} to ${bulkData.order.expected_delivery_end}`);

  // 7. Test Farmer Committing to Bulk Order
  console.log("\n--- Step 7: Farmer Committing to Bulk Order ---");
  const commitRes = await fetch(`${API_BASE}/bulk-orders/${bulkOrderId}/commit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${farmerToken}`,
    },
    body: JSON.stringify({
      committedQuantity: 2000,
      notes: "First harvest batch ready by Nov 10",
    }),
  });
  const commitData = await commitRes.json();
  if (!commitRes.ok) throw new Error("Commitment failed: " + JSON.stringify(commitData));
  console.log(`✔ Farmer committed 2,000 kg! Total committed: ${commitData.order.total_committed} / ${commitData.order.quantity_required} kg (${commitData.order.status})`);

  // 8. Test Invalid Date Range (end < start)
  console.log("\n--- Step 8: Validating Date Constraint (End < Start) ---");
  const badDateRes = await fetch(`${API_BASE}/bulk-orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${consumerToken}`,
    },
    body: JSON.stringify({
      cropName: "Wheat",
      quantityRequired: 1000,
      unit: "kg",
      expectedDeliveryStart: "2026-12-01",
      expectedDeliveryEnd: "2026-11-01",
      addressId: homeAddrId,
    }),
  });
  const badDateData = await badDateRes.json();
  if (badDateRes.status !== 400) throw new Error("Failed to reject invalid date range");
  console.log(`✔ Invalid date range rejected: "${badDateData.message}"`);

  console.log("\n==========================================================");
  console.log(" ✔ ALL ADDRESS & BULK ORDER TESTS PASSED 100%!");
  console.log("==========================================================");

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
