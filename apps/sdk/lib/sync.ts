import NetInfo from "@react-native-community/netinfo";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import db, { getUnsynced, ProductRecord } from "./db";
import { apiRequest } from "./api";

const SYNC_TASK = "codex-sync-products";
let networkSubscription: (() => void) | null = null;
let taskDefined = false;

export async function syncProducts() {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const rows = await new Promise<ProductRecord[]>((resolve) => {
    getUnsynced((products) => resolve(products));
  });

  for (const product of rows) {
    try {
      await apiRequest("/api/products", {
        method: "POST",
        body: JSON.stringify({ ...product, updatedAt: product.updatedAt }),
      });
      db.transaction((tx) => {
        tx.executeSql("UPDATE products SET synced = 1 WHERE id = ?;", [product.id]);
      });
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }
}

export function startSyncListener() {
  if (networkSubscription) return;

  networkSubscription = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncProducts().catch((err) => console.error("Sync listener error", err));
    }
  });
}

export function stopSyncListener() {
  if (networkSubscription) {
    networkSubscription();
    networkSubscription = null;
  }
}

export async function registerBackgroundSync() {
  if (!taskDefined) {
    TaskManager.defineTask(SYNC_TASK, async () => {
      try {
        await syncProducts();
        return BackgroundFetch.Result.NewData;
      } catch (error) {
        console.error("Background sync failed", error);
        return BackgroundFetch.Result.Failed;
      }
    });
    taskDefined = true;
  }

  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.Status.Restricted ||
    status === BackgroundFetch.Status.Denied
  ) {
    console.warn("Background fetch is disabled");
    return;
  }

  const tasks = await TaskManager.getRegisteredTasksAsync();
  const alreadyRegistered = tasks.some((task) => task.taskName === SYNC_TASK);

  if (!alreadyRegistered) {
    await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
      minimumInterval: 60 * 60 * 24,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
}
