import { jest } from '@jest/globals';

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://test.supabase.co";
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY ?? "test-service-role";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/pos_dev";
process.env.PORT = process.env.PORT ?? "4000";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "48C5B4B5DB0AE30EBF4F202566D636D5499E98592211B0BF8EFD0D1C1F99FA06";

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

declare global {
  var __supabaseSignInMock: jest.Mock;
  var __supabaseCreateClientMock: jest.Mock;
}

export {};
