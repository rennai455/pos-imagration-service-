import { ActivityIndicator, View, Text } from "react-native";

type LoaderProps = {
  label?: string;
};

export default function Loader({ label = "Loading..." }: LoaderProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 16,
      }}
    >
      <ActivityIndicator color="#38bdf8" />
      <Text style={{ color: "#cbd5f5" }}>{label}</Text>
    </View>
  );
}
