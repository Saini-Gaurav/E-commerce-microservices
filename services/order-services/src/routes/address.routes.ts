import { Router } from "express";
import * as addressController from "../controllers/address.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { generalLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

router.get("/", generalLimiter, requireAuth, addressController.listAddressesHandler);
router.post("/", generalLimiter, requireAuth, addressController.createAddressHandler);
router.put("/:id/default", generalLimiter, requireAuth, addressController.setDefaultAddressHandler);
router.put("/:id", generalLimiter, requireAuth, addressController.updateAddressHandler);
router.delete("/:id", generalLimiter, requireAuth, addressController.deleteAddressHandler);

export default router;