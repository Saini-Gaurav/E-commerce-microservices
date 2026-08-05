import { Router } from "express";
import * as orderController from "../controllers/order.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { generalLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

// Ownership-based - any logged-in user can create/view THEIR OWN orders, no permission code needed, same reasoning as cart-service's routes.
router.post("/", generalLimiter, requireAuth, orderController.createOrderHandler);
router.get("/mine", generalLimiter, requireAuth, orderController.getMyOrdersHandler);

// Mixed - requireAuth only; the controller itself decides ownership vs admin override, since the SAME url serves both "see my own order" and "admin looking up any order by id."
router.get("/:id", generalLimiter, requireAuth, orderController.getOrderByIdHandler);

// RBAC-gated - genuinely admin-only actions, no ownership concept applies.
router.get(
  "/",
  generalLimiter,
  requireAuth,
  requirePermission("ORDER_READ_ANY"),
  orderController.listAllOrdersHandler
);
router.put(
  "/:id/status",
  generalLimiter,
  requireAuth,
  requirePermission("ORDER_UPDATE_STATUS"),
  orderController.updateOrderStatusHandler
);

export default router;