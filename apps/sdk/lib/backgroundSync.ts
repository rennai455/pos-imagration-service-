import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { openDatabase, SQLiteDatabase } from 'expo-sqlite';
import { SecureStorageService } from './secureStorage';

const SYNC_TASK_NAME = 'BACKGROUND_SYNC';
const DB_NAME = 'pos_offline.db';

interface SyncConfig {
  minInterval: number;  // Minimum time between syncs in seconds
  maxInterval: number;  // Maximum time between syncs in seconds
  requiresCharging: boolean;
  requiresNetwork: boolean;
}

let syncConfig: SyncConfig = {
  minInterval: 15 * 60,  // 15 minutes
  maxInterval: 60 * 60,  // 1 hour
  requiresCharging: false,
  requiresNetwork: true,
};

// Define the background task
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  try {
    const db = await getDatabase();
    const hasChanges = await checkForLocalChanges(db);
    
    if (!hasChanges) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const syncToken = await SecureStorageService.getToken('SYNC_TOKEN');
    if (!syncToken) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    await performSync(db, syncToken);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background sync failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function getDatabase(): Promise<SQLiteDatabase> {
  return openDatabase(DB_NAME);
}

async function checkForLocalChanges(db: SQLiteDatabase): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0',
        [],
        (_, { rows: { _array } }) => {
          resolve(_array[0].count > 0);
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}

async function performSync(db: SQLiteDatabase, token: string): Promise<void> {
  // Get unsynced changes
  const changes = await new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM sync_queue WHERE synced = 0 ORDER BY timestamp ASC',
        [],
        (_, { rows: { _array } }) => resolve(_array),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });

  // Process changes in batches
  const batchSize = 50;
  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    try {
      await sendChangesToServer(batch, token);
      await markChangesAsSynced(db, batch);
    } catch (error) {
      console.error('Failed to sync batch:', error);
      throw error;
    }
  }
}

async function sendChangesToServer(changes: any[], token: string): Promise<void> {
  const response = await fetch('https://api.example.com/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      changes,
      deviceId: await getDeviceId(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.statusText}`);
  }
}

async function markChangesAsSynced(db: SQLiteDatabase, changes: any[]): Promise<void> {
  const ids = changes.map(c => c.id).join(',');
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE sync_queue SET synced = 1 WHERE id IN (${ids})`,
        [],
        (_, result) => resolve(),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}

async function getDeviceId(): Promise<string> {
  const stored = await SecureStorageService.getToken('DEVICE_ID');
  if (stored) return stored;

  const newId = Math.random().toString(36).substring(2) +
                Date.now().toString(36);
  await SecureStorageService.saveToken('DEVICE_ID' as any, newId);
  return newId;
}

export class BackgroundSyncService {
  static async registerBackgroundSync(config?: Partial<SyncConfig>): Promise<void> {
    if (config) {
      syncConfig = { ...syncConfig, ...config };
    }

    try {
      await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
        minimumInterval: syncConfig.minInterval,
        stopOnTerminate: false,
        startOnBoot: true,
        requiresCharging: syncConfig.requiresCharging,
        requiresNetworkConnectivity: syncConfig.requiresNetwork,
      });
    } catch (error) {
      console.error('Failed to register background sync:', error);
      throw error;
    }
  }

  static async unregisterBackgroundSync(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(SYNC_TASK_NAME);
    } catch (error) {
      console.error('Failed to unregister background sync:', error);
      throw error;
    }
  }

  static async updateSyncConfig(config: Partial<SyncConfig>): Promise<void> {
    syncConfig = { ...syncConfig, ...config };
    await this.unregisterBackgroundSync();
    await this.registerBackgroundSync();
  }
}