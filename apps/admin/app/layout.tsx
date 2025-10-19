"use client";
import "./globals.css";
import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { watchSession } from "../lib/auth";

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && pathname !== "/login") {
      router.push("/login");
    }
    const unsubscribe = watchSession();
    return () => {
      unsubscribe?.();
    };
  }, [pathname, router]);

  return (
    <html lang="en">
      <head>
        <title>Admin Portal</title>
        <meta name="description" content="Administration console for POS immigration services." />
      </head>
      <body>{children}</body>
    </html>
  );
}
