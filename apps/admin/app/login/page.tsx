"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../lib/auth";
import { Toast } from "../../components/Toast";
import Loader from "../../components/Loader";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      router.push("/products");
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-80 bg-white p-8 rounded shadow">
        <h2 className="text-xl font-semibold text-center">Store Login</h2>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border p-2 rounded"
          type="email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="border p-2 rounded"
          required
        />
        <button type="submit" disabled={loading} className="bg-black text-white p-2 rounded disabled:opacity-60">
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>
      {loading && <Loader />}
      {error && <Toast message={error} />}
    </div>
  );
}
