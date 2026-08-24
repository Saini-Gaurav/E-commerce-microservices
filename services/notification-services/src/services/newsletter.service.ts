import {
  findSubscriberByEmail,
  createSubscriber,
  reactivateSubscriber,
  listActiveSubscribers,
  countActiveSubscribers,
} from "../repositories/newsletter.repository";
import { sendNewsletterConfirmation } from "../utils/mailer.util";
import { ServiceError } from "../utils/errors";

export async function subscribe(email: string): Promise<void> {
  const existing = await findSubscriberByEmail(email);

  if (existing?.is_active) {
    throw new ServiceError("This email is already subscribed", 409);
  }

  if (existing && !existing.is_active) {
    await reactivateSubscriber(email);
  } else {
    await createSubscriber(email);
  }

  await sendNewsletterConfirmation(email);
}

export async function listSubscribers(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [subscribers, total] = await Promise.all([
    listActiveSubscribers(limit, offset),
    countActiveSubscribers(),
  ]);

  return {
    subscribers: subscribers.map((s) => ({
      id: s.id,
      email: s.email,
      subscribedAt: s.subscribed_at,
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}