import { supabase } from "./supabaseClient";
import { apiRequest } from "./api";

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  const res = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!res?.token) {
    throw new Error("Missing authentication token");
  }

  localStorage.setItem("token", res.token);
  return res.user ?? data.user;
}

export function logout() {
  localStorage.removeItem("token");
  supabase.auth.signOut();
}

export function watchSession() {
  const { data } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
    if (!session) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
