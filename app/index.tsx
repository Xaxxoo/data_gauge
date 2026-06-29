import { CARRIER_COLORS } from '../src/components/ui/colors';
import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/lib/theme';
import { ThemeColors } from '../src/components/ui/colors';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { DataRing } from '../src/components/DataRing';
import { UsageBar } from '../src/components/UsageBar';
import { useDataUsage } from '../src/hooks/useDataUsage';
import { useNetworkInfo } from '../src/hooks/useNetworkInfo';
import { useGoodDollar } from '../src/hooks/useGoodDollar';
import { GDBalancePill } from '../src/components/GDBalancePill';
import { useDataTracker } from '../src/hooks/useDataTracker';
import { useSmartAlerts } from '../src/hooks/useSmartAlerts';
import { formatBytes, formatNaira, daysUntilExpiry, bundleRemainingMB } from '../src/lib/dataCalc';
import { getCarrier } from '../src/lib/carriers';

const GD_GREEN = '#00C853';

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Dashboard() {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const router = useRouter();
  const network = useNetworkInfo();
  const gd = useGoodDollar();
  const tracker = useDataTracker();
  const smartAlerts = useSmartAlerts();
  const {
    settings,
    activeBundle,
    todayMB,
    todayNaira,
    totalThisMonthMB,
    totalThisMonthNaira,
    dailyUsage,
    loading,
    reload,
  } = useDataUsage();

  const carrier = settings ? getCarrier(settings.selectedCarrierId) : null;
  const nairaPerMB = settings?.customNairaPerMB ?? activeBundle?.nairaPerMB ?? 0.293;

  const last7Days = dailyUsage.slice(0, 7).reverse();
  const avgDailyMB = last7Days.length > 0
    ? last7Days.reduce((s, d) => s + d.totalMB, 0) / last7Days.length
    : 0;

  const onRefresh = useCallback(() => { reload(); }, [reload]);

  const handleStartStop = useCallback(async () => {
    if (tracker.isTracking) {
      await tracker.stop();
      reload();
    } else {
      tracker.start();
    }
  }, [tracker, reload]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text variant="h1">DataGauge</Text>
            <Text variant="body">Track. Alert. Save.</Text>
          </View>
        </View>

        {/* Connect Pill aligned to right */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
          <GDBalancePill />
        </View>

        {/* Active carrier */}
        {carrier && (
          <View style={styles.carrierRow}>
            <Text variant="caption">Active Network</Text>
            <Badge
              label={carrier.name}
              color={CARRIER_COLORS[carrier.id]}
              size="md"
            />
          </View>
        )}

        {/* ── BIG START / STOP BUTTON ── */}
        {!tracker.isTracking ? (
          <TouchableOpacity style={styles.startBtn} onPress={handleStartStop} activeOpacity={0.8}>
            <View style={styles.startCircle}>
              <Ionicons name="play-outline" size={32} color={colors.bg} />
            </View>
            <Text style={styles.startLabel}>Start Tracking</Text>
            <Text style={styles.startSub}>
              {network.isConnected
                ? `Connected via ${network.displayType}`
                : 'No connection detected'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Card glow={colors.accent} style={styles.trackingCard}>
            <View style={styles.trackingHeader}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>TRACKING</Text>
              <Text style={styles.elapsedText}>{formatElapsed(tracker.elapsed)}</Text>
            </View>

            <View style={styles.trackingStats}>
              <View style={styles.trackingStat}>
                <Ionicons name="arrow-down-outline" size={14} color={colors.accent} />
                <View>
                  <Text style={styles.trackingVal}>{formatBytes(tracker.downloadMB * 1024 * 1024)}</Text>
                  <Text style={styles.trackingLabel}>Download</Text>
                </View>
              </View>
              <View style={styles.trackingDivider} />
              <View style={styles.trackingStat}>
                <Ionicons name="arrow-up-outline" size={14} color={colors.warning} />
                <View>
                  <Text style={styles.trackingVal}>{formatBytes(tracker.uploadMB * 1024 * 1024)}</Text>
                  <Text style={styles.trackingLabel}>Upload</Text>
                </View>
              </View>
              <View style={styles.trackingDivider} />
              <View style={styles.trackingStat}>
                <Ionicons name="pricetag-outline" size={14} color={colors.danger} />
                <View>
                  <Text style={styles.trackingVal}>{formatNaira(tracker.costNaira)}</Text>
                  <Text style={styles.trackingLabel}>Cost</Text>
                </View>
              </View>
            </View>

            <Text style={styles.trackingNetwork}>
              {tracker.networkType} · {formatBytes(tracker.totalMB * 1024 * 1024)} total
            </Text>

            <TouchableOpacity style={styles.stopBtn} onPress={handleStartStop} activeOpacity={0.8}>
              <Ionicons name="pause-outline" size={16} color="#FFF" />
              <Text style={styles.stopLabel}>Stop & Save</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Smart Alerts */}
        {smartAlerts.alerts.length > 0 && (
          <View style={styles.alertsSection}>
            {smartAlerts.alerts.map((alert) => {
              const alertColor = alert.severity === 'critical' ? colors.danger : alert.severity === 'warning' ? colors.warning : colors.accent;
              return (
                <Card key={alert.id} glow={alertColor} style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <Text style={[styles.alertTitle, { color: alertColor }]}>{alert.title}</Text>
                    <TouchableOpacity onPress={() => smartAlerts.dismiss(alert.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-outline" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <Text variant="body" style={{ marginTop: 4 }}>{alert.message}</Text>
                </Card>
              );
            })}
          </View>
        )}

        {/* GoodDollar G$ widget */}
        <TouchableOpacity onPress={() => router.push('/earn')}>
          <Card
            glow={gd.walletAddress ? GD_GREEN : undefined}
            style={[styles.gdCard, !gd.walletAddress && styles.gdCardEmpty]}
          >
            {gd.walletAddress ? (
              <View style={styles.gdRow}>
                <View style={styles.gdLogoSmall}>
                  <Text style={styles.gdLogoText}>G$</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={GD_GREEN}>GoodDollar Balance</Text>
                  <Text style={styles.gdBalance}>
                    {gd.loading ? '...' : `${gd.balance.toFixed(0)} G$`}
                  </Text>
                  <Text style={styles.gdNgn}>
                    ≈ ₦{gd.loading ? '...' : gd.balanceNGN.toFixed(0)}
                    {gd.claimable > 0 && (
                      <Text style={{ color: GD_GREEN }}> · +{gd.claimable.toFixed(0)} G$ claimable</Text>
                    )}
                  </Text>
                </View>
                <View style={styles.gdActions}>
                  <TouchableOpacity
                    style={styles.gdBtn}
                    onPress={(e) => { e.stopPropagation(); router.push('/buy-data'); }}
                  >
                    <Text style={{ color: GD_GREEN, fontSize: 11, fontWeight: '700' }}>
                      Buy Data →
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.gdRow}>
                <Text style={styles.gdLogoText2}>G$</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: GD_GREEN, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                    Earn free G$ → buy data
                  </Text>
                  <Text variant="body" numberOfLines={2}>Connect wallet in Earn tab to claim daily UBI</Text>
                </View>
                <Ionicons name="arrow-forward-outline" size={14} color={GD_GREEN} />
              </View>
            )}
          </Card>
        </TouchableOpacity>

        {/* Active bundle ring */}
        {activeBundle && (
          <Card glow={colors.accent} style={styles.bundleCard}>
            <View style={styles.bundleRow}>
              <DataRing
                usedMB={activeBundle.usedMB}
                totalMB={activeBundle.totalMB}
                size={150}
                color={colors.accent}
                trackColor={colors.border}
                sublabel={`of ${formatBytes(activeBundle.totalMB * 1024 * 1024)}`}
              />
              <View style={styles.bundleInfo}>
                <Text variant="h3">{activeBundle.planName}</Text>
                <View style={styles.statRow}>
                  <Text variant="caption">Used</Text>
                  <Text style={styles.statVal}>
                    {formatBytes(activeBundle.usedMB * 1024 * 1024)}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text variant="caption">Left</Text>
                  <Text style={[styles.statVal, { color: colors.accent }]}>
                    {formatBytes(bundleRemainingMB(activeBundle.usedMB, activeBundle.totalMB) * 1024 * 1024)}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text variant="caption">Cost</Text>
                  <Text style={[styles.statVal, { color: colors.warning }]}>
                    {formatNaira(activeBundle.usedMB * activeBundle.nairaPerMB)}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text variant="caption">Expires</Text>
                  <Text style={styles.statVal}>
                    {daysUntilExpiry(activeBundle.expiresAt)}d left
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Today + Month stats */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard} glow={colors.accent}>
            <Text variant="caption">Today</Text>
            <Text style={styles.bigStat}>{formatBytes(todayMB * 1024 * 1024)}</Text>
            <Text style={styles.costStat}>{formatNaira(todayNaira)}</Text>
          </Card>
          <Card style={styles.statCard} glow={colors.warning}>
            <Text variant="caption">This Month</Text>
            <Text style={styles.bigStat}>{formatBytes(totalThisMonthMB * 1024 * 1024)}</Text>
            <Text style={styles.costStat}>{formatNaira(totalThisMonthNaira)}</Text>
          </Card>
        </View>

        {/* Daily avg */}
        <Card style={styles.avgCard}>
          <Text variant="h3">Daily Average (7 days)</Text>
          <View style={styles.avgRow}>
            <View>
              <Text style={styles.avgVal}>{formatBytes(avgDailyMB * 1024 * 1024)}</Text>
              <Text variant="body">{formatNaira(avgDailyMB * nairaPerMB)}/day</Text>
            </View>
            <View style={styles.avgRight}>
              <Text variant="caption">Rate</Text>
              <Text style={[styles.avgVal, { color: colors.warning, fontSize: 16 }]}>
                ₦{nairaPerMB.toFixed(3)}/MB
              </Text>
            </View>
          </View>
        </Card>

        {/* Last 7 days mini bar chart */}
        {last7Days.length > 0 && (
          <Card>
            <Text variant="h3" style={{ marginBottom: 12 }}>Last 7 Days</Text>
            <View style={styles.miniChart}>
              {last7Days.map((d, i) => {
                const maxMB = Math.max(...last7Days.map((x) => x.totalMB), 1);
                const h = Math.max(4, (d.totalMB / maxMB) * 80);
                const isToday = i === last7Days.length - 1;
                return (
                  <View key={d.date} style={styles.barCol}>
                    <Text style={styles.barLabel}>
                      {formatBytes(d.totalMB * 1024 * 1024, 0).replace(' ', '\n')}
                    </Text>
                    <View
                      style={[
                        styles.bar,
                        { height: h, backgroundColor: isToday ? colors.accent : colors.border },
                      ]}
                    />
                    <Text style={styles.barDay}>
                      {new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short' }).slice(0, 2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Quick actions */}
        <View style={styles.actions}>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/speed-test')}
          >
            <Ionicons name="speedometer-outline" size={22} color={colors.accent} />
            <Text variant="caption" style={{ textAlign: 'center' }}>Speed{'\n'}Test</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/ussd-check')}
          >
            <Ionicons name="call-outline" size={22} color={colors.accent} />
            <Text variant="caption" style={{ textAlign: 'center' }}>USSD{'\n'}Check</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/bundles')}
          >
            <Ionicons name="layers-outline" size={22} color={colors.accent} />
            <Text variant="caption" style={{ textAlign: 'center' }}>My{'\n'}Bundle</Text>
          </TouchableOpacity>
        </View>

        {/* MTN tip */}
        <Card style={styles.tipCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="information-circle-outline" size={13} color={colors.warning} />
            <Text variant="caption" color={colors.warning}>Pro Tip — Catch MTN</Text>
          </View>
          <Text variant="body" style={{ marginTop: 4 }}>
            Note your bundle balance before and after watching a video. Log both in the
            Audit tab. If the difference exceeds what you actually used, you have proof
            of excess deduction.
          </Text>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' as const },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  networkText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  carrierRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Start button
  startBtn: { alignItems: 'center', paddingVertical: 32, gap: 12, backgroundColor: colors.surface, borderRadius: 20 },
  startCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  startLabel: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  startSub: { fontSize: 13, color: colors.textSecondary },

  // Live tracking card
  trackingCard: { gap: 14 },
  trackingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveLabel: { fontSize: 11, fontWeight: '800', color: colors.success, letterSpacing: 1 },
  elapsedText: { marginLeft: 'auto', fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  trackingStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackingStat: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  trackingDivider: { width: 1, height: 28, backgroundColor: colors.border },
  trackingVal: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  trackingLabel: { fontSize: 10, color: colors.textMuted },
  trackingNetwork: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  stopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.danger, borderRadius: 12, paddingVertical: 12 },
  stopLabel: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  bundleCard: {},
  bundleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bundleInfo: { flex: 1, gap: 8 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statVal: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, gap: 4 },
  bigStat: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  costStat: { fontSize: 12, color: colors.textMuted },
  avgCard: {},
  avgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  avgRight: { alignItems: 'flex-end' },
  avgVal: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  miniChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barLabel: { fontSize: 8, color: colors.textMuted, textAlign: 'center' },
  bar: { width: '60%', borderRadius: 4 },
  barDay: { fontSize: 9, color: colors.textMuted },
  alertsSection: { gap: 10 },
  alertCard: { gap: 0 },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertTitle: { fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 70, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8 },
  tipCard: { borderColor: colors.warning + '44', borderWidth: 1 },
  gdCard: {},
  gdCardEmpty: { borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border },
  gdRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gdLogoSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: GD_GREEN + '22', alignItems: 'center', justifyContent: 'center' },
  gdLogoText: { fontSize: 14, fontWeight: '900', color: GD_GREEN },
  gdLogoText2: { fontSize: 22, fontWeight: '900', color: GD_GREEN },
  gdBalance: { fontSize: 18, fontWeight: '800', color: GD_GREEN },
  gdNgn: { fontSize: 11, color: colors.textMuted },
  gdActions: { alignItems: 'flex-end' },
  gdBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: GD_GREEN + '55' },
});
