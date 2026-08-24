import { createContactMessage, listContactMessages, countContactMessages } from "../repositories/contact.repository";
import { sendContactNotification } from "../utils/mailer.util";

export async function submitContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  // Save it FIRST, then email - if the email send fails for some reason (Gmail hiccup, quota), the actual message is still safely recorded and recoverable by checking the database, rather than being lost entirely because an email didn't go out.
  await createContactMessage(input);
  await sendContactNotification(input);
}

export async function listMessages(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    listContactMessages(limit, offset),
    countContactMessages(),
  ]);

  return {
    messages: messages.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      subject: m.subject,
      message: m.message,
      isRead: m.is_read,
      createdAt: m.created_at,
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}