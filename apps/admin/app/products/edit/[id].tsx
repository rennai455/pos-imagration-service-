"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";

type ProductForm = {
  name: string;
  price: number;
  stock: number;
};

type EditProductProps = {
  params: { id: string };
};

export default function EditProductPage({ params }: EditProductProps) {
  const [form, setForm] = useState<ProductForm>({ name: "", price: 0, stock: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadProduct() {
      try {
        const product = await apiRequest(`/api/products/${params.id}`);
        setForm({
          name: product.name ?? "",
          price: Number(product.price ?? 0),
          stock: Number(product.stock ?? 0),
        });
      } catch (err: any) {
        alert(err.message || "Failed to load product");
        router.push("/products");
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [params.id, router]);

  function updateField<T extends keyof ProductForm>(key: T, value: ProductForm[T]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await apiRequest(`/api/products/${params.id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      router.push("/products");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-3 max-w-md mx-auto">
      <h2 className="text-xl font-semibold">Edit Product</h2>
      <input
        placeholder="Name"
        value={form.name}
        onChange={(e) => updateField("name", e.target.value)}
        className="border p-2 rounded"
        required
      />
      <input
        placeholder="Price"
        type="number"
        min={0}
        step="0.01"
        value={form.price}
        onChange={(e) => updateField("price", Number(e.target.value))}
        className="border p-2 rounded"
        required
      />
      <input
        placeholder="Stock"
        type="number"
        min={0}
        value={form.stock}
        onChange={(e) => updateField("stock", Number(e.target.value))}
        className="border p-2 rounded"
        required
      />
      <div className="flex gap-3">
        <button type="submit" className="bg-black text-white p-2 rounded disabled:opacity-60" disabled={saving}>
          {saving ? "Saving..." : "Update"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/products")}
          className="border border-gray-300 p-2 rounded"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
