import "dotenv/config";
import { defineConfig } from "prisma/config";

// The Prisma command-line tool (migrations, seed) prefers the direct,
// non-pooled connection. The running app uses DATABASE_URL (see src/server/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
