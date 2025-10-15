import request from "supertest";

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

type BuildServer = typeof import("../src/server").buildServer;
let buildServer: BuildServer;

jest.mock("@codex/db", () => ({
  prisma: mockPrisma,
}));

beforeAll(async () => {
  ({ buildServer } = await import("../src/server"));
});

beforeEach(() => {
  mockPrisma.product.findMany.mockReset();
  mockPrisma.product.create.mockReset();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("/api/products", () => {
  it("returns a list of products", async () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    mockPrisma.product.findMany.mockResolvedValueOnce([
      {
        id: "prod_1",
        name: "Test Product",
        description: null,
        price: 25.5,
        stock: 10,
        barcode: null,
        storeId: "store_1",
        createdAt,
      },
    ]);

    const app = await buildServer();
    await app.ready();

    try {
      const response = await request(app.server).get("/api/products");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        expect.objectContaining({
          id: "prod_1",
          name: "Test Product",
          price: 25.5,
          stock: 10,
          storeId: "store_1",
        }),
      ]);
    } finally {
      await app.close();
    }
  });

  it("creates a product with validated payload", async () => {
    const createdProduct = {
      id: "prod_2",
      name: "Validated Product",
      description: "Great",
      price: 10.99,
      stock: 5,
      barcode: "1234567890",
      storeId: "store_2",
      createdAt: new Date("2024-01-02T00:00:00.000Z"),
    };

    mockPrisma.product.create.mockResolvedValueOnce(createdProduct);

    const app = await buildServer();
    await app.ready();

    try {
      const response = await request(app.server)
        .post("/api/products")
        .send({
          name: "Validated Product",
          price: 10.99,
          stock: 5,
          storeId: "store_2",
          description: "Great",
          barcode: "1234567890",
        });

      expect(response.status).toBe(201);
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Validated Product",
          price: 10.99,
          stock: 5,
          storeId: "store_2",
          description: "Great",
          barcode: "1234567890",
        }),
      });
      expect(response.body).toEqual(
        expect.objectContaining({
          id: "prod_2",
          name: "Validated Product",
        }),
      );
    } finally {
      await app.close();
    }
  });

  it("rejects invalid payloads", async () => {
    const app = await buildServer();
    await app.ready();

    try {
      const response = await request(app.server)
        .post("/api/products")
        .send({
          name: "",
          price: -1,
          stock: -5,
          storeId: "",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(Array.isArray(response.body.details)).toBe(true);
    } finally {
      await app.close();
    }
  });
});
