import { PropsWithChildren } from "react";

interface LayoutProps extends PropsWithChildren {
  title: string;
  description?: string;
}

export function Layout({ title, description, children }: LayoutProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
        color: "#f8fafc",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
          background: "rgba(15, 23, 42, 0.75)",
          padding: "24px 32px",
          backdropFilter: "blur(6px)",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>{title}</h1>
        {description ? (
          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              maxWidth: 720,
              fontSize: 14,
              color: "rgba(226, 232, 240, 0.75)",
            }}
          >
            {description}
          </p>
        ) : null}
      </header>
      <main style={{ padding: "32px" }}>{children}</main>
    </div>
  );
}
