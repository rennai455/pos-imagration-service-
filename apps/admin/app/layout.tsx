"use client";
import "./globals.css";
import type { Metadata } from "next";
import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { watchSession } from "../lib/auth";

export const metadata: Metadata = {
  title: "Admin Portal",
  description: "Administration console for POS immigration services.",
};

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
      <body>{children}</body>
    </html>
  );
}
