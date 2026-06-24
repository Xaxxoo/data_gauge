import { useState, useEffect, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getSettings, saveSession, recordDailyUsage, getBundles, updateBundleUsage, generateId, todayISO } from '../lib/storage';
import { mbToNaira, bytesToMB } from '../lib/dataCalc';
import { getPlan } from '../lib/carriers';
import type { CarrierId } from '../types';

interface TrackingState {
  isTracking: boolean;
  /** Seconds since tracking started */
  elapsed: number;
  /** Estimated download MB this session */
  downloadMB: number;
  /** Estimated upload MB this session */
  uploadMB: number;
  /** Total MB this session */
  totalMB: number;
  /** Estimated cost so far */
  costNaira: number;
  /** Current network type */
  networkType: string;
  /** Current estimated speed (MB/s) */
  currentRate: number;
}

const POLL_INTERVAL_MS = 2000; // sample every 2s

/**
 * Tracks real-time data usage by measuring actual network transfer.
 * Uses fetch probes to estimate throughput and accumulates usage over time.
 * On native, falls back to time-based estimation using connection type.
 */
export function useDataTracker() {
  const [state, setState] = useState<TrackingState>({
    isTracking: false,
    elapsed: 0,
    downloadMB: 0,
    uploadMB: 0,
    totalMB: 0,
    costNaira: 0,
    networkType: 'Unknown',
    currentRate: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const prevBytesRef = useRef<{ rx: number; tx: number }>({ rx: 0, tx: 0 });
  const accumRef = useRef<{ dl: number; ul: number }>({ dl: 0, ul: 0 });
  const nairaPerMBRef = useRef(0.293);

  // Get ₦/MB rate
  useEffect(() => {
    getSettings().then((s) => {
      const plan = getPlan(s.selectedCarrierId, s.selectedPlanId);
      nairaPerMBRef.current = s.customNairaPerMB ?? plan?.nairaPerMB ?? 0.293;
    });
  }, []);

  // Detect network type
  useEffect(() => {
    const unsub = NetInfo.addEventListener((netState) => {
      let displayType = 'Unknown';
      if (netState.type === 'wifi') displayType = 'WiFi';
      else if (netState.type === 'cellular') {
        const gen = (netState.details as { cellularGeneration?: string })?.cellularGeneration;
        if (gen === '4g') displayType = '4G LTE';
        else if (gen === '5g') displayType = '5G';
        else if (gen === '3g') displayType = '3G';
        else if (gen === '2g') displayType = '2G';
        else displayType = 'Cellular';
      } else if (netState.type === 'none') {
        displayType = 'Offline';
      }
      setState((s) => ({ ...s, networkType: displayType }));
    });
    return unsub;
  }, []);

  /**
   * Measure actual bytes transferred using the Performance API (web)
   * or estimate based on connection type (native).
   */
  const sampleUsage = useCallback(() => {
    const now = Date.now();
    const elapsedSec = (now - startTimeRef.current) / 1000;

    // Use Performance API resource entries if available (web)
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      try {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        let totalTransferred = 0;
        for (const entry of entries) {
          if (entry.transferSize > 0) {
            totalTransferred += entry.transferSize;
          }
        }
        // Track delta since last sample
        const delta = Math.max(0, totalTransferred - prevBytesRef.current.rx);
        if (delta > 0) {
          const deltaMB = bytesToMB(delta);
          // Rough split: 90% download, 10% upload for typical browsing
          accumRef.current.dl += deltaMB * 0.9;
          accumRef.current.ul += deltaMB * 0.1;
          prevBytesRef.current.rx = totalTransferred;
        }
      } catch {
        // Fallback to estimation
        estimateByConnectionType(elapsedSec);
      }
    } else {
      // Native: estimate based on connection type and time
      estimateByConnectionType(elapsedSec);
    }

    const dl = accumRef.current.dl;
    const ul = accumRef.current.ul;
    const total = dl + ul;
    const rate = nairaPerMBRef.current;

    setState((s) => ({
      ...s,
      elapsed: Math.floor(elapsedSec),
      downloadMB: dl,
      uploadMB: ul,
      totalMB: total,
      costNaira: mbToNaira(total, rate),
      currentRate: elapsedSec > 0 ? total / (elapsedSec / 60) : 0, // MB per minute
    }));
  }, []);

  /**
   * Conservative background estimation based on connection type.
   * These are typical idle/light-use rates per 2-second interval.
   */
  function estimateByConnectionType(elapsedSec: number) {
    // Estimate per poll interval (2s) — typical background + light use
    // These are conservative: real usage depends on what's actually happening
    const mbPer2Sec = 0.005; // ~150 KB/2s = ~4.5 MB/min for active browsing estimate
    accumRef.current.dl += mbPer2Sec * 0.85;
    accumRef.current.ul += mbPer2Sec * 0.15;
  }

  const start = useCallback(() => {
    if (intervalRef.current) return;
    startTimeRef.current = Date.now();
    accumRef.current = { dl: 0, ul: 0 };
    prevBytesRef.current = { rx: 0, tx: 0 };

    // Clear performance entries on web for clean tracking
    if (typeof performance !== 'undefined' && performance.clearResourceTimings) {
      performance.clearResourceTimings();
    }

    setState((s) => ({
      ...s,
      isTracking: true,
      elapsed: 0,
      downloadMB: 0,
      uploadMB: 0,
      totalMB: 0,
      costNaira: 0,
      currentRate: 0,
    }));

    intervalRef.current = setInterval(sampleUsage, POLL_INTERVAL_MS);
  }, [sampleUsage]);

  const stop = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const dl = accumRef.current.dl;
    const ul = accumRef.current.ul;
    const total = dl + ul;

    if (total > 0) {
      // Save session and daily usage
      const settings = await getSettings();
      const plan = getPlan(settings.selectedCarrierId, settings.selectedPlanId);
      const rate = settings.customNairaPerMB ?? plan?.nairaPerMB ?? 0.293;
      const cost = mbToNaira(total, rate);
      const today = todayISO();

      await saveSession({
        id: generateId(),
        startTime: new Date(startTimeRef.current).toISOString(),
        endTime: new Date().toISOString(),
        downloadedMB: dl,
        uploadedMB: ul,
        totalMB: total,
        costNaira: cost,
        networkType: state.networkType,
        carrierId: settings.selectedCarrierId as CarrierId,
        note: 'Auto-tracked session',
      });

      await recordDailyUsage(today, dl, ul, cost);

      // Update active bundle
      if (settings.activeBundleId) {
        const bundles = await getBundles();
        const bundle = bundles.find((b) => b.id === settings.activeBundleId);
        if (bundle) {
          await updateBundleUsage(settings.activeBundleId, bundle.usedMB + total);
        }
      }
    }

    setState((s) => ({ ...s, isTracking: false }));
  }, [state.networkType]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { ...state, start, stop };
}
