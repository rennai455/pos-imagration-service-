import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { API_URL } from "./api";

const TOKEN_KEY = "codex/sdk/token";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

let supabase: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase credentials are not configured");
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabase;
}

export async function loginWithSupabase(email: string, password: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw error ?? new Error("Unable to authenticate with Supabase");
  }

  return data.session;
}

export async function exchangeSupabaseTokenForJwt(accessToken: string) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ accessToken }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Unable to fetch JWT");
  }

  const { token } = (await response.json()) as { token: string };
  await setToken(token);
  return token;
}

export async function setToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearSession() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  if (supabase) {
    await supabase.auth.signOut();
  }
}

export async function isAuthenticated() {
  const token = await getToken();
  return Boolean(token);
}
