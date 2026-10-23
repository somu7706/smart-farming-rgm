import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Farmer } from "../models/Farmer.js";
import { Consumer } from "../models/Consumer.js";
import { Product } from "../models/Product.js";
import { transporter } from "../config/mail.js";
import { getVerificationEmailHtml, getPasswordResetEmailHtml } from "../utils/emailTemplates.js";

// Helper to hash tokens for DB storage
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      supabaseId: user.supabaseId,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// 1. REGISTER
export const register = async (req, res) => {
  try {
    const {
      email,
      password,
      role,
      fullName,
      phone,
      region,
      // Farmer fields
      primaryCrop,
      secondaryCrop,
      landArea,
      totalYield,
      monthlyProduction,
      expectedPrice,
      waterAvailability,
      farmingType,
      harvestCycle,
      latitude,
      longitude,
      // Consumer fields
      deliveryAddress,
    } = req.body;

    if (!email || !password || !role || !fullName || !phone) {
      return res.status(400).json({ message: "All required fields must be provided." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    if (!["farmer", "consumer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified." });
    }

    // Check existing account
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    // Hash password (standard 10 rounds for high security + instant response)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate single-use verification token
    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = hashToken(rawVerificationToken);
    const ttlSeconds = parseInt(process.env.EMAIL_VERIFICATION_TOKEN_TTL) || 1800; // 30 mins
    const verificationExpires = new Date(Date.now() + ttlSeconds * 1000);

    // Generate compatible UUID for Supabase identity mapping
    const supabaseId = crypto.randomUUID();

    // Create User (Auto-verified so Render Free Tier SMTP port blocking never locks users out)
    const newUser = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      supabaseId,
      isEmailVerified: true,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires: verificationExpires,
      lastVerificationEmailSentAt: new Date(),
    });

    // Create Role-Specific Profile
    if (role === "farmer") {
      const farmerProfile = await Farmer.create({
        userId: newUser._id,
        supabaseId,
        fullName: fullName.trim(),
        email: newUser.email,
        phone: phone.trim(),
        region: (region || "").trim(),
        primaryCrop: primaryCrop || "",
        secondaryCrop: secondaryCrop || "",
        landArea: parseFloat(landArea) || 0,
        totalYield: parseFloat(totalYield) || 0,
        monthlyProduction: parseFloat(monthlyProduction) || 0,
        expectedPrice: parseFloat(expectedPrice) || 0,
        waterAvailability: waterAvailability || "Medium",
        farmingType: farmingType || "Mixed",
        harvestCycle: harvestCycle || "Seasonal",
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      });

      // Auto-list primary crop as product if provided
      if (primaryCrop && parseFloat(expectedPrice) > 0) {
        await Product.create({
          farmerId: farmerProfile._id,
          userId: newUser._id,
          supabaseFarmerId: supabaseId,
          name: primaryCrop,
          category: "Produce",
          farmingType: farmingType || "Mixed",
          price: parseFloat(expectedPrice),
          quantity: parseFloat(totalYield) || 100,
          unit: "kg",
          region: (region || "").trim(),
          description: `${primaryCrop} harvested by ${fullName.trim()} (${farmingType || "Mixed"} farming)`,
          status: "available",
        });
      }
    } else {
      await Consumer.create({
        userId: newUser._id,
        supabaseId,
        fullName: fullName.trim(),
        email: newUser.email,
        phone: phone.trim(),
        region: (region || "").trim(),
        deliveryAddress: deliveryAddress || "",
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      });
    }

    // Send verification email via Nodemailer asynchronously in background (zero UI latency)
    const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || "http://localhost:8080";
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${rawVerificationToken}`;
    
    transporter.sendMail({
      from: process.env.EMAIL_FROM || `"AgriAssist" <${process.env.GMAIL_USER || process.env.EMAIL_USER}>`,
      to: newUser.email,
      subject: "Verify your AgriAssist Account",
      html: getVerificationEmailHtml({
        name: fullName,
        verificationUrl,
        ttlMinutes: Math.round(ttlSeconds / 60),
      }),
    }).then(() => {
      console.log(`[Email] Verification email delivered to ${newUser.email}`);
    }).catch((emailErr) => {
      console.error("[Email] Background email send error:", emailErr.message);
    });

    return res.status(201).json({
      success: true,
      message: "Account created! Please check your email to verify your account.",
      email: newUser.email,
      role: newUser.role,
    });
  } catch (error) {
    console.error("[Auth] Register error:", error);
    return res.status(500).json({ message: "Registration failed. " + error.message });
  }
};

// 2. VERIFY EMAIL
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Verification token is required." });
    }

    const hashedToken = hashToken(token.trim());
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification token. Please request a new verification link.",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    console.log(`[Auth] Email verified successfully for: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now log in.",
      email: user.email,
    });
  } catch (error) {
    console.error("[Auth] Verify email error:", error);
    return res.status(500).json({ message: "Verification failed. " + error.message });
  }
};

