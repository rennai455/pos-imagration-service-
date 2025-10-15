process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://test.supabase.co";
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY ?? "test-service-role";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://user:password@localhost:5432/pos_test";
process.env.PORT = process.env.PORT ?? "4000";

const signInWithPassword = jest.fn();
const createClient = jest.fn(() => ({
  auth: {
    signInWithPassword,
  },
}));

jest.mock("@supabase/supabase-js", () => ({
  __esModule: true,
  createClient,
}));

(globalThis as unknown as { __supabaseSignInMock: jest.Mock }).__supabaseSignInMock =
  signInWithPassword;

(globalThis as unknown as { __supabaseCreateClientMock: jest.Mock }).__supabaseCreateClientMock =
  createClient;

export {};
