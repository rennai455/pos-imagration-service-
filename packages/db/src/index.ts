import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __codexPrisma: PrismaClient | undefined;
}

const prisma = globalThis.__codexPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__codexPrisma = prisma;
}

export { prisma };
export * from "@prisma/client";
