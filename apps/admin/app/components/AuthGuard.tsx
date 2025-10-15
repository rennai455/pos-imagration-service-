"use client";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const PUBLIC_ROUTES = new Set(["/login"]);

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      const token = localStorage.getItem("token");
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const isPublic = pathname ? PUBLIC_ROUTES.has(pathname) : false;

      if (!token || !session) {
        if (!isPublic) {
          router.replace("/login");
        } else if (isMounted) {
          setChecking(false);
        }
        return;
      }

      if (isPublic) {
        router.replace("/products");
        return;
      }

      if (isMounted) {
        setChecking(false);
      }
    }

    check();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const token = localStorage.getItem("token");
      const isPublic = pathname ? PUBLIC_ROUTES.has(pathname) : false;

      if (!session || !token) {
        if (!isPublic) {
          router.replace("/login");
        } else {
          setChecking(false);
        }
      } else if (isPublic) {
        router.replace("/products");
      } else {
        setChecking(false);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (checking) {
    return null;
  }

  return <>{children}</>;
}
