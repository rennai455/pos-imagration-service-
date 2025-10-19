import { createClient } from '@supabase/supabase-js';
import { SecureStorageService } from './secureStorage';
import { BackgroundSyncService } from './backgroundSync';

interface RemoteConfig {
  syncEnabled: boolean;
  syncMinInterval: number;
  syncMaxInterval: number;
  maintenanceMode: boolean;
  requiredVersion: string;
  features: {
    [key: string]: boolean;
  };
}

const DEFAULT_CONFIG: RemoteConfig = {
  syncEnabled: true,
  syncMinInterval: 900, // 15 minutes
  syncMaxInterval: 3600, // 1 hour
  maintenanceMode: false,
  requiredVersion: '1.0.0',
  features: {}
};

export class RemoteConfigService {
  private static instance: RemoteConfigService;
  private supabase;
  private config: RemoteConfig = DEFAULT_CONFIG;
  private lastFetch: number = 0;
  private fetchInterval: number = 5 * 60 * 1000; // 5 minutes

  private constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  static async getInstance(): Promise<RemoteConfigService> {
    if (!this.instance) {
      const url = await SecureStorageService.getToken('SUPABASE_URL');
      const key = await SecureStorageService.getToken('SUPABASE_ANON_KEY');
      
      if (!url || !key) {
        throw new Error('Supabase configuration not found');
      }

      this.instance = new RemoteConfigService(url, key);
      await this.instance.fetchConfig();
    }
    return this.instance;
  }

  async fetchConfig(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('remote_config')
        .select('*')
        .single();

      if (error) throw error;

      this.config = {
        ...DEFAULT_CONFIG,
        ...data
      };

      this.lastFetch = Date.now();

      // Apply config changes
      await this.applyConfig();
    } catch (error) {
      console.error('Failed to fetch remote config:', error);
      throw error;
    }
  }

  private async applyConfig(): Promise<void> {
    // Update background sync settings
    if (!this.config.syncEnabled) {
      await BackgroundSyncService.unregisterBackgroundSync();
    } else {
      await BackgroundSyncService.updateSyncConfig({
        minInterval: this.config.syncMinInterval,
        maxInterval: this.config.syncMaxInterval
      });
    }

    // Handle maintenance mode
    if (this.config.maintenanceMode) {
      // Disable write operations
      await this.disableWrites();
    }

    // Version check
    const currentVersion = await this.getCurrentAppVersion();
    if (this.compareVersions(currentVersion, this.config.requiredVersion) < 0) {
      await this.promptForUpdate();
    }
  }

  private async getCurrentAppVersion(): Promise<string> {
    // In a real app, you'd get this from your app config or native code
    return '1.0.0';
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (aParts[i] > bParts[i]) return 1;
      if (aParts[i] < bParts[i]) return -1;
    }
    
    return 0;
  }

  private async disableWrites(): Promise<void> {
    // Implement write blocking logic
  }

  private async promptForUpdate(): Promise<void> {
    // Implement update prompt UI
  }

  isFeatureEnabled(feature: string): boolean {
    return this.config.features[feature] ?? false;
  }

  isSyncEnabled(): boolean {
    return this.config.syncEnabled && !this.config.maintenanceMode;
  }

  isInMaintenanceMode(): boolean {
    return this.config.maintenanceMode;
  }

  needsUpdate(): boolean {
    const currentVersion = await this.getCurrentAppVersion();
    return this.compareVersions(currentVersion, this.config.requiredVersion) < 0;
  }

  async refreshIfNeeded(): Promise<void> {
    if (Date.now() - this.lastFetch >= this.fetchInterval) {
      await this.fetchConfig();
    }
  }
}