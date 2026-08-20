import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

const PORT = process.env.PORT || 4000;
const API_URL = process.env.API_URL!;

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL!;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL!;
const CART_SERVICE_URL = process.env.CART_SERVICE_URL!;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL!;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL!;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(morgan("dev"));

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

      return AUTH_SERVICE_URL;
    },

    pathRewrite: (path) => {
      return `${API_URL}${path}`;
    },

    on: {
      proxyReq: (proxyReq, req) => {
        console.log("Gateway received:", req.url ?? "");
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
