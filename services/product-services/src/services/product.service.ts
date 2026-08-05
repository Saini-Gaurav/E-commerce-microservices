import {
  findProducts,
  countProducts,
  findProductById,
  createProduct as createProductInDb,
  updateProduct as updateProductInDb,
  deleteProduct as deleteProductInDb,
  ProductRow,
  ProductListFilters,
  CreateProductInput,
} from "../repositories/product.repository";
import { findCategoryById } from "../repositories/category.repository";
import { ServiceError } from "../utils/errors";
import {
  publishProductUpserted,
  publishProductDeleted,
} from "../events/productEvents.publisher";

// The shape actually sent to clients: price/rating as real numbers (see note in product.repository.ts on why pg gives us strings), and category_id -> categoryId to keep the API surface camelCase even though the DB columns are snake_case.
export interface ProductResponse {
  id: string;
  name: string;
  description: string;
  richDescription: string;
  image: string;
  images: string[];
  brand: string;
  price: number;
  categoryId: string;
  countInStock: number;
  rating: number;
  numReviews: number;
  isFeatured: boolean;
  ingredients: string;
  usageNotes: string;
  benefits: string;
  precautions: string;
  quantity: string;
  createdAt: Date;
}

export function toProductResponse(row: ProductRow): ProductResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    richDescription: row.rich_description,
    image: row.image,
    images: row.images,
    brand: row.brand,
    price: Number(row.price),
    categoryId: row.category_id,
    countInStock: row.count_in_stock,
    rating: Number(row.rating),
    numReviews: row.num_reviews,
    isFeatured: row.is_featured,
    ingredients: row.ingredients,
    usageNotes: row.usage_notes,
    benefits: row.benefits,
    precautions: row.precautions,
    quantity: row.quantity,
    createdAt: row.created_at,
  };
}

export interface ListProductsInput {
  categoryId?: string;
  isFeatured?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedProducts {
  items: ProductResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function listProducts(
  input: ListProductsInput,
): Promise<PaginatedProducts> {
  // Clamp instead of trusting the client - a page size of 100000 from a
  // malicious or buggy client shouldn't be able to force a huge table scan.
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const offset = (page - 1) * limit;

  const filters: ProductListFilters = {
    categoryId: input.categoryId,
    isFeatured: input.isFeatured,
    search: input.search,
    limit,
    offset,
  };

  const [rows, total] = await Promise.all([
    findProducts(filters),
    countProducts(filters),
  ]);

  return {
    items: rows.map(toProductResponse),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getProductById(id: string): Promise<ProductResponse> {
  const product = await findProductById(id);
  if (!product) {
    throw new ServiceError("Product not found", 404);
  }
  return toProductResponse(product);
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await findCategoryById(categoryId);
  if (!category) {
    // 400, not 404: the client sent a bad reference in the request body,
    // this isn't "the URL points at a resource that doesn't exist."
    throw new ServiceError(
      "categoryId does not reference an existing category",
      400,
    );
  }
}

export async function createProduct(
  input: CreateProductInput,
): Promise<ProductResponse> {
  // Cross-table check that lives in the SERVICE layer, not the repository or a DB-level FK, because categories and products are technically in the same database here - but the moment this architecture splits categories into their own service, this exact validation becomes an HTTP call instead of a local query, and business logic (services), not data access (repositories), is where that swap belongs.
  await assertCategoryExists(input.categoryId);

  if (input.price < 0) {
    throw new ServiceError("price cannot be negative", 400);
  }
  if (input.countInStock < 0) {
    throw new ServiceError("countInStock cannot be negative", 400);
  }

  const product = await createProductInDb(input);
  const response = toProductResponse(product);
  await publishProductUpserted(response);
  return response;
}

export async function updateProduct(
  id: string,
  fields: Partial<CreateProductInput>,
): Promise<ProductResponse> {
  await getProductById(id); // 404 if missing

  if (fields.categoryId) {
    await assertCategoryExists(fields.categoryId);
  }
  if (fields.price !== undefined && fields.price < 0) {
    throw new ServiceError("price cannot be negative", 400);
  }

  // Repository update fn takes snake_case DB column keys; translate here at the service boundary so the repository stays a dumb mirror of the table, and callers of THIS function keep using camelCase.
  const dbFields: Record<string, unknown> = {};
  if (fields.name !== undefined) dbFields.name = fields.name;
  if (fields.description !== undefined)
    dbFields.description = fields.description;
  if (fields.richDescription !== undefined)
    dbFields.rich_description = fields.richDescription;
  if (fields.image !== undefined) dbFields.image = fields.image;
  if (fields.images !== undefined) dbFields.images = fields.images;
  if (fields.brand !== undefined) dbFields.brand = fields.brand;
  if (fields.price !== undefined) dbFields.price = fields.price;
  if (fields.categoryId !== undefined) dbFields.category_id = fields.categoryId;
  if (fields.countInStock !== undefined)
    dbFields.count_in_stock = fields.countInStock;
  if (fields.isFeatured !== undefined) dbFields.is_featured = fields.isFeatured;
  if (fields.ingredients !== undefined)
    dbFields.ingredients = fields.ingredients;
  if (fields.usageNotes !== undefined) dbFields.usage_notes = fields.usageNotes;
  if (fields.benefits !== undefined) dbFields.benefits = fields.benefits;
  if (fields.precautions !== undefined)
    dbFields.precautions = fields.precautions;
  if (fields.quantity !== undefined) dbFields.quantity = fields.quantity;

  const updated = await updateProductInDb(id, dbFields);
  if (!updated) {
    throw new ServiceError("Product not found", 404);
  }
  const response = toProductResponse(updated);
  await publishProductUpserted(response);
  return response;
}

export async function deleteProduct(id: string): Promise<void> {
  await getProductById(id); // 404 if missing
  await deleteProductInDb(id);
  await publishProductDeleted(id);
}
