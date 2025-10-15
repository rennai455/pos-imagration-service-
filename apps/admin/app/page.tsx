"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function redirectUser() {
      const token = localStorage.getItem("token");
      const { data } = await supabase.auth.getSession();
      if (token && data.session) {
        router.replace("/products");
      } else {
        router.replace("/login");
      }
    }

    redirectUser();
  }, [router]);

  return null;
}
