import { Request, Response } from "express";
import * as categoryService from "../services/category.service";
import { handleServiceError } from "../utils/errors";

export async function listCategoriesHandler(_req: Request, res: Response): Promise<void> {
  try {
    const categories = await categoryService.listCategories();
    res.status(200).json({ categories });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function getCategoryHandler(req: Request, res: Response): Promise<void> {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    res.status(200).json({ category });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function createCategoryHandler(req: Request, res: Response): Promise<void> {
  try {
    const { name, icon, color } = req.body;
    if (!name) {
      res.status(400).json({ message: "name is required" });
      return;
    }

    const category = await categoryService.createCategory({ name, icon, color });
    res.status(201).json({ category });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function updateCategoryHandler(req: Request, res: Response): Promise<void> {
  try {
    const fields: Partial<{ name: string; icon: string; color: string }> = {};
    if (req.body.name !== undefined) fields.name = req.body.name;
    if (req.body.icon !== undefined) fields.icon = req.body.icon;
    if (req.body.color !== undefined) fields.color = req.body.color;

    const category = await categoryService.updateCategory(req.params.id, fields);
    res.status(200).json({ category });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function deleteCategoryHandler(req: Request, res: Response): Promise<void> {
  try {
    await categoryService.deleteCategory(req.params.id);
    res.status(200).json({ message: "Category deleted" });
  } catch (err) {
    handleServiceError(err, res);
  }
}