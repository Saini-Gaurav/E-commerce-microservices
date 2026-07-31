// This file has no imports/exports of its own logic — its only job is to teach TypeScript that `req.user` exists on Express's Request type."declare global" + reopening the "Express" namespace is how you extend a third-party library's types without modifying its source.
import { AccessTokenPayload } from "../utils/token.util";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

// Needs to be a module (have at least one import/export) for "declare global" to work as intended.
export {};