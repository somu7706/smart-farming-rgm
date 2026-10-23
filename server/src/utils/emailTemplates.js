export const getVerificationEmailHtml = ({ name, verificationUrl, ttlMinutes }) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your AgriAssist Account</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: linear-gradient(135deg, #15803d, #16a34a); padding: 32px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">AgriAssist</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Smart Farming & Produce Direct Marketplace</p>
      </div>
      <div style="padding: 32px 28px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0;">Welcome, ${name || "Farmer/Consumer"}!</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #475569;">
          Thank you for creating an account with AgriAssist. To activate your account and start exploring market prices, agricultural tools, and direct produce trade, please verify your email address.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}" style="background-color: #16a34a; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.3);">
            Verify My Email
          </a>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
          This verification link is single-use and will expire in <strong>${ttlMinutes} minutes</strong>.
        </p>
        <p style="font-size: 13px; line-height: 1.5; color: #94a3b8; word-break: break-all;">
          If the button above does not work, copy and paste this link into your browser:<br>
          <a href="${verificationUrl}" style="color: #16a34a;">${verificationUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          If you did not create an AgriAssist account, please safely ignore this email.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const getPasswordResetEmailHtml = ({ name, resetUrl, ttlMinutes }) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your AgriAssist Password</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 32px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">AgriAssist</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Password Reset Request</p>
      </div>
      <div style="padding: 32px 28px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0;">Hello, ${name || "User"}</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #475569;">
          We received a request to reset the password for your AgriAssist account. Click the button below to choose a new password:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3);">
            Reset Password
          </a>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
          This link will expire in <strong>${ttlMinutes} minutes</strong> and can only be used once.
        </p>
        <p style="font-size: 13px; line-height: 1.5; color: #94a3b8; word-break: break-all;">
          If the button above does not work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #0284c7;">${resetUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          If you did not request this password reset, please ignore this email. Your current password remains secure.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
};
