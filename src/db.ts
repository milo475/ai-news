import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "./env";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaPg({ connectionString: databaseUrl() });

export const prisma = new PrismaClient({ adapter });
