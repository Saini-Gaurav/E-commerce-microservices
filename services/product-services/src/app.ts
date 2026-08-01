import express, { Express, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import categoryRoutes from "./routes/category.routes";
import productRoutes from "./routes/product.routes";

const app: Express = express();
const API_URL = process.env.API_URL;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.use(`${API_URL}/categories`, categoryRoutes);
app.use(`${API_URL}/products`, productRoutes);

app.get(`${API_URL}/health`, (_req: Request, res: Response) => {
  res.status(200).json({ status: "product-service is up" });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;