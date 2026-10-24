import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderTracking,
  getOrderStats,
} from "../controllers/orderController.js";

const router = express.Router();

// All order endpoints require valid authenticated session
router.use(authenticate);

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/stats", getOrderStats);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);
router.put("/:id/tracking", updateOrderTracking);

export default router;
