import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });
dotenv.config();

import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  const allowedExplicitOrigins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.WEB_ORIGIN
      ? process.env.WEB_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
      : []),
  ]);

  const vercelPreviewRegex = /^https:\/\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.vercel\.app$/;

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        return callback(null, true);
      }
      if (allowedExplicitOrigins.has(requestOrigin) || vercelPreviewRegex.test(requestOrigin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
    },
    credentials: true,
  });

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey && process.env.NODE_ENV === "production") {
    throw new Error("INTERNAL_API_KEY must be set in production.");
  }
  if (!internalApiKey) {
    console.warn("INTERNAL_API_KEY is not set. Internal API guard is disabled outside production.");
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/companies")) {
      return next();
    }
    const key = req.header("x-internal-key");
    if (internalApiKey && key !== internalApiKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  // Raise server socket and request timeouts well above the default 5 min.
  // The full-sync endpoint can take 5–15 min when iterating many companies.
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  const httpServer = app.getHttpServer();
  httpServer.setTimeout(FIFTEEN_MINUTES);       // idle socket timeout
  httpServer.keepAliveTimeout = FIFTEEN_MINUTES; // HTTP keep-alive
  httpServer.requestTimeout = FIFTEEN_MINUTES;   // entire request receive timeout
  httpServer.headersTimeout = FIFTEEN_MINUTES + 1000; // header timeout (must be > keepAliveTimeout)

  await app.listen(process.env.PORT ?? 4000, "0.0.0.0");
  console.log(`🚀 CareerPilot API running on http://localhost:4000/api`);
}
bootstrap();
