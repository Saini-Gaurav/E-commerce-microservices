import { query } from "../config/db";

export interface NewsletterSubscriberRow {
  id: string;
  email: string;
  is_active: boolean;
  subscribed_at: Date;
  unsubscribed_at: Date | null;
}

export async function findSubscriberByEmail(email: string): Promise<NewsletterSubscriberRow | null> {
  const result = await query<NewsletterSubscriberRow>(
    "SELECT * FROM newsletter_subscribers WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  return result.rows[0] ?? null;
}

export async function createSubscriber(email: string): Promise<NewsletterSubscriberRow> {
  const result = await query<NewsletterSubscriberRow>(
    "INSERT INTO newsletter_subscribers (email) VALUES ($1) RETURNING *",
    [email]
  );
  return result.rows[0];
}

/**
 * Re-subscribes someone who previously unsubscribed, rather than
 * creating a second row for the same email - the unique index on
 * LOWER(email) would reject a duplicate insert anyway, so this is the
 * correct path for "I left, now I'm back," not an edge case to ignore.
 */
export async function reactivateSubscriber(email: string): Promise<NewsletterSubscriberRow> {
  const result = await query<NewsletterSubscriberRow>(
    `UPDATE newsletter_subscribers
     SET is_active = true, unsubscribed_at = NULL, subscribed_at = now()
     WHERE LOWER(email) = LOWER($1)
     RETURNING *`,
    [email]
  );
  return result.rows[0];
}

export async function listActiveSubscribers(limit: number, offset: number): Promise<NewsletterSubscriberRow[]> {
  const result = await query<NewsletterSubscriberRow>(
    `SELECT * FROM newsletter_subscribers WHERE is_active = true ORDER BY subscribed_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

export async function countActiveSubscribers(): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true"
  );
  return Number(result.rows[0].count);
}