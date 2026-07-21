import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient instance.
 * Uses global cache to avoid multiple instances during development hot-reload.
 * In production, a single instance is created and reused.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
