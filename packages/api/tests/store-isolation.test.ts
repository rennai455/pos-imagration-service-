import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('Data Isolation', () => {
  let store1Id: string;
  let store2Id: string;
  let tenant1Id: string;
  let tenant2Id: string;
  
  beforeAll(async () => {
    // Create test data
    const store1 = await prisma.store.create({
      data: {
        name: 'Store 1',
        tenant: {
          create: { name: 'Tenant for Store 1' }
        },
        products: {
          create: {
            name: 'Store 1 Product',
            description: 'Test product for store 1',
            price: 10.0,
            stock: 100
          }
        }
      },
      include: { tenant: true }
    });

    const store2 = await prisma.store.create({
      data: {
        name: 'Store 2',
        tenant: {
          create: { name: 'Tenant for Store 2' }
        },
        products: {
          create: {
            name: 'Store 2 Product',
            description: 'Test product for store 2',
            price: 20.0,
            stock: 200
          }
        }
      },
      include: { tenant: true }
    });

    store1Id = store1.id;
    store2Id = store2.id;
    tenant1Id = store1.tenant.id;
    tenant2Id = store2.tenant.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.product.deleteMany({
      where: {
        storeId: {
          in: [store1Id, store2Id]
        }
      }
    });
    await prisma.store.deleteMany({
      where: {
        id: {
          in: [store1Id, store2Id]
        }
      }
    });
    // Remove tenants if they still exist (ignore not-found by using deleteMany)
    await prisma.tenant.deleteMany({ where: { id: { in: [tenant1Id, tenant2Id].filter(Boolean) as string[] } } });
    await prisma.$disconnect();
  });

  it('should prevent cross-store access to products', async () => {
    // Get store 1 products
    const store1Products = await prisma.product.findMany({
      where: {
        storeId: store1Id
      }
    });

    // Should only return store 1's products
    expect(store1Products).toHaveLength(1);
    expect(store1Products[0].name).toBe('Store 1 Product');
  });

  it('should allow access to own store products', async () => {
    // Get store 2 products
    const store2Products = await prisma.product.findMany({
      where: {
        storeId: store2Id
      }
    });

    expect(store2Products).toHaveLength(1);
    expect(store2Products[0].name).toBe('Store 2 Product');
  });

  it('should enforce store isolation in bulk operations', async () => {
    // Update products for store 1
    await prisma.product.updateMany({
      where: {
        storeId: store1Id
      },
      data: {
        price: 15.00
      }
    });

    // Verify store 2's products are unchanged
    const store2Products = await prisma.product.findMany({
      where: {
        storeId: store2Id
      }
    });

    expect(store2Products[0].price).toBe(20.00);
  });
});
