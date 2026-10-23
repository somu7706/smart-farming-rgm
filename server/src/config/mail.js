import "dotenv/config";
import nodemailer from "nodemailer";
import { Resend } from "resend";

const user = (process.env.GMAIL_USER || process.env.EMAIL_USER || "").trim();
const pass = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || "").replace(/\s+/g, "");

// Raw SMTP Transporter (for local dev or instances with unblocked SMTP ports)
const smtpTransporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
  tls: {
    rejectUnauthorized: false,
  },
});

// Initialize Resend HTTPS client if API key is provided (Required for Render Free tier to bypass SMTP firewall)
let resendClient = null;
if (process.env.RESEND_API_KEY) {
  resendClient = new Resend(process.env.RESEND_API_KEY.trim());
  console.log("[Mail Engine] Resend HTTPS API transport initialized (Port 443 active)");
}

export const sendAppEmail = async ({ from, to, subject, html, text }) => {
  // Option 1: Resend HTTPS REST API (Bypasses Render cloud port 465/587 blocks)
  if (resendClient) {
    try {
      const sender = process.env.RESEND_FROM || "AgriAssist <onboarding@resend.dev>";
      const { data, error } = await resendClient.emails.send({
        from: sender,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      });

      if (error) {
        console.error("[Resend API Error]:", error);
        throw new Error(error.message);
      }

      console.log(`[Email] Delivered successfully via Resend HTTPS API to ${to}. Message ID: ${data?.id}`);
      return { messageId: data?.id, response: "250 OK (Resend HTTPS)" };
    } catch (apiErr) {
      console.warn("[Resend Failed, falling back to SMTP]:", apiErr.message);
    }
  }

  // Option 2: Fallback to Nodemailer SMTP
  const sender = from || process.env.EMAIL_FROM || `"AgriAssist" <${user}>`;
  return smtpTransporter.sendMail({ from: sender, to, subject, html, text });
};

// Universal proxy object to ensure 100% drop-in compatibility with existing transporter.sendMail calls
export const transporter = {
  sendMail: sendAppEmail,
  verify: async () => {
    if (resendClient) {
      console.log("[Mail Engine] Resend HTTPS transport active — ready to deliver.");
      return true;
    }
    try {
      if (!user || !pass) {
        console.warn("[Nodemailer] Warning: Gmail credentials not fully set.");
        return false;
      }
      await smtpTransporter.verify();
      console.log(`[Nodemailer] SMTP connection verified successfully for ${user}`);
      return true;
    } catch (error) {
      console.warn("[Nodemailer] SMTP Note (Render Free blocks port 465, add RESEND_API_KEY for guaranteed delivery):", error.message);
      return false;
    }
  },
};

export const verifyMailConnection = transporter.verify;
