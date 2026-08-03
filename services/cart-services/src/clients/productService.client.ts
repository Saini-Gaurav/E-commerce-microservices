const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://localhost:4002/api/v1";

export interface ProductSnapshot {
  id: string;
  name: string;
  price: number;
  image: string;
  countInStock: number;
}

// Describes the actual JSON shape product-service's GET /products/:id sends back - { "product": {...} } - so the cast below has a real target instead of sprinkling `as any` around.
interface GetProductApiResponse {
  product: ProductSnapshot;
}

/**
 * Asks product-service for one product's current details. Returns null
 * if the product simply doesn't exist (a normal, expected case - e.g.
 * someone's cart has a product that got deleted since they added it).
 * Throws for anything ELSE going wrong (product-service is down,
 * network hiccup, etc.) - that's not "this product doesn't exist," it's
 * "we couldn't find out," and those two situations should never be
 * treated the same way by whoever calls this function.
 */
export async function fetchProduct(productId: string): Promise<ProductSnapshot | null> {
  let response: Response;
  try {
    response = await fetch(`${PRODUCT_SERVICE_URL}/products/${productId}`);
  } catch (err) {
    console.error("product-service unreachable:", err);
    throw new Error("Could not reach product service");
  }

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`product-service returned ${response.status}`);
  }

  // response.json() returns Promise<unknown> in current @types/node - TypeScript won't let you read .product off an `unknown` value without this cast. This is the ONE place in the file we assert "trust me on the shape" - everywhere else still gets full type checking against ProductSnapshot.
  const body = (await response.json()) as GetProductApiResponse;
  return body.product;
}