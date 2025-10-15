import { BarCodeScanner } from "expo-barcode-scanner";
import { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";

type ScannerProps = {
  onScan: (data: string) => void;
  onCancel?: () => void;
};

export default function Scanner({ onScan, onCancel }: ScannerProps) {
  const [permission, setPermission] = useState<boolean | null>(null);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) =>
      setPermission(status === "granted")
    );
  }, []);

  if (permission === null) return <Text>Requesting camera permission...</Text>;
  if (permission === false)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Text>No camera access</Text>
        {onCancel ? <Button title="Back" onPress={onCancel} /> : null}
      </View>
    );

  return (
    <BarCodeScanner style={{ flex: 1 }} onBarCodeScanned={({ data }) => onScan(data)} />
  );
}
