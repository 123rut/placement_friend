import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: "http://localhost:3000", credentials: true });
  await app.listen(process.env.PORT ?? 4000);
  console.log(`🚀 CareerPilot API running on http://localhost:4000/api`);
}
bootstrap();
