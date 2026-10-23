import "dotenv/config";
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
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
