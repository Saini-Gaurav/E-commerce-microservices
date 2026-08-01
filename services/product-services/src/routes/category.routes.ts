import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/rbac.middleware";
import { generalLimiter } from "../middleware/rateLimiter.middleware";

const router = Router();

// Reads are public - anyone browsing the storefront needs to list
// categories without being logged in. Only writes are gated.
router.get("/", generalLimiter, categoryController.listCategoriesHandler);
router.get("/:id", generalLimiter, categoryController.getCategoryHandler);

router.post(
  "/",
  generalLimiter,
  requireAuth,
  requirePermission("CATEGORY_MANAGE"),
  categoryController.createCategoryHandler
);
router.put(
  "/:id",
  generalLimiter,
  requireAuth,
  requirePermission("CATEGORY_MANAGE"),
  categoryController.updateCategoryHandler
);
router.delete(
  "/:id",
  generalLimiter,
  requireAuth,
  requirePermission("CATEGORY_MANAGE"),
  categoryController.deleteCategoryHandler
);

export default router;