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
    // clash.id !== id: found a category with this name that ISN'T the
    // one we're currently editing - that's a real conflict. Renaming a
    // category to its own current name should be a harmless no-op, not
    // an error.
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

  // Checking this ourselves BEFORE attempting the delete, rather than
  // only relying on the database's ON DELETE RESTRICT to reject it,
  // gives us a clean, specific error message instead of a raw
  // "violates foreign key constraint" string leaking out of pg. The DB
  // constraint still stands as the real safety net underneath this -
  // this check is a courtesy, not the only thing preventing the bad delete.
  const productCount = await countProductsInCategory(id);
  if (productCount > 0) {
    throw new ServiceError(
      `Cannot delete category: ${productCount} product(s) still reference it`,
      409
    );
  }

  await deleteCategoryInDb(id);
}