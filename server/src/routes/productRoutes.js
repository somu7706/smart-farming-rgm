import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

// Public product browsing & search
router.get("/", getProducts);
router.get("/:id", getProductById);

// Farmer only product management
router.post("/", authenticate, requireRole("farmer"), createProduct);
router.put("/:id", authenticate, requireRole("farmer"), updateProduct);
router.delete("/:id", authenticate, requireRole("farmer"), deleteProduct);

export default router;
