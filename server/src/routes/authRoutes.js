import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  getMe,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Rate limiters for security
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: { message: "Too many authentication attempts. Please try again later." },
});

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many email requests. Please try again later." },
});

router.post("/register", authLimiter, register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", emailLimiter, resendVerification);
router.post("/login", authLimiter, login);
router.post("/forgot-password", emailLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.get("/me", authenticate, getMe);

export default router;
