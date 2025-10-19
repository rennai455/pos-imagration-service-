import * as SecureStore from 'expo-secure-store';

const TOKENS = {
  ACCESS_TOKEN: 'auth.token.access',
  REFRESH_TOKEN: 'auth.token.refresh',
  SYNC_TOKEN: 'sync.token',
};

export class SecureStorageService {
  static async saveToken(key: keyof typeof TOKENS, value: string): Promise<void> {
    await SecureStore.setItemAsync(TOKENS[key], value);
  }

  static async getToken(key: keyof typeof TOKENS): Promise<string | null> {
    return await SecureStore.getItemAsync(TOKENS[key]);
  }

  static async removeToken(key: keyof typeof TOKENS): Promise<void> {
    await SecureStore.deleteItemAsync(TOKENS[key]);
  }

  static async clearAllTokens(): Promise<void> {
    await Promise.all(
      Object.values(TOKENS).map(token => SecureStore.deleteItemAsync(token))
    );
  }
}