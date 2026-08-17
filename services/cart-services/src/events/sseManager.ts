import { Response } from "express";

// In plain words: a phonebook. Key = a user's id. Value = every open, still-connected browser tab/device currently listening for that user's cart updates (a user could have several - two tabs, plus their phone, all at once). A Set, not an array, so the same connection object can never accidentally get registered twice.
const connections = new Map<string, Set<Response>>();

export function registerConnection(userId: string, res: Response): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(res);
}

export function removeConnection(userId: string, res: Response): void {
  const userConnections = connections.get(userId);
  if (!userConnections) return;
  userConnections.delete(res);
  if (userConnections.size === 0) {
    connections.delete(userId); // tidy up - no point keeping an empty Set around forever
  }
}

/**
 * Pushes the current cart down every open connection this user has,
 * across every tab and every device/browser they're currently signed
 * in on. This is the actual "server tells the client" half of Approach
 * 3 - nothing on the frontend ever has to ask; this just happens the
 * instant the cart changes on the backend, for ANY reason (a direct
 * API call, or a Kafka event clearing it after an order).
 */
export function broadcastCartToUser(userId: string, cart: unknown): void {
  const userConnections = connections.get(userId);
  if (!userConnections) return;

  const payload = `data: ${JSON.stringify(cart)}\n\n`;
  for (const res of userConnections) {
    res.write(payload);
  }
}