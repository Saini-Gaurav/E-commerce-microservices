import express, { Express, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import permissionsRoutes from "./routes/rbac.routes"

// Split from server.ts on purpose: app.ts builds the Express app but never calls .listen(). This means tests can import the app and send fake requests to it directly, without a real port ever being opened.
const app: Express = express();

const API_URL = process.env.API_URL;
console.log(API_URL);

app.use(
  cors({
    // In a microservices setup, the browser calls the API GATEWAY, and
    // the gateway calls this service — but during local dev we may hit
    // this service directly too. Restricting to a known frontend origin
    // (rather than "*") is required anyway, since credentials: true
    // cookies cannot be used with a wildcard origin.
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true, // allows cookies to be sent cross-origin
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