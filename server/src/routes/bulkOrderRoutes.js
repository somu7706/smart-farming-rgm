import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  createBulkOrder,
  getBulkOrders,
  getBulkOrderById,
  commitToBulkOrder,
} from "../controllers/bulkOrderController.js";

const router = express.Router();

router.use(authenticate);

router.post("/", createBulkOrder);
router.get("/", getBulkOrders);
router.get("/:id", getBulkOrderById);
router.post("/:id/commit", commitToBulkOrder);

export default router;
