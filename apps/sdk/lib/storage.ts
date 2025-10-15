import * as SecureStore from "expo-secure-store";

export async function setItem<T>(key: string, value: T) {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function getItem<T>(key: string) {
  const raw = await SecureStore.getItemAsync(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function removeItem(key: string) {
  await SecureStore.deleteItemAsync(key);
}
