import nodemailer from "nodemailer";

// A "transporter" is Nodemailer's word for "the actual connection to the email provider that will send this." Built once, reused for every email this service ever sends - not recreated per request.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export async function sendOtpEmail(toEmail: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: `"Herbsvedic" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Verify your Herbsvedic account",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color: #3F5233;">Verify your email</h2>
        <p>Your one-time verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1F2A1C;">${otp}</p>
        <p style="color: #666; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}