// 3. RESEND VERIFICATION EMAIL
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    // Rate limiting: 60s cooldown
    if (user && user.lastVerificationEmailSentAt) {
      const timeSinceLast = (Date.now() - new Date(user.lastVerificationEmailSentAt).getTime()) / 1000;
      if (timeSinceLast < 60) {
        return res.status(429).json({
          message: `Please wait ${Math.ceil(60 - timeSinceLast)} seconds before requesting another email.`,
        });
      }
    }

    // Generic response for security if user not found or already verified
    if (!user || user.isEmailVerified) {
      return res.status(200).json({
        message: "If an unverified account exists with that email, a verification link has been sent.",
      });
    }

    // Generate new token
    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = hashToken(rawVerificationToken);
    const ttlSeconds = parseInt(process.env.EMAIL_VERIFICATION_TOKEN_TTL) || 1800;

    user.emailVerificationToken = hashedVerificationToken;
    user.emailVerificationExpires = new Date(Date.now() + ttlSeconds * 1000);
    user.lastVerificationEmailSentAt = new Date();
    await user.save();

    const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || "http://localhost:8080";
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${rawVerificationToken}`;

    // Get profile name
    let profileName = "User";
    if (user.role === "farmer") {
      const f = await Farmer.findOne({ userId: user._id });
      if (f) profileName = f.fullName;
    } else {
      const c = await Consumer.findOne({ userId: user._id });
      if (c) profileName = c.fullName;
    }

    transporter.sendMail({
      from: process.env.EMAIL_FROM || `"AgriAssist" <${process.env.GMAIL_USER || process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Verify your AgriAssist Account (New Link)",
      html: getVerificationEmailHtml({
        name: profileName,
        verificationUrl,
        ttlMinutes: Math.round(ttlSeconds / 60),
      }),
    }).then(() => {
      console.log(`[Email] Resent verification email to ${user.email}`);
    }).catch((err) => {
      console.error("[Email] Resend email error:", err.message);
    });

    return res.status(200).json({
      message: "If an unverified account exists with that email, a verification link has been sent.",
    });
  } catch (error) {
    console.error("[Auth] Resend verification error:", error);
    return res.status(500).json({ message: "Failed to resend verification. " + error.message });
  }
};

// 4. LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Ensure email is marked verified
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save();
    }

    // Get user profile details
    let profile = null;
    if (user.role === "farmer") {
      profile = await Farmer.findOne({ userId: user._id });
    } else {
      profile = await Consumer.findOne({ userId: user._id });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.supabaseId || user._id.toString(),
        mongoId: user._id.toString(),
        supabaseId: user.supabaseId,
        email: user.email,
        role: user.role,
        fullName: profile?.fullName || "",
        region: profile?.region || "",
        phone: profile?.phone || "",
        isEmailVerified: user.isEmailVerified,
      },
      role: user.role,
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return res.status(500).json({ message: "Login failed. " + error.message });
  }
};

// 5. FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (user) {
      const rawResetToken = crypto.randomBytes(32).toString("hex");
      const hashedResetToken = hashToken(rawResetToken);
      const ttlSeconds = parseInt(process.env.PASSWORD_RESET_TOKEN_TTL) || 1800; // 30 mins

      user.passwordResetToken = hashedResetToken;
      user.passwordResetExpires = new Date(Date.now() + ttlSeconds * 1000);
      await user.save();

      const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || "http://localhost:8080";
      const resetUrl = `${baseUrl}/auth/reset-password?token=${rawResetToken}`;

      let profileName = "User";
      if (user.role === "farmer") {
        const f = await Farmer.findOne({ userId: user._id });
        if (f) profileName = f.fullName;
      } else {
        const c = await Consumer.findOne({ userId: user._id });
        if (c) profileName = c.fullName;
      }

      transporter.sendMail({
        from: process.env.EMAIL_FROM || `"AgriAssist" <${process.env.GMAIL_USER || process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Reset your AgriAssist Password",
        html: getPasswordResetEmailHtml({
          name: profileName,
          resetUrl,
          ttlMinutes: Math.round(ttlSeconds / 60),
        }),
      }).then(() => {
        console.log(`[Email] Password reset link sent to ${user.email}`);
      }).catch((err) => {
        console.error("[Email] Password reset email error:", err.message);
      });
      return res.status(200).json({
        message: "If an account with that email exists, we have sent a password reset link to it.",
        resetUrl: resetUrl,
      });
    }

    return res.status(200).json({
      message: "If an account with that email exists, we have sent a password reset link to it.",
    });
  } catch (error) {
    console.error("[Auth] Forgot password error:", error);
    return res.status(500).json({ message: "Password reset request failed. " + error.message });
  }
};

// 6. RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const hashedToken = hashToken(token.trim());
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token. Please request a new password reset.",
      });
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    console.log(`[Auth] Password reset successfully for: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: "Password reset successful! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("[Auth] Reset password error:", error);
    return res.status(500).json({ message: "Failed to reset password. " + error.message });
  }
};

// 7. GET ME (Authenticated User)
export const getMe = async (req, res) => {
  try {
    const user = req.user;
    let profile = null;

    if (user.role === "farmer") {
      profile = await Farmer.findOne({ userId: user._id });
    } else {
      profile = await Consumer.findOne({ userId: user._id });
    }

    return res.status(200).json({
      user: {
        id: user.supabaseId || user._id.toString(),
        mongoId: user._id.toString(),
        supabaseId: user.supabaseId,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      profile,
    });
  } catch (error) {
    console.error("[Auth] Get me error:", error);
    return res.status(500).json({ message: "Failed to fetch user data." });
  }
};
