import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/rbac.middleware";
import { generalLimiter } from "../middleware/rateLimiter.middleware";

const router = Router();

router.get("/", generalLimiter, productController.listProductsHandler);
router.get("/:id", generalLimiter, productController.getProductHandler);

router.post(
  "/",
  generalLimiter,
  requireAuth,
  requirePermission("PRODUCT_CREATE"),
  productController.createProductHandler
);
router.put(
  "/:id",
  generalLimiter,
  requireAuth,
  requirePermission("PRODUCT_UPDATE"),
  productController.updateProductHandler
);
router.delete(
  "/:id",
  generalLimiter,
  requireAuth,
  requirePermission("PRODUCT_DELETE"),
  productController.deleteProductHandler
);

export default router;