import { Request, Response } from "express";
import * as cartService from "../services/cart.service";
import { handleServiceError } from "../utils/errors";
import { registerConnection, removeConnection } from "../events/sseManager";

export async function getCartHandler(req: Request, res: Response): Promise<void> {
  try {
    const cart = await cartService.getCart(req.user!.userId);
    res.status(200).json({ cart });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function addItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { productId, quantity } = req.body;
    if (!productId) {
      res.status(400).json({ message: "productId is required" });
      return;
    }

    const cart = await cartService.addItem(
      req.user!.userId,
      productId,
      quantity ? Number(quantity) : 1
    );
    res.status(200).json({ cart });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function updateItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { quantity } = req.body;
    const cart = await cartService.updateItemQuantity(
      req.user!.userId,
      req.params.productId,
      Number(quantity)
    );
    res.status(200).json({ cart });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function removeItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const cart = await cartService.removeItem(req.user!.userId, req.params.productId);
    res.status(200).json({ cart });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function clearCartHandler(req: Request, res: Response): Promise<void> {
  try {
    await cartService.clearCart(req.user!.userId);
    res.status(200).json({ message: "Cart cleared" });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function cartStreamHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  // These three headers are what tell the browser "this isn't a
  // normal response that finishes - keep this connection open and
  // treat every 'data: ...' line I send as a separate incoming
  // message, indefinitely."
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send the real current cart immediately on connect - otherwise the
  // tab would just sit there with nothing until the NEXT change
  // happens, which could be minutes away.
  const initialCart = await cartService.getCart(userId);
  res.write(`data: ${JSON.stringify(initialCart)}\n\n`);

  registerConnection(userId, res);

  // A ": heartbeat" comment line every 20s - the leading colon makes
  // SSE treat it as a comment, invisible to the frontend's message
  // handler. Its only job is stopping proxies/load balancers from
  // deciding an idle connection is dead and silently closing it.
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 20000);

  // Fires when the browser tab closes, or the connection otherwise
  // drops - this is the cleanup that keeps the Map in sseManager.ts
  // from slowly filling up with dead, disconnected entries forever.
  req.on("close", () => {
    clearInterval(heartbeat);
    removeConnection(userId, res);
  });
}