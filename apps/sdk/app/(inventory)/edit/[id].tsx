import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Loader from "../../../components/Loader";
import SyncBanner from "../../../components/SyncBanner";
import { getProductById, ProductRecord, upsertProduct } from "../../../lib/db";
import { syncProducts } from "../../../lib/sync";

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [stock, setStock] = useState("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = useCallback(() => {
    if (!id) return;
    setLoading(true);
    getProductById(id, (record) => {
      if (!record) {
        setError("Product not found locally");
        setLoading(false);
        return;
      }

      setProduct(record);
      setName(record.name);
      setPrice(record.price != null ? String(record.price) : "0");
      setStock(String(record.stock));
      setLoading(false);
    });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct])
  );

  const handleSave = () => {
    if (!product) return;

    if (!name.trim()) {
      Alert.alert("Name required", "Please provide a name for this product.");
      return;
    }

    const parsedPrice = Number(price) || 0;
    const parsedStock = Number(stock) || 0;

    upsertProduct({
      id: product.id,
      name: name.trim(),
      barcode: product.barcode,
      price: parsedPrice,
      stock: parsedStock,
      updatedAt: new Date().toISOString(),
      synced: 0,
    });

    Alert.alert("Saved", "Changes stored locally and will sync when online.");
    router.replace("/(inventory)/index");
  };

  const handleSyncNow = async () => {
    await syncProducts();
    loadProduct();
  };

  if (loading || !product) {
    return <Loader label={loading ? "Loading product" : "Product missing"} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#020617", padding: 20, gap: 16 }}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ color: "#38bdf8" }}>Back</Text>
      </TouchableOpacity>
      <Text style={{ color: "#f8fafc", fontSize: 24, fontWeight: "700" }}>Edit Product</Text>
      <SyncBanner />

      <View>
        <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Barcode</Text>
        <Text style={{ color: "#cbd5f5", padding: 12, backgroundColor: "#0f172a", borderRadius: 10 }}>
          {product.barcode ?? "N/A"}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <View>
          <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={inputStyle}
            placeholder="Product name"
            placeholderTextColor="#64748b"
          />
        </View>
        <View>
          <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Price</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            style={inputStyle}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#64748b"
          />
        </View>
        <View>
          <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Stock</Text>
          <TextInput
            value={stock}
            onChangeText={setStock}
            style={inputStyle}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#64748b"
          />
        </View>
      </View>

      {error ? <Text style={{ color: "#f87171" }}>{error}</Text> : null}

      <TouchableOpacity
        onPress={handleSave}
        style={{ backgroundColor: "#38bdf8", padding: 16, borderRadius: 12, alignItems: "center" }}
      >
        <Text style={{ color: "#0f172a", fontWeight: "700" }}>Save Changes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleSyncNow}
        style={{ backgroundColor: "#10b981", padding: 14, borderRadius: 12, alignItems: "center" }}
      >
        <Text style={{ color: "#022c22", fontWeight: "700" }}>Sync Now</Text>
      </TouchableOpacity>

      <View>
        <Text style={{ color: "#64748b", fontSize: 12 }}>
          Last updated: {new Date(product.updatedAt).toLocaleString()}
        </Text>
        <Text style={{ color: product.synced === 1 ? "#22c55e" : "#facc15", fontSize: 12 }}>
          {product.synced === 1 ? "Synced" : "Pending sync"}
        </Text>
      </View>
    </View>
  );
}

const inputStyle = {
  backgroundColor: "#0f172a",
  borderRadius: 10,
  padding: 14,
  color: "#e2e8f0",
  borderWidth: 1,
  borderColor: "rgba(148,163,184,0.2)",
};
