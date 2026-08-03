import { Request, Response } from "express";
import * as cartService from "../services/cart.service";
import { handleServiceError } from "../utils/errors";

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