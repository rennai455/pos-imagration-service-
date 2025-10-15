import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.expires_at) {
      localStorage.setItem("supabase.session.expiry", String(session.expires_at));
    } else {
      localStorage.removeItem("supabase.session.expiry");
    }
  });
}
