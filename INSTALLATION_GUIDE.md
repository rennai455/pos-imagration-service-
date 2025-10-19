# Installation Guide - Next Steps

## Prerequisites Installation

Since the automated installation encountered permission issues, please follow these manual steps:

### 1. Install Node.js 20 LTS

**Option A: Direct Download (Recommended)**
1. Go to https://nodejs.org/
2. Download "20.x LTS" version for Windows
3. Run the installer as Administrator
4. Restart your terminal after installation

**Option B: Using Chocolatey (if you have it)**
```powershell
# Run PowerShell as Administrator
choco install nodejs-lts
```

**Option C: Using Winget (with elevated prompt)**
```powershell
# Run PowerShell as Administrator
winget install OpenJS.NodeJS.LTS
```

### 2. Verify Node.js Installation

After installation, open a new PowerShell window and run:
```powershell
node --version
npm --version
```

You should see version numbers like:
- Node: v20.x.x
- npm: 10.x.x

### 3. Install pnpm (Package Manager)

```powershell
npm install -g pnpm
```

Verify pnpm installation:
```powershell
pnpm --version
```

### 4. Install Docker Desktop (Optional but Recommended)

1. Go to https://docs.docker.com/desktop/install/windows/
2. Download Docker Desktop for Windows
3. Install and restart your computer
4. Start Docker Desktop

Verify Docker installation:
```powershell
docker --version
docker-compose --version
```

## Next Steps After Prerequisites

Once you have Node.js and pnpm installed, return to this directory and run:

```powershell
cd c:\Users\summa\pos-imagration-service-

# Install all dependencies
pnpm install

# Generate Prisma client
pnpm --filter @codex/db prisma generate

# Build the API
pnpm --filter @codex/api build

# Test Docker build (if Docker is installed)
docker build -t codex-api .
```

## Environment Setup

1. Copy environment template:
```powershell
copy infra\app\environments\dev.env.example .env
```

2. Edit `.env` file with your actual values:
   - Database connection string
   - Supabase credentials
   - API configuration

## Validation Checklist

- [ ] Node.js 20+ installed (`node --version`)
- [ ] pnpm installed (`pnpm --version`)
- [ ] Dependencies installed (`pnpm install`)
- [ ] Prisma client generated
- [ ] API builds successfully
- [ ] Docker build works (optional)
- [ ] Environment variables configured

## Common Issues

**"pnpm command not found"**
- Restart your terminal after Node.js installation
- Try `npm install -g pnpm` again

**"Permission denied" errors**
- Run PowerShell as Administrator for global installations
- Check Windows execution policy: `Set-ExecutionPolicy RemoteSigned`

**TypeScript errors**
- These are expected until dependencies are installed
- Run `pnpm install` to resolve

**Docker build fails**
- Ensure Docker Desktop is running
- Check if WSL2 is properly configured (Windows requirement)

## Support

If you encounter issues:
1. Check the error message carefully
2. Ensure you're running commands from the correct directory
3. Verify all prerequisites are installed
4. Try restarting your terminal/computer after installations

Once prerequisites are installed, we can continue with testing the CI/CD pipeline and deployment setup.