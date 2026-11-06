import {
  findAllCategories,
  findCategoryById,
  findCategoryByName,
  createCategory as createCategoryInDb,
  updateCategory as updateCategoryInDb,
  deleteCategory as deleteCategoryInDb,
  CategoryRow,
} from "../repositories/category.repository";
import { countProductsInCategory } from "../repositories/product.repository";
import { ServiceError } from "../utils/errors";

export async function listCategories(): Promise<CategoryRow[]> {
  return findAllCategories();
}

export async function getCategoryById(id: string): Promise<CategoryRow> {
  const category = await findCategoryById(id);
  if (!category) {
    throw new ServiceError("Category not found", 404);
  }
  return category;
}

export async function createCategory(input: {
  name: string;
  icon?: string;
  color?: string;
}): Promise<CategoryRow> {
  const existing = await findCategoryByName(input.name);
  if (existing) {
    throw new ServiceError("A category with this name already exists", 409);
  }
  return createCategoryInDb(input);
}

export async function updateCategory(
  id: string,
  fields: Partial<{ name: string; icon: string; color: string }>
): Promise<CategoryRow> {
  await getCategoryById(id); // throws 404 if missing, before we bother checking anything else

  if (fields.name) {
    const clash = await findCategoryByName(fields.name);
    if (clash && clash.id !== id) {
      throw new ServiceError("A category with this name already exists", 409);
    }
  }

  const updated = await updateCategoryInDb(id, fields);
  if (!updated) {
    throw new ServiceError("Category not found", 404);
  }
  return updated;
}

export async function deleteCategory(id: string): Promise<void> {
  await getCategoryById(id);

  const productCount = await countProductsInCategory(id);
  if (productCount > 0) {
    throw new ServiceError(
      `Cannot delete category: ${productCount} product(s) still reference it`,
      409
    );
  }

  await deleteCategoryInDb(id);
}