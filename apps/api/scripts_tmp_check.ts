import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const r: any[] = await prisma.$queryRaw`SELECT gen_random_uuid()::text as id`;
  console.log('gen_random_uuid works:', r[0].id);
  await prisma.$disconnect();
})();
