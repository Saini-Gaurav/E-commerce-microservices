import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { randomUUID } from "crypto";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

const PORT = process.env.PORT || 4000;

// Fail LOUD at boot if any of these are missing/misspelled, instead of silently becoming undefined and only breaking the first time someone actually hits that route. Same fail-fast pattern already used in several backend services' env.ts files - applying it here too.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const API_URL = requireEnv("API_URL");
const AUTH_SERVICE_URL = requireEnv("AUTH_SERVICE_URL");
const PRODUCT_SERVICE_URL = requireEnv("PRODUCT_SERVICE_URL");
const CART_SERVICE_URL = requireEnv("CART_SERVICE_URL");
const ORDER_SERVICE_URL = requireEnv("ORDER_SERVICE_URL");
const PAYMENT_SERVICE_URL = requireEnv("PAYMENT_SERVICE_URL");
const NOTIFICATION_SERVICE_URL = requireEnv("NOTIFICATION_SERVICE_URL");

// Security headers on the ONE thing directly reachable from the internet - more important here than on any individual backend service, since this is the actual front door of the whole system.
app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(morgan("dev"));

// Stamps every incoming request with ONE id that can now be traced across every backend service's own logs for that same request - without this, debugging a failure means manually matching timestamps across 5+ separate terminal windows. Placed BEFORE the proxy so the header exists in time to be forwarded downstream with the request.
app.use((req, _res, next) => {
  req.headers["x-request-id"] = req.headers["x-request-id"] || randomUUID();
  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "api-gateway is up",
  });
});

app.use(
  API_URL,
  createProxyMiddleware({
    changeOrigin: true,

    router: (req) => {
      const url = req.url ?? "";

      if (url.startsWith("/auth")) {
        return AUTH_SERVICE_URL;
      }

      if (url.startsWith("/products") || url.startsWith("/categories")) {
        return PRODUCT_SERVICE_URL;
      }

      if (url.startsWith("/cart")) {
        return CART_SERVICE_URL;
      }

      if (url.startsWith("/orders")) {
        return ORDER_SERVICE_URL;
      }

      if (url.startsWith("/payments")) {
        return PAYMENT_SERVICE_URL;
      }

      if (url.startsWith("/newsletter") || url.startsWith("/contact")) {
        return NOTIFICATION_SERVICE_URL;
      }

      // Was: return AUTH_SERVICE_URL - silently sent anything unrecognized (typos, old routes, scanner probes) straight to auth-service, which is misleading in logs and mildly risky. Returning undefined lets http-proxy-middleware produce its own clean error for a route that matches nothing real, instead of guessing a destination for it.
      return undefined;
    },

    pathRewrite: (path) => {
      return `${API_URL}${path}`;
    },

    on: {
      proxyReq: (proxyReq, req) => {
        console.log(`[${req.headers["x-request-id"]}] Gateway received:`, req.url ?? "");
      },
      // NEW - the actual biggest gap before this change. Without this, a downed backend service (e.g. product-service crashed) meant requests through the gateway would hang or surface a raw, ugly Node-level error instead of a clean response the frontend can actually handle.
      error: (err, req, res) => {
        console.error(`[${req.headers?.["x-request-id"]}] Proxy error:`, err.message);
        if ("writeHead" in res && !res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Upstream service unavailable" }));
        }
      },
    },
  }),
);

app.use((_req, res) => {
  res.status(404).json({
    message: "Gateway route not found",
  });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});