import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import { join } from 'path'

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, '..', '.env') })

async function testConnection() {
  const prisma = new PrismaClient()
  
  try {
    // Test the connection by attempting to query the database
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Database connection successful!')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })