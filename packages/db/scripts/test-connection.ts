import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

(async function main(){
  const prisma = new PrismaClient();
  try{
    // simple query, won't fail if table missing on some DBs
    await prisma.$queryRaw`SELECT 1 as result`;
    console.log('Prisma connection OK');
    process.exit(0);
  }catch(e){
    console.error('Prisma connection failed', e);
    process.exit(1);
  }finally{
    await prisma.$disconnect();
  }
})();
