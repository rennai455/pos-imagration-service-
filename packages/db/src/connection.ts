import { PrismaClient } from '@prisma/client'
import { createLogger, format, transports } from 'winston'

const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 10000 // 10 seconds

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.colorize(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/db-connection.log' })
  ]
})

class DatabaseConnection {
  private prisma: PrismaClient;
  private retryCount: number = 0;
  private retryDelay: number = INITIAL_RETRY_DELAY;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['query', 'error', 'info', 'warn'],
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private calculateNextRetryDelay(): number {
    // Exponential backoff with jitter
    const jitter = Math.random() * 1000
    this.retryDelay = Math.min(
      this.retryDelay * 2 + jitter,
      MAX_RETRY_DELAY
    )
    return this.retryDelay
  }

  async connect(): Promise<boolean> {
    while (this.retryCount < MAX_RETRIES) {
      try {
        logger.info(`Attempting database connection (attempt ${this.retryCount + 1}/${MAX_RETRIES})`)
        
        // Test the connection with a simple query
        await this.prisma.$queryRaw`SELECT 1`
        
        logger.info('✅ Database connection successful!')
        return true
      } catch (error) {
        this.retryCount++
        
        if (this.retryCount === MAX_RETRIES) {
          logger.error('❌ Maximum retry attempts reached. Database connection failed:', error)
          return false
        }

        const nextDelay = this.calculateNextRetryDelay()
        logger.warn(`Connection failed. Retrying in ${nextDelay}ms...`)
        await this.delay(nextDelay)
      }
    }

    return false
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
    logger.info('Database connection closed')
  }

  getPrismaClient(): PrismaClient {
    return this.prisma
  }
}

// If this file is run directly, test the connection
if (require.main === module) {
  const db = new DatabaseConnection()
  db.connect()
    .then((success) => {
      if (success) {
        process.exit(0)
      } else {
        process.exit(1)
      }
    })
    .catch((error) => {
      logger.error('Unexpected error:', error)
      process.exit(1)
    })
    .finally(() => {
      db.disconnect()
    })
}

export default DatabaseConnection