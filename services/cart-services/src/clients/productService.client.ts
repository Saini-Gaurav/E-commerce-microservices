const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://localhost:4002/api/v1";

export interface ProductSnapshot {
  id: string;
  name: string;
  price: number;
  image: string;
  countInStock: number;
}

interface GetProductApiResponse {
  product: ProductSnapshot;
}

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

  const body = (await response.json()) as GetProductApiResponse;
  return body.product;
}