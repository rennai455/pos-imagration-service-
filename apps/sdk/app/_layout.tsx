import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { initDB } from "../lib/db";
import { isAuthenticated } from "../lib/auth";
import { registerBackgroundSync, startSyncListener, stopSyncListener, syncProducts } from "../lib/sync";
import Loader from "../components/Loader";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDB();
    startSyncListener();
    syncProducts().catch((error) => console.error("Initial sync failed", error));
    registerBackgroundSync().catch((error) => console.warn("Background sync unavailable", error));

    return () => {
      stopSyncListener();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const authed = await isAuthenticated();
        const inAuthGroup = segments[0] === "(auth)";

        if (!authed && !inAuthGroup) {
          router.replace("/(auth)/login");
        } else if (authed && inAuthGroup) {
          router.replace("/(inventory)/index");
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [segments, router]);

  if (!ready) {
    return <Loader label="Preparing app" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
