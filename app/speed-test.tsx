import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/lib/theme';
import { ThemeColors } from '../src/components/ui/colors';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { SpeedGauge } from '../src/components/SpeedGauge';
import { useSpeedTest } from '../src/hooks/useSpeedTest';
import { useNetworkInfo } from '../src/hooks/useNetworkInfo';
import { getSpeedTests } from '../src/lib/storage';
import { GDBalancePill } from '../src/components/GDBalancePill';
import type { SpeedTestResult } from '../src/types';

const PHASE_LABELS: Record<string, string> = {
  ping: 'Measuring Ping',
  download: 'Testing Download',
  upload: 'Testing Upload',
  done: 'Test Complete',
  error: 'Test Failed',
};

type ActivityItem = {
  activity: string;
  mbps: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const ACTIVITIES: ActivityItem[] = [
  { activity: 'WhatsApp message', mbps: 0.01, icon: 'chatbubbles-outline' },
  { activity: 'WhatsApp voice call', mbps: 0.1, icon: 'call-outline' },
  { activity: 'YouTube 480p', mbps: 1.5, icon: 'play-outline' },
  { activity: 'YouTube 720p', mbps: 4, icon: 'videocam-outline' },
  { activity: 'YouTube 1080p', mbps: 8, icon: 'desktop-outline' },
];

export default function SpeedTestScreen() {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const network = useNetworkInfo();
  const { isRunning, progress, result, error, start, reset } = useSpeedTest(network.displayType);
  const [history, setHistory] = useState<SpeedTestResult[]>([]);

  useEffect(() => {
    getSpeedTests(10).then(setHistory);
  }, [result]);

  const downloadMbps = result?.downloadMbps ?? (progress?.phase === 'download' ? progress.currentMbps ?? 0 : 0);
  const uploadMbps = result?.uploadMbps ?? (progress?.phase === 'upload' ? progress.currentMbps ?? 0 : 0);
  const pingMs = result?.pingMs ?? 0;

  function speedQuality(mbps: number): { label: string; color: string } {
    if (mbps >= 25) return { label: 'Excellent', color: colors.success };
    if (mbps >= 10) return { label: 'Good', color: colors.accent };
    if (mbps >= 5) return { label: 'Fair', color: colors.warning };
    if (mbps >= 1) return { label: 'Poor', color: '#F97316' };
    return { label: 'Very Poor', color: colors.danger };
  }

  const dlQuality = speedQuality(downloadMbps);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text variant="h1">Speed Test</Text>
          <GDBalancePill />
        </View>
        <Text variant="body">Measure your real connection speed on {network.displayType}</Text>

        {/* Gauges */}
        <Card glow={isRunning || result ? colors.accent : undefined} style={styles.gaugeCard}>
          <View style={styles.gauges}>
            <SpeedGauge
              value={downloadMbps}
              max={100}
              label="Download"
              color={colors.accent}
              size={150}
            />
            <SpeedGauge
              value={uploadMbps}
              max={50}
              label="Upload"
              color={colors.warning}
              size={150}
            />
          </View>

          {/* Ping */}
          <View style={styles.pingRow}>
            <View style={styles.pingItem}>
              <Text variant="caption">Ping</Text>
              <Text style={styles.pingVal}>{pingMs > 0 ? `${pingMs.toFixed(0)}ms` : '—'}</Text>
            </View>
            <View style={styles.pingItem}>
              <Text variant="caption">Network</Text>
              <Text style={styles.pingVal}>{network.displayType}</Text>
            </View>
            {result && (
              <View style={styles.pingItem}>
                <Text variant="caption">Quality</Text>
                <Text style={[styles.pingVal, { color: dlQuality.color }]}>{dlQuality.label}</Text>
              </View>
            )}
          </View>

          {/* Progress message */}
          {isRunning && progress && (
            <View style={styles.progressBox}>
              <Text variant="caption" color={colors.accent}>
                {PHASE_LABELS[progress.phase] ?? progress.phase}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress.progress}%` }]} />
              </View>
              <Text style={styles.progressMsg}>{progress.message}</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text color={colors.danger}>{error}</Text>
            </View>
          )}
        </Card>

        {/* CTA */}
        {!isRunning ? (
          <Button
            label={result ? 'Run Again' : 'Start Speed Test'}
            size="lg"
            onPress={result ? () => { reset(); start(); } : start}
          />
        ) : (
          <View style={styles.runningHint}>
            <Text variant="body" style={{ textAlign: 'center' }}>
              Stay on this screen — test in progress...
            </Text>
          </View>
        )}

        {/* What these speeds mean */}
        {result && (
          <Card style={styles.contextCard}>
            <Text variant="h3" style={{ marginBottom: 8 }}>What this means for you</Text>
            {ACTIVITIES.map(({ activity, mbps, icon }) => {
              const canDo = result.downloadMbps >= mbps;
              return (
                <View key={activity} style={styles.activityRow}>
                  <Ionicons name={icon} size={16} color={colors.textSecondary} />
                  <Text variant="body" style={{ flex: 1 }}>{activity}</Text>
                  <Badge
                    label={canDo ? 'Yes' : 'No'}
                    color={canDo ? colors.success : colors.danger}
                    size="sm"
                  />
                </View>
              );
            })}
          </Card>
        )}

        {/* History */}
        {history.length > 0 && (
          <Card>
            <Text variant="h3" style={{ marginBottom: 12 }}>Recent Tests</Text>
            {history.slice(0, 5).map((test) => (
              <View key={test.id} style={styles.histRow}>
                <View>
                  <Text style={styles.histTime}>
                    {new Date(test.timestamp).toLocaleDateString('en-NG', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  <Text variant="caption">{test.networkType}</Text>
                </View>
                <View style={styles.histSpeeds}>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>
                    ↓{test.downloadMbps}
                  </Text>
                  <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 12 }}>
                    ↑{test.uploadMbps}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {test.pingMs}ms
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* MTN context note */}
        <Card style={styles.mtnNote}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="alert-outline" size={14} color={colors.warning} />
            <Text variant="caption" color={colors.warning}>MTN Speed Context</Text>
          </View>
          <Text variant="body" style={{ marginTop: 4 }}>
            MTN Nigeria advertises "4G speeds" but typical real-world speeds in Lagos
            range from 2–15 Mbps. If your 4G shows under 1 Mbps, screenshot and
            report to NCC at ncc.gov.ng or @NCCgovNg on X.
          </Text>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  gaugeCard: {},
  gauges: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  pingRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  pingItem: { alignItems: 'center', gap: 2 },
  pingVal: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  progressBox: { marginTop: 16, gap: 6 },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  progressMsg: { fontSize: 12, color: colors.textMuted },
  errorBox: { marginTop: 12, padding: 10, backgroundColor: colors.danger + '18', borderRadius: 8 },
  runningHint: { alignItems: 'center', padding: 16 },
  contextCard: {},
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  histTime: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  histSpeeds: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  mtnNote: { borderColor: colors.warning + '44', borderWidth: 1 },
});
