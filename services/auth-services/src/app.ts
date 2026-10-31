import express, { Express, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import permissionsRoutes from "./routes/rbac.routes"

const app: Express = express();

const API_URL = process.env.API_URL;
console.log(API_URL);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true, 
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));


app.use(`${API_URL}/auth`, authRoutes);
app.use(`${API_URL}/rbac`, permissionsRoutes);

app.get(`${API_URL}/health`, (_req: Request, res: Response) => {
  res.status(200).json({ status: "auth-service is up" });
});

// Catch-all for unmatched routes.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;