import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View>
        <Text style={styles.title}>POS Immigration SDK</Text>
        <Text style={styles.description}>
          This Expo app will evolve into the mobile SDK reference implementation for partner POS
          integrations.
        </Text>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f172a'
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 12,
    textAlign: 'center'
  },
  description: {
    fontSize: 16,
    color: '#cbd5f5',
    textAlign: 'center'
  }
});
