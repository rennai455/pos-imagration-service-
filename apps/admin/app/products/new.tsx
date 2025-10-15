"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";

export default function NewProduct() {
  const [form, setForm] = useState({ name: "", price: 0, stock: 0 });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function updateField<T extends keyof typeof form>(key: T, value: (typeof form)[T]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await apiRequest("/api/products", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push("/products");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-3 max-w-md mx-auto">
      <h2 className="text-xl font-semibold">Add Product</h2>
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
          {saving ? "Saving..." : "Save"}
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
