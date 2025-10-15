import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { View, Text } from "react-native";

export default function SyncBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setOnline(!!state.isConnected));
    return () => sub();
  }, []);

  return (
    <View
      style={{
        backgroundColor: online ? "#22c55e" : "#f87171",
        padding: 4,
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: "#fff", textAlign: "center" }}>
        {online ? "Online – Sync Active" : "Offline Mode"}
      </Text>
    </View>
  );
}
