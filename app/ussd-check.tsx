import { CARRIER_COLORS } from '../src/components/ui/colors';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useTheme } from '../src/lib/theme';
import { ThemeColors } from '../src/components/ui/colors';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { getSettings, getBundles, updateBundleUsage } from '../src/lib/storage';
import { USSD_CODES, dialUssd, saveUssdCheck, getUssdChecks, createUssdCheck } from '../src/lib/ussdBalance';
import { getCarrier } from '../src/lib/carriers';
import { formatBytes } from '../src/lib/dataCalc';
import type { CarrierId, UssdBalanceCheck } from '../src/types';
import { GDBalancePill } from '../src/components/GDBalancePill';

export default function UssdCheckScreen() {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [carrierId, setCarrierId] = useState<CarrierId>('mtn');
  const [balanceInput, setBalanceInput] = useState('');
  const [unit, setUnit] = useState<'MB' | 'GB'>('MB');
  const [history, setHistory] = useState<UssdBalanceCheck[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [settings, checks] = await Promise.all([getSettings(), getUssdChecks()]);
    setCarrierId(settings.selectedCarrierId);
    setHistory(checks);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ussdInfo = USSD_CODES[carrierId];
  const carrier = getCarrier(carrierId);

  const handleDial = async () => {
    await dialUssd(carrierId);
  };

  const handleSaveBalance = async () => {
    const value = parseFloat(balanceInput);
    if (isNaN(value) || value < 0) {
      Alert.alert('Invalid', 'Please enter a valid balance amount.');
      return;
    }

    setSaving(true);
    const balanceMB = unit === 'GB' ? value * 1024 : value;

    try {
      const check = createUssdCheck(carrierId, balanceMB, 'manual');
      await saveUssdCheck(check);

      // Update active bundle's remaining balance
      const settings = await getSettings();
      if (settings.activeBundleId) {
        const bundles = await getBundles();
        const bundle = bundles.find((b) => b.id === settings.activeBundleId);
        if (bundle) {
          // remaining = balanceMB, so usedMB = totalMB - balanceMB
          const newUsedMB = Math.max(0, bundle.totalMB - balanceMB);
          await updateBundleUsage(settings.activeBundleId, newUsedMB);
        }
      }

      setBalanceInput('');
      Alert.alert('Saved', `Balance of ${formatBytes(balanceMB * 1024 * 1024)} recorded and bundle updated.`);
      load();
    } catch (err) {
      Alert.alert('Error', 'Failed to save balance check.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="USSD Balance Check" right={<GDBalancePill />} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Carrier info */}
        <Card glow={CARRIER_COLORS[carrierId]}>
          <View style={styles.carrierRow}>
            <View style={[styles.carrierDot, { backgroundColor: CARRIER_COLORS[carrierId] }]} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">{carrier.name}</Text>
              <Text variant="body">{ussdInfo.label}</Text>
            </View>
            <Badge label={ussdInfo.code || 'N/A'} color={CARRIER_COLORS[carrierId]} size="md" />
          </View>
        </Card>

        {/* Dial button */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 8 }}>Check Your Balance</Text>
          <Text variant="body" style={{ marginBottom: 16 }}>
            {ussdInfo.description}
          </Text>

          {Platform.OS === 'ios' ? (
            <Card style={styles.iosNote}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
                <Text style={{ color: colors.warning, fontWeight: '600', fontSize: 12 }}>iOS Limitation</Text>
              </View>
              <Text variant="body" style={{ marginTop: 4 }}>
                iOS doesn't support automatic USSD dialing. Please open your Phone app and dial{' '}
                <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{ussdInfo.code}</Text>
                {' '}manually.
              </Text>
            </Card>
          ) : (
            <Button
              label={`Dial ${ussdInfo.code}`}
              icon={<Ionicons name="call-outline" size={16} color="#FFF" />}
              onPress={handleDial}
              disabled={!ussdInfo.code}
            />
          )}
        </Card>

        {/* Manual balance entry */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 4 }}>Enter Balance</Text>
          <Text variant="body" style={{ marginBottom: 12 }}>
            Enter the remaining balance shown in the USSD response to update your bundle.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g. 500"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={balanceInput}
              onChangeText={setBalanceInput}
            />
            <View style={styles.unitToggle}>
              {(['MB', 'GB'] as const).map((u) => (
                <Button
                  key={u}
                  label={u}
                  size="sm"
                  variant={unit === u ? 'primary' : 'secondary'}
                  onPress={() => setUnit(u)}
                  style={{ minWidth: 48 }}
                />
              ))}
            </View>
          </View>

          <Button
            label="Save Balance"
            onPress={handleSaveBalance}
            loading={saving}
            disabled={!balanceInput}
            style={{ marginTop: 12 }}
            icon={<Ionicons name="checkmark-outline" size={14} color="#FFF" />}
          />
        </Card>

        {/* History */}
        {history.length > 0 && (
          <Card>
            <Text variant="h3" style={{ marginBottom: 12 }}>Balance Check History</Text>
            {history.slice(0, 10).map((check) => (
              <View key={check.id} style={styles.historyRow}>
                <View style={[styles.historyDot, { backgroundColor: CARRIER_COLORS[check.carrierId] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>
                    {new Date(check.timestamp).toLocaleDateString('en-NG', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text style={styles.historyMethod}>
                    via {check.method === 'ussd' ? 'USSD' : 'manual entry'}
                  </Text>
                </View>
                <Text style={styles.historyBalance}>
                  {formatBytes(check.balanceMB * 1024 * 1024)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' as const },
  carrierRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carrierDot: { width: 14, height: 14, borderRadius: 7 },
  iosNote: { borderColor: colors.warning + '44', borderWidth: 1, backgroundColor: colors.warning + '08' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitToggle: { flexDirection: 'row', gap: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyDate: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  historyMethod: { fontSize: 10, color: colors.textMuted },
  historyBalance: { fontSize: 15, fontWeight: '800', color: colors.accent },
});
