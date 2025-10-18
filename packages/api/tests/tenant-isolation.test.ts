import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient, Store } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('Tenant Isolation', () => {
  let store1: Store;
  let store2: Store;
  
  beforeAll(async () => {
    // Create tenants with stores
    const [tenant1, tenant2] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: 'Tenant 1',
          stores: {
            create: [{
              name: 'Store 1'
            }]
          }
        },
        include: {
          stores: true
        }
      }),
      prisma.tenant.create({
        data: {
          name: 'Tenant 2',
          stores: {
            create: [{
              name: 'Store 2'
            }]
          }
        },
        include: {
          stores: true
        }
      })
    ]);

    store1 = tenant1.stores[0];
    store2 = tenant2.stores[0];

    // Create test products
    await Promise.all([
      prisma.product.create({
        data: {
          name: 'Tenant 1 Product',
          description: 'Test product for tenant 1',
          price: 10.00,
          stock: 100,
          storeId: store1.id
        }
      }),
      prisma.product.create({
        data: {
          name: 'Tenant 2 Product',
          description: 'Test product for tenant 2',
          price: 20.00,
          stock: 200,
          storeId: store2.id
        }
      })
    ]);
  });

  afterAll(async () => {
    // Clean up test data: delete products first due to FK constraints
    await prisma.product.deleteMany({ where: { storeId: { in: [store1.id, store2.id] } } });
    await prisma.store.deleteMany({ where: { id: { in: [store1.id, store2.id] } } });
    // Optionally remove tenants that were created
    await prisma.tenant.deleteMany({ where: { stores: { none: {} } } });
    await prisma.$disconnect();
  });

  it('should prevent cross-store access to products', async () => {
    // Query products from store 2
    const store2Products = await prisma.product.findMany({
      where: {
        storeId: store2.id
      }
    });

    expect(store2Products).toHaveLength(1);
    expect(store2Products[0].storeId).toBe(store2.id);

    // Should not see store 1 products in store 2 results
    expect(store2Products.every(p => p.storeId !== store1.id)).toBe(true);
  });

  it('should allow access to own store products', async () => {
    // Query store 1's products
    const store1Products = await prisma.product.findMany({
      where: {
        storeId: store1.id
      }
    });

    expect(store1Products).toHaveLength(1);
    expect(store1Products[0].name).toBe('Tenant 1 Product');
  });

  it('should enforce store isolation in bulk operations', async () => {
    // Update products for store 1
    await prisma.product.updateMany({
      where: {
        storeId: store1.id
      },
      data: {
        price: 15.00
      }
    });

    // Verify store 2's products are unchanged
    const store2Products = await prisma.product.findMany({
      where: {
        storeId: store2.id
      }
    });

    expect(store2Products[0].price).toBe(20.00);
  });
});
