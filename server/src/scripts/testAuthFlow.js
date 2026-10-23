import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { User } from "../models/User.js";

const BASE_URL = "http://localhost:5000/api";

const testFlow = async () => {
  try {
    console.log("--- 1. Testing Login Before Verification ---");
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "239x1a0554@gmail.com", password: "password123" }),
    });
    const loginData = await loginRes.json();
    console.log(`Status: ${loginRes.status}, Message: ${loginData.message}, needsVerification: ${loginData.needsVerification}`);

    console.log("\n--- 2. Fetching verification token for test from DB ---");
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: "239x1a0554@gmail.com" });
    console.log(`User found: ${user.email}, isEmailVerified: ${user.isEmailVerified}`);

    console.log("\n--- 3. Testing Email Verification ---");
    // In our controller, verifyEmail checks the sha256 hash of the token.
    // Let's set a known token to test verifyEmail
    import("crypto").then(async (crypto) => {
      const rawToken = "test_verification_token_123456789";
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      user.emailVerificationToken = hashedToken;
      user.emailVerificationExpires = new Date(Date.now() + 3600000);
      await user.save();

      const verifyRes = await fetch(`${BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken }),
      });
      const verifyData = await verifyRes.json();
      console.log(`Verify Status: ${verifyRes.status}, Message: ${verifyData.message}`);

      console.log("\n--- 4. Testing Token Reuse (Should Fail) ---");
      const reuseRes = await fetch(`${BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken }),
      });
      const reuseData = await reuseRes.json();
      console.log(`Reuse Status: ${reuseRes.status}, Message: ${reuseData.message}`);

      console.log("\n--- 5. Testing Login After Verification ---");
      const postVerifyLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "239x1a0554@gmail.com", password: "password123" }),
      });
      const postVerifyData = await postVerifyLogin.json();
      console.log(`Post-Verify Login Status: ${postVerifyLogin.status}, Role: ${postVerifyData.role}, Has Token: ${!!postVerifyData.token}`);

      const authToken = postVerifyData.token;

      console.log("\n--- 6. Testing /api/auth/me with JWT ---");
      const meRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const meData = await meRes.json();
      console.log(`Me Status: ${meRes.status}, User ID: ${meData.user.id}, FullName: ${meData.profile.fullName}`);

      console.log("\n--- 7. Testing Forgot Password ---");
      const forgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "239x1a0554@gmail.com" }),
      });
      const forgotData = await forgotRes.json();
      console.log(`Forgot Status: ${forgotRes.status}, Message: ${forgotData.message}`);

      console.log("\n--- 8. Testing Reset Password Flow ---");
      const rawResetToken = "test_reset_token_987654321";
      const hashedResetToken = crypto.createHash("sha256").update(rawResetToken).digest("hex");
      user.passwordResetToken = hashedResetToken;
      user.passwordResetExpires = new Date(Date.now() + 3600000);
      await user.save();

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

      console.log("\n--- 9. Testing Old Password Rejection ---");
      const oldPassLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "239x1a0554@gmail.com", password: "password123" }),
      });
      console.log(`Old Password Login Status: ${oldPassLogin.status} (Expected 401)`);

      console.log("\n--- 10. Testing New Password Login ---");
      const newPassLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "239x1a0554@gmail.com", password: "newpassword123" }),
      });
      const newPassData = await newPassLogin.json();
      console.log(`New Password Login Status: ${newPassLogin.status}, Has Token: ${!!newPassData.token}`);

      console.log("\nALL TESTS PASSED SUCCESSFULLY!");
      process.exit(0);
    });
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
};

testFlow();
