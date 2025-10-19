import fs from 'fs'
import path from 'path'
import { createLogger, format, transports } from 'winston'

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
    new transports.File({ filename: 'logs/setup-env.log' })
  ]
})

const packages = [
  {
    name: 'api',
    path: 'packages/api',
    required: [
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'JWT_SECRET',
      'PORT'
    ]
  },
  {
    name: 'sdk',
    path: 'apps/sdk',
    required: [
      'API_URL',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY'
    ]
  }
]

function copyEnvFile(packageInfo: typeof packages[0]): void {
  const rootDir = process.cwd()
  const packagePath = path.join(rootDir, packageInfo.path)
  const examplePath = path.join(packagePath, '.env.example')
  const envPath = path.join(packagePath, '.env')

  if (!fs.existsSync(examplePath)) {
    logger.error(`❌ ${packageInfo.name}: .env.example not found at ${examplePath}`)
    return
  }

  try {
    if (!fs.existsSync(envPath)) {
      fs.copyFileSync(examplePath, envPath)
      logger.info(`✅ ${packageInfo.name}: Created .env from example`)
    } else {
      logger.info(`ℹ️ ${packageInfo.name}: .env file already exists`)
    }
  } catch (error) {
    logger.error(`❌ ${packageInfo.name}: Failed to copy .env file:`, error)
  }
}

function validateEnvFile(packageInfo: typeof packages[0]): boolean {
  const rootDir = process.cwd()
  const envPath = path.join(rootDir, packageInfo.path, '.env')

  if (!fs.existsSync(envPath)) {
    logger.error(`❌ ${packageInfo.name}: .env file not found`)
    return false
  }

  const content = fs.readFileSync(envPath, 'utf8')
  const env = Object.fromEntries(
    content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split('='))
      .map(([key, ...vals]) => [key, vals.join('=')])
  )

  let isValid = true
  for (const key of packageInfo.required) {
    if (!env[key] || env[key].includes('your-') || env[key].includes('demo')) {
      logger.error(`❌ ${packageInfo.name}: Missing or invalid value for ${key}`)
      isValid = false
    }
  }

  if (isValid) {
    logger.info(`✅ ${packageInfo.name}: All required environment variables are set`)
  }

  return isValid
}

// Run setup if this file is executed directly
if (require.main === module) {
  let success = true

  for (const pkg of packages) {
    copyEnvFile(pkg)
    if (!validateEnvFile(pkg)) {
      success = false
    }
  }

  process.exit(success ? 0 : 1)
}

export { copyEnvFile, validateEnvFile }