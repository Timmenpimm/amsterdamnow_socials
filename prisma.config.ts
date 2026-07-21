import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 leest geen `prisma`-blok meer uit package.json; schema-locatie staat hier.
// dotenv-import zodat CLI-commando's (migrate/validate) DATABASE_URL uit .env zien.
export default defineConfig({
  schema: "database/schema.prisma",
});
