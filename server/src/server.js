import dotenv from "dotenv";
dotenv.config();

import http from "http";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { verifyMailConnection } from "./config/mail.js";
import { syncManager } from "./config/websocket.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://127.0.0.1:8080",
      process.env.APP_BASE_URL,
    ].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "AgriAssist MongoDB Auth & Produce Service",
    timestamp: new Date().toISOString(),
  });
});

// Diagnostics: Test live email delivery
app.get("/api/test-email", async (req, res) => {
  const { to } = req.query;
  const targetEmail = to || "somu7075267357@gmail.com";
  try {
    const { transporter } = await import("./config/mail.js");
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"AgriAssist" <${process.env.GMAIL_USER || process.env.EMAIL_USER}>`,
      to: targetEmail,
      subject: "AgriAssist SMTP Live Delivery Test",
      text: "Testing outbound email directly from Render backend to " + targetEmail,
    });
    return res.json({
      success: true,
      deliveredTo: targetEmail,
      messageId: info.messageId,
      response: info.response,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      configuredUser: process.env.GMAIL_USER || process.env.EMAIL_USER || "NOT_SET",
      hasPassword: !!(process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS),
    });
  }
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
});

// Start Server
const startServer = async () => {
  await connectDB();
  await verifyMailConnection();

  // Initialize Real-Time Sync WebSocket Server
  syncManager.initialize(server);

  server.listen(PORT, () => {
    console.log(`[AgriAssist Server] Running on http://localhost:${PORT}`);
    console.log(`[AgriAssist Server] WebSocket Sync: ws://localhost:${PORT}/ws/sync`);
    console.log(`[AgriAssist Server] Health check: http://localhost:${PORT}/api/health`);
  });
};

startServer();
