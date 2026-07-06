import { Module, Global } from "@nestjs/common";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../../../../.env.local") });

export const DB_POOL = "DB_POOL";

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      useFactory: () => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.DATABASE_URL?.includes("supabase")
            ? { rejectUnauthorized: false }
            : false,
        });
        console.log("✓ Database pool initialized");
        return pool;
      },
    },
  ],
  exports: [DB_POOL],
})
export class DbModule {}
