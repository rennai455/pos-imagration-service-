import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { validateEnv } from '../src/utils/env';
import os from 'os';
import dns from 'dns';
import util from 'util';

const resolveDns = util.promisify(dns.lookup);

async function checkNetworkStack() {
  console.log('\n🌐 Network Stack Analysis:');
  
  // Check IPv4/IPv6 compatibility
  try {
    const interfaces = os.networkInterfaces();
    const stack = {
      ipv4: false,
      ipv6: false,
    };

    Object.values(interfaces).forEach((iface) => {
      iface?.forEach((addr) => {
        if (addr.family === 'IPv4') stack.ipv4 = true;
        if (addr.family === 'IPv6') stack.ipv6 = true;
      });
    });

    console.log(`✓ IPv4 available: ${stack.ipv4}`);
    console.log(`✓ IPv6 available: ${stack.ipv6}`);
  } catch (error) {
    console.error('❌ Error checking IP stack:', error);
  }

  // Check DNS resolution
  try {
    const dnsResult = await resolveDns('localhost');
    console.log(`✓ DNS Resolution: localhost -> ${dnsResult.address}`);
  } catch (error) {
    console.error('❌ DNS Resolution error:', error);
  }

  // Check port availability
  const portsToCheck = [3000, 5432, 5433];
  for (const port of portsToCheck) {
    try {
      execSync(`netstat -an | findstr :${port}`);
      console.log(`⚠️  Port ${port} is in use`);
    } catch {
      console.log(`✓ Port ${port} is available`);
    }
  }
}

async function checkDatabase() {
  console.log('\n📊 Database Analysis:');
  const prisma = new PrismaClient();

  try {
    // Test connection
    await prisma.$connect();
    console.log('✓ Database connection successful');

    // Test query performance
    const start = Date.now();
    await prisma.$executeRaw`SELECT 1`;
    console.log(`✓ Query latency: ${Date.now() - start}ms`);

  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkDockerEnvironment() {
  console.log('\n🐳 Docker Environment:');
  
  try {
    // Check Docker status
    execSync('docker info');
    console.log('✓ Docker is running');

    // Check WSL status on Windows
    if (process.platform === 'win32') {
      try {
        execSync('wsl --status');
        console.log('✓ WSL is available');
      } catch {
        console.log('⚠️  WSL not detected');
      }
    }

    // Check Docker Compose
    execSync('docker-compose version');
    console.log('✓ Docker Compose is available');

  } catch (error) {
    console.error('❌ Docker environment check failed:', error);
  }
}

async function checkSecurityConfig() {
  console.log('\n🔒 Security Configuration:');

  // Check environment variables
  try {
    const env = validateEnv();
    console.log('✓ Environment variables validated');
    
    // Check JWT secret strength
    if (env.JWT_SECRET.length < 32) {
      console.log('⚠️  JWT secret should be at least 32 characters');
    } else {
      console.log('✓ JWT secret meets length requirements');
    }
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
  }
}

async function main() {
  console.log('🔍 Starting System Analysis...\n');

  try {
    await checkNetworkStack();
    await checkDatabase();
    await checkDockerEnvironment();
    await checkSecurityConfig();
  } catch (error) {
    console.error('❌ System check failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);