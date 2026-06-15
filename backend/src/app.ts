import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Allowlist of origins permitted to call the API. Configure in production via
// CORS_ORIGINS (comma-separated). Defaults to the local dev frontend.
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Security headers. The API serves JSON only (the SPA is served by CloudFront),
// so helmet's restrictive defaults are safe here.
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (no Origin header) and allowlisted origins.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler — log full detail server-side, return a generic message
// to the client so stack traces and file paths are never disclosed.
app.use((err: Error, req: Request, res: Response, _next: NextFunction): void => {
  req.log?.error({ err }, "Unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
