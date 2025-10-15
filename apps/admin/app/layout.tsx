import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { AuthGuard } from "./components/AuthGuard";

export const metadata: Metadata = {
  title: "Admin Portal",
  description: "Administration console for POS immigration services.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
