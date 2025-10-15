import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import Scanner from "../../components/Scanner";
import Loader from "../../components/Loader";
import { fetchJSON } from "../../lib/api";
import { getProductByBarcode, ProductRecord, upsertProduct } from "../../lib/db";

export default function ScanScreen() {
  const router = useRouter();
  const [barcode, setBarcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [stock, setStock] = useState("0");

  const handleScan = async (value: string) => {
    setError(null);
    setLoading(true);

    const existing = await new Promise<ProductRecord | null>((resolve) =>
      getProductByBarcode(value, resolve)
    );

    if (existing) {
      setLoading(false);
      router.replace({ pathname: "/(inventory)/edit/[id]", params: { id: existing.id } });
      return;
    }

    try {
      const remote = await tryFetchRemoteProduct(value);
      if (remote) {
        upsertProduct({
          id: remote.id,
          name: remote.name,
          barcode: remote.barcode ?? value,
          price: remote.price ?? null,
          stock: remote.stock ?? 0,
          updatedAt: remote.updatedAt ?? new Date().toISOString(),
          synced: 1,
        });
        router.replace({ pathname: "/(inventory)/edit/[id]", params: { id: remote.id } });
        return;
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to fetch product");
    }

    setBarcode(value);
    setLoading(false);
  };

  const handleCreate = () => {
    if (!barcode) return;

    if (!name.trim()) {
      setError("Product name is required");
      return;
    }

    const id = `local-${Date.now()}`;
    const parsedPrice = Number(price) || 0;
    const parsedStock = Number(stock) || 0;

    upsertProduct({
      id,
      name: name.trim(),
      barcode,
      price: parsedPrice,
      stock: parsedStock,
      updatedAt: new Date().toISOString(),
      synced: 0,
    });

    Alert.alert("Saved", "Product stored locally. Remember to sync when online.");
    router.replace({ pathname: "/(inventory)/edit/[id]", params: { id } });
  };

  if (loading) {
    return <Loader label="Looking up product" />;
  }

  if (barcode) {
    return (
      <View style={{ flex: 1, backgroundColor: "#020617", padding: 20, gap: 16 }}>
        <View>
          <Text style={{ color: "#f8fafc", fontSize: 24, fontWeight: "700" }}>New product</Text>
          <Text style={{ color: "#94a3b8", marginTop: 4 }}>
            No match found for barcode {barcode}. Create a new product to sync later.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Product name"
              placeholderTextColor="#64748b"
              style={inputStyle}
            />
          </View>
          <View>
            <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Price</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#64748b"
              style={inputStyle}
            />
          </View>
          <View>
            <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Initial Stock</Text>
            <TextInput
              value={stock}
              onChangeText={setStock}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#64748b"
              style={inputStyle}
            />
          </View>
        </View>

        {error ? <Text style={{ color: "#f87171" }}>{error}</Text> : null}

        <TouchableOpacity
          onPress={handleCreate}
          style={{ backgroundColor: "#38bdf8", padding: 16, borderRadius: 12, alignItems: "center" }}
        >
          <Text style={{ color: "#0f172a", fontWeight: "700" }}>Save & Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setBarcode(null)} style={{ alignItems: "center" }}>
          <Text style={{ color: "#94a3b8" }}>Scan again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {error ? (
        <View style={{ padding: 16, backgroundColor: "#7f1d1d" }}>
          <Text style={{ color: "#fecaca" }}>{error}</Text>
        </View>
      ) : null}
      <Scanner onScan={handleScan} onCancel={() => router.back()} />
    </View>
  );
}

async function tryFetchRemoteProduct(barcode: string) {
  try {
    const data = await fetchJSON<any>(
      `/api/products/lookup?barcode=${encodeURIComponent(barcode)}`
    );

    if (data && typeof data === "object" && data.id && data.name) {
      return data;
    }

    return null;
  } catch {
    return null;
  }
}

const inputStyle = {
  backgroundColor: "#0f172a",
  borderRadius: 10,
  padding: 14,
  color: "#e2e8f0",
  borderWidth: 1,
  borderColor: "rgba(148,163,184,0.2)",
};
