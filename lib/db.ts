import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient instance.
 * Uses global cache to avoid multiple instances during development hot-reload.
 * In production, a single instance is created and reused.
 *
 * Prisma 7 requires an explicit driver adapter instead of connecting
 * directly from DATABASE_URL, so a pg Pool-based adapter is passed in here.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query"] : undefined,
  });
}

export const db = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
