import { Layout, Button } from "@codex/ui";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  storeId: string;
};

async function fetchProducts(): Promise<{ products: Product[]; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  try {
    const res = await fetch(`${baseUrl}/api/products`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return { products: [], error: `Request failed with status ${res.status}` };
    }

    const products = (await res.json()) as Product[];
    return { products };
  } catch (error) {
    return { products: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { products, error } = await fetchProducts();

  return (
    <Layout
      title="Codex Admin Dashboard"
      description="Manage stores, inventory, and automation workflows from a single control surface."
    >
      <section style={{ display: "grid", gap: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Products</h2>
            <p style={{ marginTop: 8, fontSize: 14, color: "rgba(226,232,240,0.75)" }}>
              Data is sourced from the Codex API. Additions made via the SDK will appear here once
              synced.
            </p>
          </div>
          <Button type="button" disabled>
            Add product (coming soon)
          </Button>
        </div>

        {error ? (
          <p
            style={{
              borderRadius: 12,
              border: "1px solid rgba(248,113,113,0.6)",
              background: "rgba(127,29,29,0.45)",
              padding: 16,
              fontSize: 14,
              color: "#fecdd3",
            }}
          >
            Unable to load products: {error}
          </p>
        ) : (
          <div
            style={{
              overflow: "hidden",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(15,23,42,0.6)",
              boxShadow: "0 20px 45px -20px rgba(15,23,42,0.6)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "rgba(15,23,42,0.9)", textAlign: "left" }}>
                <tr>
                  {[
                    { label: "Name", align: "left" },
                    { label: "Store", align: "left" },
                    { label: "Price", align: "right" },
                    { label: "Stock", align: "right" },
                  ].map((column) => (
                    <th
                      key={column.label}
                      style={{
                        padding: "12px 16px",
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        color: "rgba(148,163,184,0.85)",
                        textAlign: column.align as "left" | "right",
                      }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: "24px 16px",
                        textAlign: "center",
                        fontSize: 14,
                        color: "rgba(226,232,240,0.65)",
                      }}
                    >
                      No products found yet. Use the SDK or API to seed inventory.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} style={{ borderTop: "1px solid rgba(148,163,184,0.15)" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 600 }}>{product.name}</td>
                      <td style={{ padding: "14px 16px", color: "rgba(226,232,240,0.75)" }}>
                        {product.storeId}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        ${product.price.toFixed(2)}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "rgba(226,232,240,0.75)" }}>
                        {product.stock}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Layout>
  );
}
