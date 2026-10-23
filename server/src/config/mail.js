import "dotenv/config";
import nodemailer from "nodemailer";
import { Resend } from "resend";

const user = (process.env.GMAIL_USER || process.env.EMAIL_USER || "").trim();
const pass = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || "").replace(/\s+/g, "");

// Raw SMTP Transporter
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

// Initialize Resend HTTPS client (Bypasses Render cloud port 465/587 blocks)
const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

if (resendClient) {
  console.log("[Mail Engine] Resend HTTPS API transport initialized (Port 443 active)");
}

export const sendAppEmail = async ({ from, to, subject, html, text }) => {
  // Option 1: Resend HTTPS REST API (Bypasses Render cloud port 465/587 blocks)
  if (resendClient) {
    try {
      const sender = process.env.RESEND_FROM || "AgriAssist <onboarding@resend.dev>";
      const recipientList = Array.isArray(to) ? to : [to];

      let result = await resendClient.emails.send({
        from: sender,
        to: recipientList,
        subject,
        html,
        text,
      });

      // Handle Resend sandbox restriction automatically (deliver to registered account owner someswar7706@gmail.com)
      if (result.error && result.error.message?.includes("only send testing emails to your own email address")) {
        console.warn(`[Resend Sandbox] Redirecting to account owner someswar7706@gmail.com (originally for: ${to})`);
        const banner = `
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #92400e;">
            <strong>ℹ️ Resend Sandbox Notice:</strong> This email was requested for <code>${to}</code>.
          </div>
        `;
        result = await resendClient.emails.send({
          from: sender,
          to: ["someswar7706@gmail.com"],
          subject: `[AgriAssist] ${subject}`,
          html: banner + html,
          text: `[Originally for ${to}]\n\n${text}`,
        });
      }

      if (result.error) {
        throw new Error(result.error.message);
      }

      console.log(`[Email] Delivered successfully via Resend HTTPS API! Message ID: ${result.data?.id}`);
      return { messageId: result.data?.id, response: "250 OK (Resend HTTPS)" };
    } catch (apiErr) {
      console.warn("[Resend Error, falling back to SMTP]:", apiErr.message);
    }
  }

  // Option 2: Fallback to Nodemailer SMTP
  const sender = from || process.env.EMAIL_FROM || `"AgriAssist" <${user}>`;
  return smtpTransporter.sendMail({ from: sender, to, subject, html, text });
};

// Universal proxy object
export const transporter = {
  sendMail: sendAppEmail,
  verify: async () => {
    if (resendClient) {
      console.log("[Mail Engine] Resend HTTPS transport active — ready to deliver over port 443.");
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
      console.warn("[Nodemailer] SMTP Note:", error.message);
      return false;
    }
  },
};

export const verifyMailConnection = transporter.verify;
