import fs from 'fs';
import path from 'path';
import { createLogger, format, transports } from 'winston';

// Configure logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.colorize(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/validate-env.log' })
  ]
});

const required = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET',
  'PORT'
];

interface EnvVar {
  key: string;
  value: string | undefined;
  isValid: boolean;
  error?: string;
}

function validateEnvVar(key: string, value: string | undefined): EnvVar {
  if (!value) {
    return { key, value, isValid: false, error: 'Missing value' };
  }
  
  if (value.includes('[project-ref]') || value.includes('demo')) {
    return { key, value, isValid: false, error: 'Contains placeholder value' };
  }

  // Add specific validation rules
  switch (key) {
    case 'DATABASE_URL':
      if (!value.startsWith('postgresql://')) {
        return { key, value, isValid: false, error: 'Invalid database URL format' };
      }
      break;
    case 'PORT':
      if (isNaN(parseInt(value))) {
        return { key, value, isValid: false, error: 'Port must be a number' };
      }
      break;
    case 'JWT_SECRET':
      if (value.length < 32) {
        return { key, value, isValid: false, error: 'JWT secret must be at least 32 characters' };
      }
      break;
  }

  return { key, value, isValid: true };
}

function loadEnv(file = '.env'): Record<string, string> {
  const envPath = path.resolve(process.cwd(), file);
  
  if (!fs.existsSync(envPath)) {
    logger.error(`Environment file not found: ${envPath}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const env: Record<string, string> = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const [key, ...rest] = trimmed.split('=');
      if (!key) continue;
      
      env[key.trim()] = rest.join('=').trim();
    }
    
    return env;
  } catch (error) {
    logger.error(`Error reading environment file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

function validateEnvironment() {
  const envFile = process.argv[2] || '.env';
  logger.info(`Validating environment variables from ${envFile}`);
  
  const env = loadEnv(envFile);
  const results = required.map(key => validateEnvVar(key, env[key]));
  const invalid = results.filter(result => !result.isValid);
  
  if (invalid.length > 0) {
    logger.error('Environment validation failed:');
    invalid.forEach(({ key, error }) => {
      logger.error(`  - ${key}: ${error}`);
    });
    process.exit(2);
  }
  
  logger.info('Environment validation passed ✅');
  process.exit(0);
}

// Catch any unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

validateEnvironment();
