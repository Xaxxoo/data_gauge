import { useState, useEffect, useCallback } from 'react';
import { getDailyUsage, getSettings, getBundles } from '../lib/storage';
import { CARRIERS, getCarrier } from '../lib/carriers';
import type { BundleRecommendation, CarrierPlan } from '../types';

/**
 * Analyzes last 30 days of usage data and recommends optimal carrier plans.
 * Returns three recommendation types: best_fit, safe_choice, budget_pick.
 */
export function useBundleRecommendation() {
  const [recommendations, setRecommendations] = useState<BundleRecommendation[]>([]);
  const [projectedMonthlyMB, setProjectedMonthlyMB] = useState(0);
  const [loading, setLoading] = useState(true);

  const analyze = useCallback(async () => {
    try {
      const [daily, settings, bundles] = await Promise.all([
        getDailyUsage(30),
        getSettings(),
        getBundles(),
      ]);

      if (daily.length < 3) {
        // Need at least 3 days of data for meaningful recommendations
        setLoading(false);
        return;
      }

      // Calculate usage stats
      const totalMB = daily.reduce((s, d) => s + d.totalMB, 0);
      const avgDailyMB = totalMB / daily.length;
      const peakDailyMB = Math.max(...daily.map((d) => d.totalMB));
      const projectedMB = avgDailyMB * 30;
      const peakProjectedMB = peakDailyMB * 30;

      setProjectedMonthlyMB(projectedMB);

      // Get current plan cost for comparison
      const activeBundle = settings.activeBundleId
        ? bundles.find((b) => b.id === settings.activeBundleId)
        : null;
      const currentMonthlyCost = activeBundle?.priceNaira ?? 0;

      const recs: BundleRecommendation[] = [];

      // Scan all carrier plans
      for (const carrier of CARRIERS) {
        // Sort plans by data amount ascending
        const plans = [...carrier.plans].sort((a, b) => a.dataGB - b.dataGB);

        // Best fit: cheapest plan that covers projected monthly usage
        const projectedGB = projectedMB / 1024;
        const bestFit = plans.find((p) => p.dataGB >= projectedGB);

        if (bestFit) {
          recs.push({
            carrierId: carrier.id as BundleRecommendation['carrierId'],
            carrierName: carrier.name,
            plan: bestFit,
            type: 'best_fit',
            label: 'Best Fit',
            projectedUsageMB: projectedMB,
            savingsNaira: currentMonthlyCost > 0
              ? currentMonthlyCost - bestFit.priceNaira
              : 0,
          });
        }

        // Safe choice: cheapest plan that covers peak usage
        const peakGB = peakProjectedMB / 1024;
        const safeChoice = plans.find((p) => p.dataGB >= peakGB);

        if (safeChoice && safeChoice.id !== bestFit?.id) {
          recs.push({
            carrierId: carrier.id as BundleRecommendation['carrierId'],
            carrierName: carrier.name,
            plan: safeChoice,
            type: 'safe_choice',
            label: 'Safe Choice',
            projectedUsageMB: peakProjectedMB,
            savingsNaira: currentMonthlyCost > 0
              ? currentMonthlyCost - safeChoice.priceNaira
              : 0,
          });
        }
      }

      // Budget pick: cheapest plan across all carriers at the needed tier
      const allPlans = CARRIERS.flatMap((c) =>
        c.plans.map((p) => ({ carrier: c, plan: p }))
      );
      const projectedGB = projectedMB / 1024;
      const viablePlans = allPlans
        .filter(({ plan }) => plan.dataGB >= projectedGB)
        .sort((a, b) => a.plan.priceNaira - b.plan.priceNaira);

      if (viablePlans.length > 0) {
        const cheapest = viablePlans[0];
        // Only add if not already in recs
        const alreadyExists = recs.some(
          (r) => r.plan.id === cheapest.plan.id && r.carrierId === cheapest.carrier.id
        );
        if (!alreadyExists) {
          recs.push({
            carrierId: cheapest.carrier.id as BundleRecommendation['carrierId'],
            carrierName: cheapest.carrier.name,
            plan: cheapest.plan,
            type: 'budget_pick',
            label: 'Budget Pick',
            projectedUsageMB: projectedMB,
            savingsNaira: currentMonthlyCost > 0
              ? currentMonthlyCost - cheapest.plan.priceNaira
              : 0,
          });
        }
      }

      // Sort: budget first, then best fit, then safe
      const typeOrder: Record<string, number> = {
        budget_pick: 0,
        best_fit: 1,
        safe_choice: 2,
      };
      recs.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

      // Take top 3 unique recommendations
      setRecommendations(recs.slice(0, 3));
    } catch (err) {
      console.warn('[BurnRate] Recommendation error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    analyze();
  }, [analyze]);

  return { recommendations, projectedMonthlyMB, loading, refresh: analyze };
}
