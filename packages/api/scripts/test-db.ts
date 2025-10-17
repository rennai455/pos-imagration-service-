import { prisma } from '../src/lib/db';
import { validateEnv } from '../src/utils/env';

async function testDatabaseConnection() {
  console.log('🔍 Validating environment variables...');
  const env = validateEnv();
  
  console.log('✨ Environment variables are valid');
  console.log('🔌 Testing database connection...');
  
  try {
    await prisma.$connect();
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('✅ Database connection successful!');
    console.log(`🗄️  Connected to: ${env.DATABASE_URL.split('@')[1]}`); // Only show host:port, not credentials
    return 0;
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });