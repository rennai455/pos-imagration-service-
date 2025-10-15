"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";
import { logout } from "../../lib/auth";
import Loader from "../../components/Loader";
import { Toast } from "../../components/Toast";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  function showToast(message: string) {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage("");
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(message);
    }, 0);
  }

  async function fetchProducts() {
    try {
      setLoading(true);
      const data = await apiRequest("/api/products");
      setProducts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      const message = err.message || "Failed to load products";
      setError(message);
      showToast(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    setDeletingId(id);
    try {
      await apiRequest(`/api/products/${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast("Product deleted successfully.");
    } catch (err: any) {
      const message = err.message || "Failed to delete product";
      showToast(message);
    } finally {
      setDeletingId(null);
    }
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex items-center gap-4">
          <Link href="/products/new" className="text-blue-600 underline">
            + Add Product
          </Link>
          <button onClick={handleLogout} className="text-sm text-red-500">
            Sign Out
          </button>
        </div>
      </div>
      {loading ? (
        <Loader />
      ) : error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchProducts}
              className="text-sm font-medium text-red-700 underline"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-t">
                    <td className="px-3 py-2">{product.name}</td>
                    <td className="px-3 py-2 text-right">${product.price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{product.stock}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <Link href={`/products/edit/${product.id}`} className="text-blue-500">
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-500 disabled:opacity-50"
                          disabled={deletingId === product.id}
                        >
                          {deletingId === product.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <Toast message={toastMessage} />
    </div>
  );
}
