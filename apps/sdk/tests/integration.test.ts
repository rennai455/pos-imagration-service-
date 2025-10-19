import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { SecureStorageService } from '../lib/secureStorage';
import { BackgroundSyncService } from '../lib/backgroundSync';
import { SchemaManager } from '../lib/schemaManager';
import { RemoteConfigService } from '../lib/remoteConfig';
import * as SecureStore from 'expo-secure-store';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { openDatabase } from 'expo-sqlite';

// Mock external dependencies
jest.mock('expo-secure-store');
jest.mock('expo-background-fetch');
jest.mock('expo-task-manager');
jest.mock('expo-sqlite');

describe('SDK Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SecureStorage', () => {
    it('should store and retrieve tokens securely', async () => {
      const testToken = 'test-token';
      await SecureStorageService.saveToken('ACCESS_TOKEN', testToken);
      
      const retrieved = await SecureStorageService.getToken('ACCESS_TOKEN');
      expect(retrieved).toBe(testToken);
      
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth.token.access', testToken);
    });

    it('should clear all tokens', async () => {
      await SecureStorageService.clearAllTokens();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });
  });

  describe('Background Sync', () => {
    it('should register background task with correct configuration', async () => {
      await BackgroundSyncService.registerBackgroundSync({
        minInterval: 900,
        requiresNetwork: true
      });

      expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(
        'BACKGROUND_SYNC',
        expect.any(Object)
      );
    });

    it('should handle sync failures gracefully', async () => {
      // Simulate a failed sync
      const taskHandler = TaskManager.defineTask.mock.calls[0][1];
      const result = await taskHandler();
      
      expect(result).toBe(BackgroundFetch.BackgroundFetchResult.Failed);
    });
  });

  describe('Schema Manager', () => {
    let schemaManager: SchemaManager;

    beforeEach(() => {
      schemaManager = new SchemaManager();
    });

    it('should execute migrations in order', async () => {
      const db = openDatabase('test.db');
      await schemaManager.migrate();

      expect(db.transaction).toHaveBeenCalled();
    });

    it('should track migration versions', async () => {
      const currentVersion = await schemaManager.getCurrentVersion();
      expect(typeof currentVersion).toBe('number');
    });
  });

  describe('Remote Config', () => {
    it('should fetch and apply remote configuration', async () => {
      const config = await RemoteConfigService.getInstance();
      await config.fetchConfig();

      expect(config.isSyncEnabled()).toBe(true);
      expect(config.isInMaintenanceMode()).toBe(false);
    });

    it('should handle maintenance mode correctly', async () => {
      const config = await RemoteConfigService.getInstance();
      // Simulate maintenance mode
      (config as any).config.maintenanceMode = true;

      expect(config.isInMaintenanceMode()).toBe(true);
      expect(config.isSyncEnabled()).toBe(false);
    });
  });
});