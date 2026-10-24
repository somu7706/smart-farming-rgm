import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import crypto from "crypto";
import { User } from "../models/User.js";
import { Farmer } from "../models/Farmer.js";
import { Product } from "../models/Product.js";

const BASE_URL = "http://localhost:5000/api";
const TEST_EMAIL = "239x1a0554@gmail.com";

const testFlow = async () => {
  try {
    console.log("=== AGRIASSIST COMPLETE AUTHENTICATION FLOW TEST ===");

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB Atlas");

    // Clean up any existing test user records
    const existing = await User.findOne({ email: TEST_EMAIL });
    if (existing) {
      await Farmer.deleteMany({ userId: existing._id });
      await Product.deleteMany({ userId: existing._id });
      await User.deleteOne({ _id: existing._id });
      console.log("✓ Cleaned up prior test account records");
    }

    // --- 1. Test Registration ---
    console.log("\n--- 1. Testing Registration (Farmer Account) ---");
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: "password123",
        role: "farmer",
        fullName: "Ramesh Sharma",
        phone: "+91 9876543210",
        region: "Guntur, Andhra Pradesh",
        primaryCrop: "Chilli",
        secondaryCrop: "Cotton",
        landArea: 10,
        totalYield: 3000,
        monthlyProduction: 600,
        expectedPrice: 120,
        waterAvailability: "High",
        farmingType: "Organic",
        harvestCycle: "Seasonal",
      }),
    });
    const regData = await regRes.json();
    console.log(`Registration Status: ${regRes.status}, Message: ${regData.message}`);
    if (regRes.status !== 201) throw new Error("Registration failed");

    // Verify account state in DB
    const freshUser = await User.findOne({ email: TEST_EMAIL });
    console.log(`User created: ${freshUser.email}, isEmailVerified: ${freshUser.isEmailVerified} (Must be false)`);
    if (freshUser.isEmailVerified !== false) throw new Error("New user should NOT be verified yet!");

    // --- 2. Test Login Before Verification ---
    console.log("\n--- 2. Testing Login Before Verification (Must be Rejected) ---");
    const preVerifyLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: "password123" }),
    });
    const preVerifyData = await preVerifyLogin.json();
    console.log(`Pre-verify Login Status: ${preVerifyLogin.status} (Expected 403), needsVerification: ${preVerifyData.needsVerification}`);
    if (preVerifyLogin.status !== 403 || !preVerifyData.needsVerification) {
      throw new Error("Unverified login must be blocked with 403 and needsVerification: true");
    }

    // --- 3. Test Email Verification ---
    console.log("\n--- 3. Testing Email Verification with Valid Token ---");
    const rawToken = "test_verification_token_123456789";
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    freshUser.emailVerificationToken = hashedToken;
    freshUser.emailVerificationExpires = new Date(Date.now() + 3600000);
    await freshUser.save();

    const verifyRes = await fetch(`${BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken }),
    });
    const verifyData = await verifyRes.json();
    console.log(`Verify Status: ${verifyRes.status}, Message: ${verifyData.message}`);
    if (verifyRes.status !== 200) throw new Error("Email verification failed");

    // Check DB verified status
    const verifiedUser = await User.findOne({ email: TEST_EMAIL });
    console.log(`DB isEmailVerified: ${verifiedUser.isEmailVerified}, Token cleared: ${verifiedUser.emailVerificationToken === null}`);
    if (!verifiedUser.isEmailVerified || verifiedUser.emailVerificationToken !== null) {
      throw new Error("User was not marked verified or token was not invalidated");
    }

    // --- 4. Test Single-Use Token Invalidation (Reuse Attack) ---
    console.log("\n--- 4. Testing Token Reuse (Must Fail) ---");
    const reuseRes = await fetch(`${BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken }),
    });
    const reuseData = await reuseRes.json();
    console.log(`Reuse Status: ${reuseRes.status} (Expected 400), Message: ${reuseData.message}`);
    if (reuseRes.status !== 400) throw new Error("Reusing an already-used token should fail with 400!");

    // --- 5. Test Login After Verification ---
    console.log("\n--- 5. Testing Login After Verification ---");
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: "password123" }),
    });
    const loginData = await loginRes.json();
    console.log(`Login Status: ${loginRes.status}, Role: ${loginData.role}, Has Token: ${!!loginData.token}`);
    if (loginRes.status !== 200 || !loginData.token) throw new Error("Post-verification login failed");

    const authToken = loginData.token;

    // --- 6. Testing /api/auth/me with JWT ---
    console.log("\n--- 6. Testing /api/auth/me Protected Endpoint ---");
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const meData = await meRes.json();
    console.log(`Me Status: ${meRes.status}, User ID: ${meData.user.id}, FullName: ${meData.profile.fullName}`);
    if (meRes.status !== 200 || meData.profile.fullName !== "Ramesh Sharma") {
      throw new Error("Protected /api/auth/me failed");
    }

    // --- 7. Testing Forgot Password Flow ---
    console.log("\n--- 7. Testing Forgot Password ---");
    const forgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const forgotData = await forgotRes.json();
    console.log(`Forgot Status: ${forgotRes.status}, Message: ${forgotData.message}`);
    if (forgotRes.status !== 200) throw new Error("Forgot password request failed");

    // --- 8. Testing Reset Password Flow ---
    console.log("\n--- 8. Testing Reset Password with Token ---");
    const rawResetToken = "test_reset_token_987654321";
    const hashedResetToken = crypto.createHash("sha256").update(rawResetToken).digest("hex");
    const userForReset = await User.findOne({ email: TEST_EMAIL });
    userForReset.passwordResetToken = hashedResetToken;
    userForReset.passwordResetExpires = new Date(Date.now() + 3600000);
    await userForReset.save();

    const resetRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawResetToken,
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      }),
    });
    const resetData = await resetRes.json();
    console.log(`Reset Status: ${resetRes.status}, Message: ${resetData.message}`);
    if (resetRes.status !== 200) throw new Error("Reset password failed");

    // --- 9. Testing Old Password Rejection ---
    console.log("\n--- 9. Testing Old Password Rejection ---");
    const oldPassLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: "password123" }),
    });
    console.log(`Old Password Login Status: ${oldPassLogin.status} (Expected 401)`);
    if (oldPassLogin.status !== 401) throw new Error("Old password should have been rejected!");

    // --- 10. Testing New Password Login ---
    console.log("\n--- 10. Testing New Password Login ---");
    const newPassLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: "newpassword123" }),
    });
    const newPassData = await newPassLogin.json();
    console.log(`New Password Login Status: ${newPassLogin.status}, Has Token: ${!!newPassData.token}`);
    if (newPassLogin.status !== 200 || !newPassData.token) throw new Error("New password login failed");

    console.log("\n=================================================");
    console.log("✓ ALL 10 AUTHENTICATION & VERIFICATION TESTS PASSED 100%");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
};

testFlow();
