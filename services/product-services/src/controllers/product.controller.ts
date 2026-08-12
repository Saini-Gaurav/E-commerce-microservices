import { Request, Response } from "express";
import * as productService from "../services/product.service";
import { handleServiceError } from "../utils/errors";
import { ProductSortBy } from "../repositories/product.repository";

const VALID_SORTS: ProductSortBy[] = [
  "newest",
  "price_asc",
  "price_desc",
  "rating",
];

function parseSortBy(value: unknown): ProductSortBy | undefined {
  if (typeof value === "string" && (VALID_SORTS as string[]).includes(value)) {
    return value as ProductSortBy;
  }
  return undefined;
}

function parsePrice(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

export async function listProductsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { categoryId, isFeatured, search, page, limit, sortBy } = req.query;

    const minPrice = parsePrice(req.query.minPrice);
    const maxPrice = parsePrice(req.query.maxPrice);

    if (minPrice === null || maxPrice === null) {
      res
        .status(400)
        .json({
          message: "minPrice and maxPrice must be non-negative numbers",
        });
      return;
    }

    const result = await productService.listProducts({
      categoryId: typeof categoryId === "string" ? categoryId : undefined,
      isFeatured:
        isFeatured === "true"
          ? true
          : isFeatured === "false"
            ? false
            : undefined,
      search: typeof search === "string" ? search : undefined,
      minPrice,
      maxPrice,
      sortBy: parseSortBy(sortBy),
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json({
      products: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function getProductHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const product = await productService.getProductById(req.params.id);
    res.status(200).json({ product });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function createProductHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const {
      name,
      description,
      richDescription,
      image,
      images,
      brand,
      price,
      categoryId,
      countInStock,
      isFeatured,
      ingredients,
      usageNotes,
      benefits,
      precautions,
      quantity,
    } = req.body;

    if (
      !name ||
      !description ||
      price === undefined ||
      !categoryId ||
      countInStock === undefined
    ) {
      res.status(400).json({
        message:
          "name, description, price, categoryId, and countInStock are required",
      });
      return;
    }

    const product = await productService.createProduct({
      name,
      description,
      richDescription,
      image,
      images,
      brand,
      price: Number(price),
      categoryId,
      countInStock: Number(countInStock),
      isFeatured,
      ingredients,
      usageNotes,
      benefits,
      precautions,
      quantity,
    });

    res.status(201).json({ product });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function updateProductHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    res.status(200).json({ product });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function deleteProductHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    await productService.deleteProduct(req.params.id);
    res.status(200).json({ message: "Product deleted" });
  } catch (err) {
    handleServiceError(err, res);
  }
}
