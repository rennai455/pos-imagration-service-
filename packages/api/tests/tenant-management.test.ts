import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Tenant Management', () => {
  let tenant1Id: string;
  let tenant2Id: string;
  
  beforeAll(async () => {
    // Create test tenants
    const tenant1 = await prisma.tenant.create({
      data: {
        name: 'Test Tenant 1',
        isActive: true,
        stores: {
          create: {
            name: 'Store 1'
          }
        }
      }
    });

    const tenant2 = await prisma.tenant.create({
      data: {
        name: 'Test Tenant 2',
        isActive: true,
        stores: {
          create: {
            name: 'Store 2'
          }
        }
      }
    });

    tenant1Id = tenant1.id;
    tenant2Id = tenant2.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.store.deleteMany({
      where: {
        tenant: {
          id: {
            in: [tenant1Id, tenant2Id]
          }
        }
      }
    });
    
    await prisma.tenant.deleteMany({
      where: {
        id: {
          in: [tenant1Id, tenant2Id]
        }
      }
    });

    await prisma.$disconnect();
  });

  it('should create tenant with store', async () => {
    const tenant = await prisma.tenant.findUnique({
      where: {
        id: tenant1Id
      },
      include: {
        stores: true
      }
    });

    expect(tenant).toBeDefined();
    expect(tenant?.stores.length).toBe(1);
    expect(tenant?.stores[0].name).toBe('Store 1');
  });

  it('should allow querying tenant stores', async () => {
    const stores = await prisma.store.findMany({
      where: {
        tenant: {
          id: tenant2Id
        }
      }
    });

    expect(stores.length).toBe(1);
    expect(stores[0].name).toBe('Store 2');
  });

  it('should support tenant deactivation', async () => {
    // Deactivate tenant 2
    await prisma.tenant.update({
      where: {
        id: tenant2Id
      },
      data: {
        isActive: false
      }
    });

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: tenant2Id
      }
    });

    expect(tenant?.isActive).toBe(false);
  });
});