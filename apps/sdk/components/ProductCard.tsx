import { View, Text, TouchableOpacity } from "react-native";
import { ProductRecord } from "../lib/db";

type ProductCardProps = {
  product: ProductRecord;
  onPress?: () => void;
};

export default function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: "#0f172a",
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(148,163,184,0.3)",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: "#e2e8f0", fontSize: 18, fontWeight: "600" }}>{product.name}</Text>
        <Text style={{ color: "#38bdf8", fontWeight: "700" }}>
          {product.price ? `$${product.price.toFixed(2)}` : "--"}
        </Text>
      </View>
      {product.barcode ? (
        <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Barcode: {product.barcode}</Text>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "#cbd5f5" }}>Stock: {product.stock}</Text>
        {product.synced === 0 ? (
          <Text style={{ color: "#facc15", fontSize: 12 }}>Pending sync</Text>
        ) : (
          <Text style={{ color: "#22c55e", fontSize: 12 }}>Synced</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
