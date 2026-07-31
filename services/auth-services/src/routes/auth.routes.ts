import { Router } from "express";
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
} from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  authAttemptLimiter,
  refreshLimiter,
  generalLimiter,
} from "../middlewares/rateLimiter.middleware";

const router = Router();

router.post("/register", authAttemptLimiter, registerHandler);
router.post("/login", authAttemptLimiter, loginHandler);
router.post("/refresh", refreshLimiter, refreshHandler);
router.post("/logout", generalLimiter, logoutHandler);
 
// A simple protected route to sanity-check requireAuth works:
// returns the currently logged-in user's info from their access token.
router.get("/me", generalLimiter, requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

export default router;