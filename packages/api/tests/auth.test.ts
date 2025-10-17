import request from "supertest";

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
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

const signInWithPassword = (globalThis as unknown as {
  __supabaseSignInMock: jest.Mock;
}).__supabaseSignInMock;

beforeEach(() => {
  mockPrisma.product.findMany.mockReset();
  mockPrisma.product.create.mockReset();
  mockPrisma.user.findUnique.mockReset();
  signInWithPassword.mockReset();
});

describe("/api/auth/login", () => {
  it("returns 400 when email or password is missing", async () => {
    const app = await buildServer();
    await app.ready();

    try {
      const response = await request(app.server).post("/api/auth/login").send({
        email: "user@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Email and password are required" });
    } finally {
      await app.close();
    }
  });

  it("returns 401 when Supabase rejects credentials", async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: "Invalid login" },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const app = await buildServer();
    await app.ready();

    try {
      const response = await request(app.server).post("/api/auth/login").send({
        email: "user@example.com",
        password: "wrong",
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Invalid login" });
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 404 when user is missing in tenant database", async () => {
    const session = { access_token: "token" };
    const user = { id: "user_1", email: "user@example.com" };

    signInWithPassword.mockResolvedValueOnce({
      data: { session, user },
      error: null,
    });

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const app = await buildServer();
    await app.ready();

    try {
      const response = await request(app.server).post("/api/auth/login").send({
        email: "user@example.com",
        password: "correct",
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: "User not found in tenant database",
      });
    } finally {
      await app.close();
    }
  });

  it("returns JWT and user details on successful login", async () => {
    const session = { access_token: "token" };
    const user = { id: "user_1", email: "user@example.com" };

    signInWithPassword.mockResolvedValueOnce({
      data: { session, user },
      error: null,
    });

    const tenantUser = {
      id: "tenant_user_1",
      email: "user@example.com",
      storeId: "store_123",
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    mockPrisma.user.findUnique.mockResolvedValueOnce(tenantUser);

    const app = await buildServer();
    await app.ready();

    try {
      const response = await request(app.server).post("/api/auth/login").send({
        email: "user@example.com",
        password: "correct",
      });

      expect(response.status).toBe(200);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "user@example.com" },
        select: {
          id: true,
          email: true,
          storeId: true,
          createdAt: true,
        },
      });
      expect(response.body).toEqual({
        session,
        token: expect.any(String),
        user: tenantUser,
      });
    } finally {
      await app.close();
    }
  });
});
