import { useState, useEffect, useCallback } from 'react';
import {
  getDailyUsage,
  getSessions,
  getBundles,
  getSettings,
  recordDailyUsage,
  saveSession,
  updateBundleUsage,
  generateId,
  todayISO,
} from '../lib/storage';
import { mbToNaira } from '../lib/dataCalc';
import { getPlan } from '../lib/carriers';
import type { DailyUsage, UsageSession, ActiveBundle, AppSettings } from '../types';
import type { CarrierId } from '../types';

export interface DataUsageState {
  settings: AppSettings | null;
  dailyUsage: DailyUsage[];
  todayUsage: DailyUsage | null;
  sessions: UsageSession[];
  bundles: ActiveBundle[];
  activeBundle: ActiveBundle | null;
  loading: boolean;
  totalThisMonthMB: number;
  totalThisMonthNaira: number;
  todayMB: number;
  todayNaira: number;
}

export function useDataUsage() {
  const [state, setState] = useState<DataUsageState>({
    settings: null,
    dailyUsage: [],
    todayUsage: null,
    sessions: [],
    bundles: [],
    activeBundle: null,
    loading: true,
    totalThisMonthMB: 0,
    totalThisMonthNaira: 0,
    todayMB: 0,
    todayNaira: 0,
  });

  const load = useCallback(async () => {
    const [settings, daily, sessions, bundles] = await Promise.all([
      getSettings(),
      getDailyUsage(30),
      getSessions(50),
      getBundles(),
    ]);

    const today = todayISO();
    const todayUsage = daily.find((d) => d.date === today) ?? null;

    const totalThisMonthMB = daily.reduce((sum, d) => sum + d.totalMB, 0);
    const totalThisMonthNaira = daily.reduce((sum, d) => sum + d.costNaira, 0);

    const activeBundle = settings.activeBundleId
      ? bundles.find((b) => b.id === settings.activeBundleId) ?? null
      : bundles[0] ?? null;

    setState({
      settings,
      dailyUsage: daily,
      todayUsage,
      sessions,
      bundles,
      activeBundle,
      loading: false,
      totalThisMonthMB,
      totalThisMonthNaira,
      todayMB: todayUsage?.totalMB ?? 0,
      todayNaira: todayUsage?.costNaira ?? 0,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Log a manual usage entry */
  const logUsage = useCallback(
    async (downloadMB: number, uploadMB: number, note = '') => {
      const settings = await getSettings();
      const plan = getPlan(settings.selectedCarrierId, settings.selectedPlanId);
      const nairaPerMB = settings.customNairaPerMB ?? plan?.nairaPerMB ?? 0.3;

      const totalMB = downloadMB + uploadMB;
      const costNaira = mbToNaira(totalMB, nairaPerMB);
      const now = new Date().toISOString();
      const today = todayISO();

      const session: UsageSession = {
        id: generateId(),
        startTime: now,
        endTime: now,
        downloadedMB: downloadMB,
        uploadedMB: uploadMB,
        totalMB,
        costNaira,
        networkType: 'manual',
        carrierId: settings.selectedCarrierId as CarrierId,
        note,
      };

      await saveSession(session);
      await recordDailyUsage(today, downloadMB, uploadMB, costNaira);

      // Update active bundle usage
      if (settings.activeBundleId) {
        const bundles = await getBundles();
        const bundle = bundles.find((b) => b.id === settings.activeBundleId);
        if (bundle) {
          await updateBundleUsage(settings.activeBundleId, bundle.usedMB + totalMB);
        }
      }

      await load();
    },
    [load]
  );

  return { ...state, reload: load, logUsage };
}
