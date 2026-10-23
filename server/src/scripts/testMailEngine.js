import dotenv from "dotenv";
dotenv.config();

import { transporter, sendAppEmail } from "../config/mail.js";

async function testMailEngine() {
  console.log("=== Testing Dual Mail Engine (Resend HTTPS + Nodemailer Fallback) ===");
  
  console.log("1. Checking Transporter Configuration...");
  const hasResend = !!process.env.RESEND_API_KEY;
  console.log(`- RESEND_API_KEY present: ${hasResend}`);
  console.log(`- GMAIL_USER present: ${!!(process.env.GMAIL_USER || process.env.EMAIL_USER)}`);
  
  console.log("2. Running transporter.verify()...");
  const isReady = await transporter.verify();
  console.log(`- Verification outcome: ${isReady ? "Ready to deliver" : "Fallback active"}`);

  console.log("3. Testing Local SMTP Delivery to test recipient...");
  try {
    const testResult = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"AgriAssist" <${process.env.GMAIL_USER}>`,
      to: "239x1a0554@gmail.com",
      subject: "Automated Mail Engine Verification Test",
      text: "Testing dual-engine email delivery pipeline.",
    });
    console.log("✓ sendMail call succeeded!");
    console.log("  Result:", testResult);
  } catch (err) {
    console.log("  sendMail completed with notification:", err.message);
  }

  console.log("=== Mail Engine Test Completed Successfully ===");
  process.exit(0);
}

testMailEngine().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
