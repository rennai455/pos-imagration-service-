import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View, FlatList, RefreshControl } from 'react-native';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  storeId: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/products`);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = (await response.json()) as Product[];
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Codex SDK</Text>
        <Text style={styles.description}>
          Connect your POS to Codex automation. Pulls live product data from the local API.
        </Text>
      </View>

      {error ? (
        <Text style={styles.error}>Unable to load products: {error}</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>Store: {item.storeId}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>
                <Text style={styles.cardStock}>{item.stock} in stock</Text>
              </View>
            </View>
          )}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={fetchProducts} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No products yet. Create one via the API to see it instantly.
            </Text>
          }
        />
      )}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#020617'
  },
  header: {
    paddingVertical: 16,
    gap: 8
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc'
  },
  description: {
    fontSize: 16,
    color: '#cbd5f5'
  },
  error: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.2)',
    color: '#fecdd3'
  },
  list: {
    marginTop: 16
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.85)',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc'
  },
  cardMeta: {
    marginTop: 4,
    color: 'rgba(226,232,240,0.75)'
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38bdf8'
  },
  cardStock: {
    fontSize: 14,
    color: 'rgba(226,232,240,0.75)'
  },
  empty: {
    marginTop: 32,
    textAlign: 'center',
    color: 'rgba(226,232,240,0.65)'
  }
});
