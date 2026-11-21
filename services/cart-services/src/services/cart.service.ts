import {
  ensureCartExists,
  getCartItems,
  findCartItem,
  upsertCartItem,
  setCartItemQuantity,
  removeCartItem,
  clearCartItems,
} from "../repositories/cart.repository";
import { findProductInCache } from "../repositories/productCache.repository";
import { ServiceError } from "../utils/errors";
import { broadcastCartToUser } from "../events/sseManager";

export interface CartItemResponse {
  productId: string;
  quantity: number;
  lineTotal: number; // price * quantity, 0 if product is missing
}

export interface CartResponse {
  items: CartItemResponse[];
  itemCount: number;
  subtotal: number;
}

async function enrichCartItems(
  items: { productId: string; quantity: number }[]
): Promise<CartItemResponse[]> {
  const enriched = await Promise.all(
    items.map(async (item) => {
      const cached = await findProductInCache(item.productId);
      const product = cached
        ? { id: cached.id, name: cached.name, price: Number(cached.price), image: cached.image, countInStock: cached.count_in_stock }
        : null;
      return {
        productId: item.productId,
        quantity: item.quantity,
        product,
        lineTotal: product ? product.price * item.quantity : 0,
      };
    })
  );
  return enriched;
}

export async function getCart(userId: string): Promise<CartResponse> {
  await ensureCartExists(userId);
  const rows = await getCartItems(userId);

  const items = await enrichCartItems(
    rows.map((r) => ({ productId: r.product_id, quantity: r.quantity }))
  );

  return {
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
  };
}

export async function addItem(
  userId: string,
  productId: string,
  quantity: number
): Promise<CartResponse> {
  if (quantity < 1) {
    throw new ServiceError("quantity must be at least 1", 400);
  }

  const product = await findProductInCache(productId);
  if (!product) {
    throw new ServiceError("Product not found", 404);
  }

  await ensureCartExists(userId);
  await upsertCartItem(userId, productId, quantity);

  const cart = await getCart(userId);
  broadcastCartToUser(userId, cart);
  return cart;
}

export async function updateItemQuantity(
  userId: string,
  productId: string,
  quantity: number
): Promise<CartResponse> {
  if (quantity < 1) {
    throw new ServiceError("quantity must be at least 1 - use DELETE to remove an item", 400);
  }

  const existing = await findCartItem(userId, productId);
  if (!existing) {
    throw new ServiceError("This product is not in your cart", 404);
  }

  await setCartItemQuantity(userId, productId, quantity);
  const cart = await getCart(userId);
  broadcastCartToUser(userId, cart);
  return cart;
}

export async function removeItem(userId: string, productId: string): Promise<CartResponse> {
  const removed = await removeCartItem(userId, productId);
  if (!removed) {
    throw new ServiceError("This product is not in your cart", 404);
  }
  const cart = await getCart(userId);
  broadcastCartToUser(userId, cart);
  return cart;
}

export async function clearCart(userId: string): Promise<void> {
  await clearCartItems(userId);
  broadcastCartToUser(userId, { items: [], itemCount: 0, subtotal: 0 });
}