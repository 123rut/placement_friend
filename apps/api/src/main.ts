import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: "http://localhost:3000", credentials: true });

  // Raise server socket and request timeouts well above the default 5 min.
  // The full-sync endpoint can take 5–15 min when iterating many companies.
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  const httpServer = app.getHttpServer();
  httpServer.setTimeout(FIFTEEN_MINUTES);       // idle socket timeout
  httpServer.keepAliveTimeout = FIFTEEN_MINUTES; // HTTP keep-alive
  httpServer.requestTimeout = FIFTEEN_MINUTES;   // entire request receive timeout
  httpServer.headersTimeout = FIFTEEN_MINUTES + 1000; // header timeout (must be > keepAliveTimeout)

  await app.listen(process.env.PORT ?? 4000);
  console.log(`🚀 CareerPilot API running on http://localhost:4000/api`);
}
bootstrap();
