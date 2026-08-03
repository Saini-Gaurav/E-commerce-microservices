import { Router } from "express";
import * as cartController from "../controllers/cart.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { generalLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

// Every route needs requireAuth (must be logged in) - none need requirePermission, because "is this your own cart" isn't a role question, it's already guaranteed by only ever using req.user.userId.
router.get("/", generalLimiter, requireAuth, cartController.getCartHandler);
router.post("/items", generalLimiter, requireAuth, cartController.addItemHandler);
router.put("/items/:productId", generalLimiter, requireAuth, cartController.updateItemHandler);
router.delete("/items/:productId", generalLimiter, requireAuth, cartController.removeItemHandler);
router.delete("/", generalLimiter, requireAuth, cartController.clearCartHandler);

export default router;