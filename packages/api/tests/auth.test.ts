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

const signInWithPassword = (globalThis as unknown as {
  __supabaseSignInMock: jest.Mock;
}).__supabaseSignInMock;

beforeEach(() => {
  mockPrisma.product.findMany.mockReset();
  mockPrisma.product.create.mockReset();
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

    const app = await buildServer();
    await app.ready();

    try {
      const response = await request(app.server).post("/api/auth/login").send({
        email: "user@example.com",
        password: "wrong",
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Invalid login" });
    } finally {
      await app.close();
    }
  });

  it("returns session details on successful login", async () => {
    const session = { access_token: "token" };
    const user = { id: "user_1", email: "user@example.com" };

    signInWithPassword.mockResolvedValueOnce({
      data: { session, user },
      error: null,
    });

    const app = await buildServer();
    await app.ready();

    try {
      const response = await request(app.server).post("/api/auth/login").send({
        email: "user@example.com",
        password: "correct",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ session, user });
    } finally {
      await app.close();
    }
  });
});
