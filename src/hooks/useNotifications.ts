import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSettings, getBundles } from '../lib/storage';
import { bundleUsedPercent } from '../lib/dataCalc';

// expo-notifications is only available in dev builds
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch {
  // Not available
}

const FIRED_THRESHOLDS_KEY = '@dm:fired_thresholds';

interface FiredThresholds {
  bundleId: string;
  thresholds: number[]; // e.g. [80, 95, 100]
}

/**
 * Hook to manage push notifications for low bundle alerts.
 * Requests permission on first launch and provides a function
 * to check bundle threshold and fire notifications.
 */
export function useNotifications() {
  const permissionGranted = useRef(false);

  // Request permission on mount
  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;

    async function requestPermission() {
      try {
        const { status: existing } = await Notifications!.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== 'granted') {
          const { status } = await Notifications!.requestPermissionsAsync();
          finalStatus = status;
        }

        permissionGranted.current = finalStatus === 'granted';

        // Configure notification behavior
        if (permissionGranted.current) {
          await Notifications!.setNotificationChannelAsync('bundle-alerts', {
            name: 'Bundle Alerts',
            importance: Notifications!.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#EF4444',
          });
        }
      } catch (err) {
        console.warn('[BurnRate] Notification permission error:', err);
      }
    }

    requestPermission();
  }, []);

  /**
   * Check if bundle usage has crossed any threshold and fire notification.
   * Call this after each usage sample.
   */
  const checkBundleThreshold = useCallback(async () => {
    if (Platform.OS === 'web' || !Notifications || !permissionGranted.current) return;

    try {
      const settings = await getSettings();
      if (!settings.activeBundleId) return;

      const bundles = await getBundles();
      const bundle = bundles.find((b) => b.id === settings.activeBundleId);
      if (!bundle) return;

      const usedPct = bundleUsedPercent(bundle.usedMB, bundle.totalMB);
      const remainingMB = Math.max(0, bundle.totalMB - bundle.usedMB);
      const userThreshold = settings.alertThresholdPercent;

      // Load previously fired thresholds
      const raw = await AsyncStorage.getItem(FIRED_THRESHOLDS_KEY);
      let fired: FiredThresholds = raw ? JSON.parse(raw) : { bundleId: '', thresholds: [] };

      // Reset if different bundle
      if (fired.bundleId !== bundle.id) {
        fired = { bundleId: bundle.id, thresholds: [] };
      }

      const alerts: Array<{ threshold: number; title: string; body: string }> = [];

      // User-configured threshold
      if (usedPct >= userThreshold && !fired.thresholds.includes(userThreshold)) {
        alerts.push({
          threshold: userThreshold,
          title: `⚡ ${Math.round(usedPct)}% of your bundle used`,
          body: `You've used ${Math.round(usedPct)}% of your ${bundle.planName} bundle. ${Math.round(remainingMB)}MB remaining.`,
        });
      }

      // 95% threshold
      if (usedPct >= 95 && !fired.thresholds.includes(95)) {
        alerts.push({
          threshold: 95,
          title: '🔴 Almost out of data!',
          body: `Only ${Math.round(remainingMB)}MB remaining on ${bundle.planName}. Consider buying a new bundle.`,
        });
      }

      // 100% threshold
      if (usedPct >= 100 && !fired.thresholds.includes(100)) {
        alerts.push({
          threshold: 100,
          title: '💀 Bundle depleted!',
          body: `Your ${bundle.planName} bundle is depleted. All further usage is out-of-bundle charges.`,
        });
      }

      // Fire notifications and save fired thresholds
      for (const alert of alerts) {
        await Notifications!.scheduleNotificationAsync({
          content: {
            title: alert.title,
            body: alert.body,
            data: { type: 'bundle_alert', bundleId: bundle.id },
            sound: 'default',
          },
          trigger: null, // Fire immediately
        });
        fired.thresholds.push(alert.threshold);
      }

      if (alerts.length > 0) {
        await AsyncStorage.setItem(FIRED_THRESHOLDS_KEY, JSON.stringify(fired));
      }
    } catch (err) {
      console.warn('[BurnRate] Notification check error:', err);
    }
  }, []);

  return { checkBundleThreshold };
}
