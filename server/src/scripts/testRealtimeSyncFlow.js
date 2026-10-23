import dotenv from "dotenv";
dotenv.config();

import WebSocket from "ws";

const API_BASE = "http://localhost:5000/api";
const WS_URL = "ws://localhost:5000/ws/sync";

async function runRealtimeSyncTest() {
  console.log("=================================================");
  console.log("   AGRIASSIST REAL-TIME SYNC & WEBSOCKET TEST   ");
  console.log("=================================================");

  // 1. Establish WebSocket Connection
  console.log(`[Step 1] Connecting WebSocket to ${WS_URL}...`);
  const ws = new WebSocket(WS_URL);

  const receivedEvents = [];

  await new Promise((resolve, reject) => {
    ws.on("open", () => {
      console.log("✓ WebSocket connection opened successfully!");
      resolve();
    });
    ws.on("error", (err) => reject(err));
    ws.on("message", (data) => {
      const parsed = JSON.parse(data.toString());
      console.log(`📡 [WS Event Received]: type="${parsed.type}" entity="${parsed.entity || 'N/A'}" action="${parsed.action || 'N/A'}" timestamp=${parsed.timestamp}`);
      receivedEvents.push(parsed);
    });
  });

  // Verify initial SYNC_CONNECTED handshake
  await new Promise((r) => setTimeout(r, 400));
  const connectedMsg = receivedEvents.find((e) => e.type === "SYNC_CONNECTED");
  if (!connectedMsg) {
    throw new Error("Failed to receive initial SYNC_CONNECTED handshake message");
  }
  console.log("✓ Initial handshake verified: ", connectedMsg);

  // 2. Test Keepalive Ping/Pong
  console.log("\n[Step 2] Testing Keepalive Ping...");
  ws.send(JSON.stringify({ type: "ping" }));
  await new Promise((r) => setTimeout(r, 400));
  const pongMsg = receivedEvents.find((e) => e.type === "pong");
  if (!pongMsg) {
    throw new Error("Failed to receive pong response to ping");
  }
  console.log("✓ Keepalive pong received correctly: ", pongMsg);

  // 3. Login as Farmer
  console.log("\n[Step 3] Logging in as Farmer (239x1a0554@gmail.com)...");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "239x1a0554@gmail.com",
      password: "newpassword123", // set during previous reset test
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log(`✓ Farmer login successful! Token received. User ID: ${loginData.user.id}`);

  // 4. Update Farmer Profile & Verify Broadcast
  console.log("\n[Step 4] Updating Farmer Profile via PUT /api/profile...");
  receivedEvents.length = 0; // Clear events

  const profileUpdateRes = await fetch(`${API_BASE}/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fullName: "Ramesh Organic Farms",
      phone: "+91 9876543210",
      region: "Guntur",
      primaryCrop: "Organic Chili",
      landArea: 15,
      farmingType: "Organic",
    }),
  });

  if (!profileUpdateRes.ok) {
    throw new Error(`Profile update failed: ${profileUpdateRes.status}`);
  }
  const profileUpdated = await profileUpdateRes.json();
  console.log(`✓ Farmer profile updated in MongoDB: ${profileUpdated.profile.fullName}`);

  // Wait for WS event
  await new Promise((r) => setTimeout(r, 500));
  const profileEvent = receivedEvents.find(
    (e) => e.type === "SYNC_EVENT" && e.entity === "farmer_profile" && e.action === "update"
  );
  if (!profileEvent) {
    throw new Error("Failed to receive farmer_profile update WebSocket broadcast!");
  }
  console.log("✓ Real-time Sync Event verified: farmer_profile update");
  console.log(`  Payload: Farmer="${profileEvent.data.full_name}", Region="${profileEvent.data.region}", PrimaryCrop="${profileEvent.data.primary_crop}"`);

  // 5. Create a New Product & Verify Broadcast
  console.log("\n[Step 5] Farmer Listing a New Product via POST /api/products...");
  receivedEvents.length = 0;

  const productCreateRes = await fetch(`${API_BASE}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "Guntur Teja Hot Chili",
      category: "Spices",
      price: 180,
      quantity: 500,
      unit: "kg",
      farmingType: "Organic",
      description: "Direct farm fresh sun-dried organic Guntur spicy red chilies.",
    }),
  });

  if (!productCreateRes.ok) {
    const errBody = await productCreateRes.text();
    throw new Error(`Product creation failed: ${productCreateRes.status} - ${errBody}`);
  }
  const createdProduct = await productCreateRes.json();
  const productId = createdProduct.product._id;
  console.log(`✓ Product created in MongoDB: ID=${productId}, Name="${createdProduct.product.name}"`);

  await new Promise((r) => setTimeout(r, 500));
  const productCreatedEvent = receivedEvents.find(
    (e) => e.type === "SYNC_EVENT" && e.entity === "product" && e.action === "create"
  );
  if (!productCreatedEvent) {
    throw new Error("Failed to receive product create WebSocket broadcast!");
  }
  console.log("✓ Real-time Sync Event verified: product create");
  console.log(`  Payload: Product="${productCreatedEvent.data.crop_name}", Price=₹${productCreatedEvent.data.expected_price}`);

  // 6. Update Product (Price/Stock Change) & Verify Broadcast
  console.log("\n[Step 6] Farmer updating stock and price via PUT /api/products/:id...");
  receivedEvents.length = 0;

  const productUpdateRes = await fetch(`${API_BASE}/products/${productId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      price: 165, // Discount
      quantity: 480,
    }),
  });

  if (!productUpdateRes.ok) {
    throw new Error(`Product update failed: ${productUpdateRes.status}`);
  }
  const updatedProduct = await productUpdateRes.json();
  console.log(`✓ Product updated in MongoDB: Price=₹${updatedProduct.product.price}`);

  await new Promise((r) => setTimeout(r, 500));
  const productUpdatedEvent = receivedEvents.find(
    (e) => e.type === "SYNC_EVENT" && e.entity === "product" && e.action === "update"
  );
  if (!productUpdatedEvent) {
    throw new Error("Failed to receive product update WebSocket broadcast!");
  }
  console.log("✓ Real-time Sync Event verified: product update");
  console.log(`  Payload: ID=${productUpdatedEvent.id}, New Price=₹${productUpdatedEvent.data.expected_price}`);

  // 7. Delete Product & Verify Broadcast
  console.log("\n[Step 7] Farmer deleting product via DELETE /api/products/:id...");
  receivedEvents.length = 0;

  const productDeleteRes = await fetch(`${API_BASE}/products/${productId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!productDeleteRes.ok) {
    throw new Error(`Product delete failed: ${productDeleteRes.status}`);
  }
  console.log(`✓ Product deleted from MongoDB`);

  await new Promise((r) => setTimeout(r, 500));
  const productDeletedEvent = receivedEvents.find(
    (e) => e.type === "SYNC_EVENT" && e.entity === "product" && e.action === "delete"
  );
  if (!productDeletedEvent) {
    throw new Error("Failed to receive product delete WebSocket broadcast!");
  }
  console.log("✓ Real-time Sync Event verified: product delete");
  console.log(`  Payload: Deleted Product ID=${productDeletedEvent.id}`);

  // 8. Clean up and close WS
  ws.close();
  console.log("\n=================================================");
  console.log("✓ ALL REAL-TIME SYNC & WEBSOCKET TESTS PASSED 100%");
  console.log("=================================================");
  process.exit(0);
}

runRealtimeSyncTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
