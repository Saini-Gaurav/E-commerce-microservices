import { Router } from "express";
import * as orderController from "../controllers/order.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { generalLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

router.post("/", generalLimiter, requireAuth, orderController.createOrderHandler);
router.get("/mine", generalLimiter, requireAuth, orderController.getMyOrdersHandler);

router.get("/:id", generalLimiter, requireAuth, orderController.getOrderByIdHandler);

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

router.get(
  "/stats",
  generalLimiter,
  requireAuth,
  requirePermission("ORDER_READ_ANY"),
  orderController.getOrderStatsHandler
);

export default router;