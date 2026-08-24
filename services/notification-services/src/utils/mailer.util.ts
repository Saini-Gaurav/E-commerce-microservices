import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

/**
 * Confirms a newsletter signup back to the SUBSCRIBER - the person who
 * just filled out the form. Standard practice for any real newsletter:
 * confirms their email actually works, and gives them proof they
 * really did sign up (protects against someone maliciously entering a
 * stranger's email address to spam them with unwanted mail).
 */
export async function sendNewsletterConfirmation(toEmail: string): Promise<void> {
  await transporter.sendMail({
    from: `"Herbsvedic" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "You're subscribed to Herbsvedic",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color: #3F5233;">Welcome to the list</h2>
        <p>You'll now hear from us about new products, wellness guidance, and the occasional offer.</p>
        <p style="color: #666; font-size: 13px;">Didn't sign up for this? You can safely ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Forwards a contact form submission to YOUR OWN inbox (EMAIL_USER) -
 * not to the customer. This is the actual "notification" half of
 * contact-form handling: you finding out someone reached out, not the
 * customer receiving anything at this stage.
 */
export async function sendContactNotification(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  await transporter.sendMail({
    from: `"Herbsvedic Contact Form" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER, // sending TO yourself
    replyTo: input.email, // clicking "Reply" in your inbox replies straight to the customer, not back to your own address
    subject: `New contact form message: ${input.subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: auto;">
        <h2 style="color: #3F5233;">New Contact Form Submission</h2>
        <p><strong>From:</strong> ${input.name} (${input.email})</p>
        <p><strong>Subject:</strong> ${input.subject}</p>
        <p style="white-space: pre-wrap; border-left: 3px solid #C89B3C; padding-left: 12px;">${input.message}</p>
      </div>
    `,
  });
}