import { Router } from "express";
import {
  getProfile,
  updateProfile,
  getFarmers,
  getFarmerById,
} from "../controllers/profileController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Current user profile (Protected)
router.get("/", authenticate, getProfile);
router.put("/", authenticate, updateProfile);

// Public farmer directory & details
router.get("/farmers", getFarmers);
router.get("/farmers/:id", getFarmerById);

export default router;
