import {
  ensureCartExists,
  getCartItems,
  findCartItem,
  upsertCartItem,
  setCartItemQuantity,
  removeCartItem,
  clearCartItems,
} from "../repositories/cart.repository";
import { fetchProduct, ProductSnapshot } from "../clients/productService.client";
import { ServiceError } from "../utils/errors";

// What we actually send back to the app: each cart line PLUS the product's live name/price/image, not just a bare productId+quantity.
export interface CartItemResponse {
  productId: string;
  quantity: number;
  product: ProductSnapshot | null; // null if the product was deleted after being added to the cart
  lineTotal: number; // price * quantity, 0 if product is missing
}

export interface CartResponse {
  items: CartItemResponse[];
  itemCount: number;
  subtotal: number;
}

/**
 * Fetches product details for every item in the cart AT THE SAME TIME
 * (Promise.all), not one after another. If you had 10 items and asked
 * product-service one at a time, that's 10x slower than asking for all
 * 10 at once and waiting for the slowest one to finish.
 */
async function enrichCartItems(
  items: { productId: string; quantity: number }[]
): Promise<CartItemResponse[]> {
  const enriched = await Promise.all(
    items.map(async (item) => {
      const product = await fetchProduct(item.productId);
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

  // Check with product-service FIRST, before touching our own database - no point saving a cart line for a product that doesn't even exist.
  const product = await fetchProduct(productId);
  if (!product) {
    throw new ServiceError("Product not found", 404);
  }

  await ensureCartExists(userId);
  await upsertCartItem(userId, productId, quantity);

  return getCart(userId);
}

export async function updateItemQuantity(
  userId: string,
  productId: string,
  quantity: number
): Promise<CartResponse> {
  if (quantity < 1) {
    // On purpose: setting quantity to 0 is ambiguous ("did they mean
    // remove it, or make a typo?"). Removing an item should be an
    // explicit, unambiguous action - that's what DELETE is for.
    throw new ServiceError("quantity must be at least 1 - use DELETE to remove an item", 400);
  }

  const existing = await findCartItem(userId, productId);
  if (!existing) {
    throw new ServiceError("This product is not in your cart", 404);
  }

  await setCartItemQuantity(userId, productId, quantity);
  return getCart(userId);
}

export async function removeItem(userId: string, productId: string): Promise<CartResponse> {
  const removed = await removeCartItem(userId, productId);
  if (!removed) {
    throw new ServiceError("This product is not in your cart", 404);
  }
  return getCart(userId);
}

export async function clearCart(userId: string): Promise<void> {
  await clearCartItems(userId);
}