// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require("@prisma/client") as { PrismaClient: new () => unknown };

// Single Prisma instance for the API process.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma = new PrismaClient() as any;
