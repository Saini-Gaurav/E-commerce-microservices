import { Response } from "express";

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
    connections.delete(userId); 
  }
}

export function broadcastCartToUser(userId: string, cart: unknown): void {
  const userConnections = connections.get(userId);
  if (!userConnections) return;

  const payload = `data: ${JSON.stringify(cart)}\n\n`;
  for (const res of userConnections) {
    res.write(payload);
  }
}