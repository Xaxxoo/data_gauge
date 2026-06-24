import { useState, useEffect, useCallback } from 'react';
import { getDailyUsage, getBundles, getSettings } from '../lib/storage';
import { bundleRemainingMB, daysUntilExpiry, daysOfDataLeft } from '../lib/dataCalc';
import type { SmartAlert, AlertSeverity, AlertType, DailyUsage } from '../types';
import { generateId } from '../lib/storage';

/**
 * Analyzes usage patterns from the last 30 days and generates smart alerts.
 * Returns dismissible alert cards for the dashboard.
 */
export function useSmartAlerts() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const analyze = useCallback(async () => {
    try {
      const [daily, settings, bundles] = await Promise.all([
        getDailyUsage(30),
        getSettings(),
        getBundles(),
      ]);

      const newAlerts: SmartAlert[] = [];
      const today = new Date().toISOString().split('T')[0];

      if (daily.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Get today's usage
      const todayUsage = daily.find((d) => d.date === today);
      const todayMB = todayUsage?.totalMB ?? 0;

      // Calculate 7-day average (excluding today)
      const last7 = daily.filter((d) => d.date !== today).slice(0, 7);
      const avg7Day = last7.length > 0
        ? last7.reduce((s, d) => s + d.totalMB, 0) / last7.length
        : 0;

      // ── Burn Rate Spike ──────────────────────────────────
      if (todayMB > 0 && avg7Day > 0 && todayMB > avg7Day * 2) {
        const multiplier = (todayMB / avg7Day).toFixed(1);
        newAlerts.push(mkAlert(
          'burn_spike',
          todayMB > avg7Day * 3 ? 'critical' : 'warning',
          '🔥 Data burn spike detected',
          `You're burning data ${multiplier}x faster than your 7-day average today. ` +
          `Today: ${todayMB.toFixed(0)}MB vs avg: ${avg7Day.toFixed(0)}MB/day.`
        ));
      }

      // ── Approaching Bundle Limit ─────────────────────────
      const activeBundle = settings.activeBundleId
        ? bundles.find((b) => b.id === settings.activeBundleId)
        : bundles[0];

      if (activeBundle && avg7Day > 0) {
        const remaining = bundleRemainingMB(activeBundle.usedMB, activeBundle.totalMB);
        const daysLeft = daysUntilExpiry(activeBundle.expiresAt);
        const dataLastsDays = daysOfDataLeft(remaining, avg7Day);

        if (dataLastsDays < daysLeft && dataLastsDays < 5 && remaining > 0) {
          newAlerts.push(mkAlert(
            'approaching_limit',
            dataLastsDays < 2 ? 'critical' : 'warning',
            '⏳ Bundle running out early',
            `At your current rate (${avg7Day.toFixed(0)}MB/day), your bundle will run out in ` +
            `${Math.ceil(dataLastsDays)} days — but it doesn't expire for ${daysLeft} days. ` +
            `Consider reducing usage or buying a top-up.`
          ));
        }

        // Bundle fully depleted
        if (remaining <= 0) {
          newAlerts.push(mkAlert(
            'bundle_depleted',
            'critical',
            '💀 Bundle depleted',
            `Your ${activeBundle.planName} bundle is fully used. All further data usage is ` +
            `charged at out-of-bundle rates. Buy a new bundle to save money.`
          ));
        }
      }

      // ── Weekend Warrior ──────────────────────────────────
      if (daily.length >= 14) {
        const weekdayUsage: number[] = [];
        const weekendUsage: number[] = [];

        for (const d of daily.slice(0, 14)) {
          const dayOfWeek = new Date(d.date).getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            weekendUsage.push(d.totalMB);
          } else {
            weekdayUsage.push(d.totalMB);
          }
        }

        const avgWeekday = weekdayUsage.length > 0
          ? weekdayUsage.reduce((s, v) => s + v, 0) / weekdayUsage.length
          : 0;
        const avgWeekend = weekendUsage.length > 0
          ? weekendUsage.reduce((s, v) => s + v, 0) / weekendUsage.length
          : 0;

        if (avgWeekend > avgWeekday * 2 && avgWeekday > 0) {
          const multiplier = (avgWeekend / avgWeekday).toFixed(1);
          newAlerts.push(mkAlert(
            'weekend_warrior',
            'info',
            '📅 Weekend data warrior',
            `You use ${multiplier}x more data on weekends (${avgWeekend.toFixed(0)}MB/day) ` +
            `vs weekdays (${avgWeekday.toFixed(0)}MB/day). Consider a larger bundle if weekends ` +
            `are when you stream or download.`
          ));
        }
      }

      setAlerts(newAlerts);
    } catch (err) {
      console.warn('[BurnRate] Smart alerts error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    analyze();
  }, [analyze]);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { alerts, loading, refresh: analyze, dismiss };
}

function mkAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string
): SmartAlert {
  return {
    id: generateId(),
    type,
    severity,
    title,
    message,
    timestamp: new Date().toISOString(),
    dismissed: false,
  };
}
