"use client";
import { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import SyncBanner from "../../components/SyncBanner";
import ProductCard from "../../components/ProductCard";
import Loader from "../../components/Loader";
import { clearSession } from "../../lib/auth";
import { getAllProducts, ProductRecord } from "../../lib/db";
import { syncProducts } from "../../lib/sync";

export default function Inventory() {
  const [products, setProducts] = useState<ProductRecord[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadProducts = useCallback(() => {
    getAllProducts((records) => {
      setProducts(records);
      setRefreshing(false);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefreshing(true);
      loadProducts();
    }, [loadProducts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await syncProducts();
    loadProducts();
  };

  const handleLogout = async () => {
    await clearSession();
    router.replace("/(auth)/login");
  };

  if (!products) {
    return <Loader label="Loading inventory" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#020617", paddingHorizontal: 16, paddingTop: 24 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: "#f8fafc" }}>Inventory</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={{ color: "#f87171", fontWeight: "600" }}>Logout</Text>
        </TouchableOpacity>
      </View>
      <SyncBanner />
      <TouchableOpacity
        onPress={() => router.push("/(inventory)/scan")}
        style={{
          backgroundColor: "#38bdf8",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#0f172a", fontWeight: "700" }}>Scan Product</Text>
      </TouchableOpacity>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={{ color: "#94a3b8", textAlign: "center", marginTop: 32 }}>
            Scan a product to begin building your catalog.
          </Text>
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push({ pathname: "/(inventory)/edit/[id]", params: { id: item.id } })}
          />
        )}
      />
    </View>
  );
}
