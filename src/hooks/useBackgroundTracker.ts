import { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordDailyUsage, getBundles, updateBundleUsage, getSettings, todayISO } from '../lib/storage';
import { getPlan } from '../lib/carriers';
import { mbToNaira } from '../lib/dataCalc';

// expo-task-manager and expo-background-fetch are only available in dev builds
let TaskManager: typeof import('expo-task-manager') | null = null;
let BackgroundFetch: typeof import('expo-background-fetch') | null = null;

try {
  TaskManager = require('expo-task-manager');
  BackgroundFetch = require('expo-background-fetch');
} catch {
  // Not available (Expo Go or web)
}

const TASK_NAME = 'BURNRATE_BACKGROUND_TRACKING';
const LAST_SAMPLE_KEY = '@dm:bg_last_sample';

interface LastSample {
  timestamp: number;
  estimatedBytes: number;
}

/**
 * Estimate bytes used since last sample.
 * Without native byte counters, we use a conservative time-based estimate.
 * On real devices with background data tracking, this gives a rough approximation.
 */
async function sampleAndRecordUsage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SAMPLE_KEY);
    const now = Date.now();
    const settings = await getSettings();
    const plan = getPlan(settings.selectedCarrierId, settings.selectedPlanId);
    const nairaPerMB = settings.customNairaPerMB ?? plan?.nairaPerMB ?? 0.293;

    if (raw) {
      const last: LastSample = JSON.parse(raw);
      const elapsedMs = now - last.timestamp;
      const elapsedMin = elapsedMs / (1000 * 60);

      // Conservative background estimate: ~0.5 MB per 15 minutes
      // This accounts for system syncs, notifications, background app data
      const estimatedMB = Math.max(0, elapsedMin * 0.033);

      if (estimatedMB > 0.01) {
        const downloadMB = estimatedMB * 0.8;
        const uploadMB = estimatedMB * 0.2;
        const cost = mbToNaira(estimatedMB, nairaPerMB);
        const today = todayISO();

        await recordDailyUsage(today, downloadMB, uploadMB, cost);

        // Update active bundle
        if (settings.activeBundleId) {
          const bundles = await getBundles();
          const bundle = bundles.find((b) => b.id === settings.activeBundleId);
          if (bundle) {
            await updateBundleUsage(settings.activeBundleId, bundle.usedMB + estimatedMB);
          }
        }
      }
    }

    // Save current sample
    await AsyncStorage.setItem(
      LAST_SAMPLE_KEY,
      JSON.stringify({ timestamp: now, estimatedBytes: 0 })
    );
  } catch (err) {
    console.warn('[BurnRate] Background sample error:', err);
  }
}

// Register the background task at module scope (required by expo-task-manager)
if (TaskManager && Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(TASK_NAME, async () => {
      try {
        await sampleAndRecordUsage();
        return BackgroundFetch
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : undefined;
      } catch {
        return BackgroundFetch
          ? BackgroundFetch.BackgroundFetchResult.Failed
          : undefined;
      }
    });
  } catch {
    // Task already defined or not supported
  }
}

/**
 * Hook to register and manage background data tracking.
 * Uses expo-background-fetch for periodic sampling (~15 min intervals).
 * Only works in development builds (not Expo Go).
 */
export function useBackgroundTracker() {
  const registered = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !BackgroundFetch || !TaskManager) return;

    async function register() {
      if (registered.current) return;

      try {
        const status = await BackgroundFetch!.getStatusAsync();
        if (
          status === BackgroundFetch!.BackgroundFetchStatus.Denied ||
          status === BackgroundFetch!.BackgroundFetchStatus.Restricted
        ) {
          console.warn('[BurnRate] Background fetch denied by OS');
          return;
        }

        const isRegistered = await TaskManager!.isTaskRegisteredAsync(TASK_NAME);
        if (!isRegistered) {
          await BackgroundFetch!.registerTaskAsync(TASK_NAME, {
            minimumInterval: 15 * 60, // 15 minutes
            stopOnTerminate: false,
            startOnBoot: true,
          });
        }

        registered.current = true;
        console.log('[BurnRate] Background tracking registered');
      } catch (err) {
        console.warn('[BurnRate] Failed to register background task:', err);
      }
    }

    register();

    // Also sample when app comes to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sampleAndRecordUsage();
      }
    });

    // Set initial sample timestamp
    AsyncStorage.getItem(LAST_SAMPLE_KEY).then((raw) => {
      if (!raw) {
        AsyncStorage.setItem(
          LAST_SAMPLE_KEY,
          JSON.stringify({ timestamp: Date.now(), estimatedBytes: 0 })
        );
      }
    });

    return () => {
      sub.remove();
    };
  }, []);
}
