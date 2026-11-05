import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/rbac.middleware";
import { generalLimiter } from "../middleware/rateLimiter.middleware";
import { submitReviewHandler, listReviewsHandler, deleteReviewHandler, getMyReviewStatusHandler  } from "../controllers/review.controller";

const router = Router();

router.get("/", generalLimiter, productController.listProductsHandler);
router.get(
  "/upload-signature",
  generalLimiter,
  requireAuth,
  requirePermission("PRODUCT_CREATE"),
  productController.getUploadSignatureHandler
);
router.get("/:id", generalLimiter, productController.getProductHandler);

router.get("/:id/reviews", generalLimiter, listReviewsHandler);
router.post("/:id/reviews", generalLimiter, requireAuth, submitReviewHandler);
router.delete("/:id/reviews/:reviewId", generalLimiter, requireAuth, deleteReviewHandler);
router.get("/:id/reviews/mine", generalLimiter, requireAuth, getMyReviewStatusHandler);

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