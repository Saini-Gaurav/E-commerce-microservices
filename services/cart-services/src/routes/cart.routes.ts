import { Router } from "express";
import * as cartController from "../controllers/cart.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { generalLimiter } from "../middlewares/rateLimiter.middleware";
import { cartStreamHandler } from "../controllers/cart.controller";

const router = Router();

router.get("/", generalLimiter, requireAuth, cartController.getCartHandler);
router.post("/items", generalLimiter, requireAuth, cartController.addItemHandler);
router.put("/items/:productId", generalLimiter, requireAuth, cartController.updateItemHandler);
router.delete("/items/:productId", generalLimiter, requireAuth, cartController.removeItemHandler);
router.delete("/", generalLimiter, requireAuth, cartController.clearCartHandler);

router.get("/stream", requireAuth, cartStreamHandler);

export default router;