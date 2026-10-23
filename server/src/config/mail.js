import "dotenv/config";
import nodemailer from "nodemailer";

const user = (process.env.GMAIL_USER || process.env.EMAIL_USER || "").trim();
const pass = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || "").replace(/\s+/g, "");

export const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
  tls: {
    rejectUnauthorized: false,
  },
});

export const verifyMailConnection = async () => {
  try {
    await transporter.verify();
    console.log(`[Nodemailer] SMTP connection verified successfully for ${process.env.GMAIL_USER}`);
    return true;
  } catch (error) {
    console.error("[Nodemailer] SMTP Verification failed:", error.message);
    return false;
  }
};
