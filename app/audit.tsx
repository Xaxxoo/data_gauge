import { CARRIER_COLORS } from '../src/components/ui/colors';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
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
import {
  getAuditEntries,
  saveAuditEntry,
  deleteAuditEntry,
  getSettings,
  generateId,
  todayISO,
} from '../src/lib/storage';
import { formatNaira, formatBytes } from '../src/lib/dataCalc';
import type { AuditEntry, CarrierId } from '../src/types';
import { CARRIERS, getCarrier } from '../src/lib/carriers';
import { GDBalancePill } from '../src/components/GDBalancePill';

export default function AuditScreen() {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [defaultCarrier, setDefaultCarrier] = useState<CarrierId>('mtn');
  const [form, setForm] = useState({
    yourTrackedMB: '',
    carrierClaimedMB: '',
    carrierId: 'mtn' as CarrierId,
    note: '',
    date: todayISO(),
  });

  const load = useCallback(async () => {
    try {
      const [e, s] = await Promise.all([getAuditEntries(), getSettings()]);
      setEntries(e);
      setDefaultCarrier(s.selectedCarrierId as CarrierId);
      setForm((f) => ({ ...f, carrierId: s.selectedCarrierId as CarrierId }));
    } catch (err) {
      console.error('[AuditScreen] Failed to load data:', err);
      Alert.alert('Error', 'Could not load audit data. Please try again.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalDiscrepancyMB = entries.reduce((s, e) => s + e.discrepancyMB, 0);
  const totalDiscrepancyNaira = entries.reduce((s, e) => s + e.discrepancyNaira, 0);
  const theftEntries = entries.filter((e) => e.discrepancyMB > 0);

  async function addEntry() {
    const yours = parseFloat(form.yourTrackedMB);
    const theirs = parseFloat(form.carrierClaimedMB);

    if (isNaN(yours) || isNaN(theirs)) {
      Alert.alert('Error', 'Please fill in both data amounts');
      return;
    }

    const carrier = getCarrier(form.carrierId);
    const s = await getSettings();
    const nairaPerMB = s.customNairaPerMB ?? carrier.plans[0]?.nairaPerMB ?? 0.293;
    const discrepancyMB = theirs - yours;
    const discrepancyNaira = Math.max(0, discrepancyMB) * nairaPerMB;

    const entry: AuditEntry = {
      id: generateId(),
      date: form.date,
      yourTrackedMB: yours,
      carrierClaimedMB: theirs,
      discrepancyMB,
      discrepancyNaira,
      carrierId: form.carrierId,
      note: form.note,
    };

    await saveAuditEntry(entry);
    setShowAdd(false);
    setForm({ yourTrackedMB: '', carrierClaimedMB: '', carrierId: defaultCarrier, note: '', date: todayISO() });
    load();
  }

  async function remove(id: string) {
    Alert.alert('Delete Entry', 'Remove this audit entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAuditEntry(id); load(); } },
    ]);
  }

  function discrepancyColor(mb: number): string {
    if (mb <= 0) return colors.success;
    if (mb < 10) return colors.warning;
    return colors.danger;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Data Audit" right={<GDBalancePill />} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View>
            <Text variant="h1">Data Audit</Text>
            <Text variant="body">Catch your carrier stealing data</Text>
          </View>
          <Button label="+ Log" size="sm" onPress={() => setShowAdd(true)} />
        </View>

        {/* Summary cards */}
        {entries.length > 0 && (
          <View style={styles.summaryGrid}>
            <Card glow={totalDiscrepancyMB > 0 ? colors.danger : colors.success} style={styles.summaryCard}>
              <Text variant="caption">Total Overcharged</Text>
              <Text style={[styles.summaryVal, { color: totalDiscrepancyMB > 0 ? colors.danger : colors.success }]}>
                {formatBytes(Math.max(0, totalDiscrepancyMB) * 1024 * 1024)}
              </Text>
              <Text style={styles.summarySub}>across {entries.length} entries</Text>
            </Card>
            <Card glow={totalDiscrepancyNaira > 0 ? colors.danger : colors.success} style={styles.summaryCard}>
              <Text variant="caption">Money Lost to Carrier</Text>
              <Text style={[styles.summaryVal, { color: totalDiscrepancyNaira > 0 ? colors.danger : colors.success }]}>
                {formatNaira(Math.max(0, totalDiscrepancyNaira))}
              </Text>
              <Text style={styles.summarySub}>{theftEntries.length} suspicious entries</Text>
            </Card>
          </View>
        )}

        {/* How to use */}
        <Card style={styles.howto}>
          <Text variant="caption" color={colors.accent}>How to Catch MTN/Airtel Overcharging</Text>
          <View style={styles.step}><Text style={styles.stepNum}>1</Text><Text variant="body" style={{ flex: 1 }}>Note your data balance <Text style={{ color: colors.accent, fontWeight: '700' }}>before</Text> an activity (e.g. "before watching a 10min YouTube video")</Text></View>
          <View style={styles.step}><Text style={styles.stepNum}>2</Text><Text variant="body" style={{ flex: 1 }}>Note your data balance <Text style={{ color: colors.warning, fontWeight: '700' }}>after</Text> the activity</Text></View>
          <View style={styles.step}><Text style={styles.stepNum}>3</Text><Text variant="body" style={{ flex: 1 }}>Calculate what the activity <Text style={{ color: colors.accent }}>should</Text> have cost (use the calculator below)</Text></View>
          <View style={styles.step}><Text style={styles.stepNum}>4</Text><Text variant="body" style={{ flex: 1 }}>Log both numbers here. A positive discrepancy = carrier overcharged you</Text></View>
        </Card>

        {/* Data cost reference */}
        <Card>
          <Text variant="h3" style={{ marginBottom: 10 }}>Expected Data Usage Reference</Text>
          {[
            { activity: '1 min WhatsApp voice call', mb: 0.5 },
            { activity: '1 WhatsApp video call (1 min)', mb: 3 },
            { activity: 'Send 10 WhatsApp images', mb: 5 },
            { activity: 'Browse social media (10 min)', mb: 15 },
            { activity: 'YouTube 480p (1 min)', mb: 5 },
            { activity: 'YouTube 720p (1 min)', mb: 15 },
            { activity: 'Download a typical MP3 song', mb: 5 },
            { activity: 'Download a 5-min voice note', mb: 2 },
            { activity: 'Google Maps navigation (1 hr)', mb: 50 },
          ].map(({ activity, mb }) => (
            <View key={activity} style={styles.refRow}>
              <Text variant="body" style={{ flex: 1 }}>{activity}</Text>
              <Text style={styles.refMB}>~{mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb} MB`}</Text>
            </View>
          ))}
        </Card>

        {/* Audit entries */}
        {entries.length === 0 && (
          <Card style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={40} color={colors.textMuted} />
            <Text variant="h3" style={{ textAlign: 'center' }}>No audit entries yet</Text>
            <Text variant="body" style={{ textAlign: 'center', marginBottom: 8 }}>
              Start tracking carrier behavior. When you notice data disappearing
              faster than it should, log it here.
            </Text>
            <Button label="Log First Entry" onPress={() => setShowAdd(true)} />
          </Card>
        )}

        {entries.map((entry) => {
          const dc = discrepancyColor(entry.discrepancyMB);
          return (
            <Card key={entry.id} glow={entry.discrepancyMB > 0 ? colors.danger : colors.success}>
              <View style={styles.entryHeader}>
                <View>
                  <Text style={styles.entryDate}>{entry.date}</Text>
                  <Badge label={getCarrier(entry.carrierId).name} color={CARRIER_COLORS[entry.carrierId]} size="sm" />
                </View>
                <View style={styles.entryRight}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons
                      name={entry.discrepancyMB > 0 ? 'alert-outline' : 'checkmark-outline'}
                      size={14}
                      color={dc}
                    />
                    <Text style={[styles.discrepancy, { color: dc }]}>
                      {entry.discrepancyMB > 0
                        ? `+${formatBytes(entry.discrepancyMB * 1024 * 1024)} overcharged`
                        : 'No overcharge'}
                    </Text>
                  </View>
                  {entry.discrepancyNaira > 0 && (
                    <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>
                      {formatNaira(entry.discrepancyNaira)} stolen
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.entryRow}>
                <View style={styles.entrySide}>
                  <Text variant="caption">You tracked</Text>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>
                    {formatBytes(entry.yourTrackedMB * 1024 * 1024)}
                  </Text>
                </View>
                <Text style={styles.entryVs}>vs</Text>
                <View style={[styles.entrySide, { alignItems: 'flex-end' }]}>
                  <Text variant="caption">Carrier claimed</Text>
                  <Text style={{ color: entry.discrepancyMB > 0 ? colors.danger : colors.textPrimary, fontWeight: '700' }}>
                    {formatBytes(entry.carrierClaimedMB * 1024 * 1024)}
                  </Text>
                </View>
              </View>

              {entry.note ? (
                <Text variant="body" style={styles.note}>{entry.note}</Text>
              ) : null}

              <TouchableOpacity onPress={() => remove(entry.id)}>
                <Text style={styles.deleteBtn}>Delete</Text>
              </TouchableOpacity>
            </Card>
          );
        })}

        {/* Report to NCC */}
        {totalDiscrepancyNaira > 100 && (
          <Card style={styles.nccCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="flag-outline" size={14} color={colors.warning} />
              <Text variant="caption" color={colors.warning}>Report to NCC (Nigeria Communications Commission)</Text>
            </View>
            <Text variant="body" style={{ marginTop: 6 }}>
              You've logged {formatNaira(totalDiscrepancyNaira)} in potential data theft. You can file a complaint:
            </Text>
            <View style={{ gap: 4, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="call-outline" size={13} color={colors.accent} />
                <Text style={styles.nccLink}>NCC Consumer Portal: ncc.gov.ng</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="mail-outline" size={13} color={colors.accent} />
                <Text style={styles.nccLink}>consumeraffairs@ncc.gov.ng</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="chatbubble-outline" size={13} color={colors.accent} />
                <Text style={styles.nccLink}>SMS complaints: 622</Text>
              </View>
            </View>
          </Card>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add Entry Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <ScrollView style={styles.modalSheet}>
            <Text variant="h2" style={{ marginBottom: 4 }}>Log Audit Entry</Text>
            <Text variant="body" style={{ marginBottom: 16 }}>
              Compare what you used vs what your carrier deducted
            </Text>

            <Text variant="caption" style={{ marginBottom: 6 }}>Carrier</Text>
            <View style={styles.carrierPicker}>
              {CARRIERS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.carrierChip, form.carrierId === c.id && { backgroundColor: CARRIER_COLORS[c.id] + '18', borderColor: CARRIER_COLORS[c.id] }]}
                  onPress={() => setForm((f) => ({ ...f, carrierId: c.id as CarrierId }))}
                >
                  <Text style={{ color: form.carrierId === c.id ? CARRIER_COLORS[c.id] : colors.textMuted, fontWeight: '700', fontSize: 11 }}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text variant="caption" style={{ marginBottom: 4, marginTop: 12 }}>Data YOU actually used (MB)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 30"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={form.yourTrackedMB}
              onChangeText={(t) => setForm((f) => ({ ...f, yourTrackedMB: t }))}
            />

            <Text variant="caption" style={{ marginBottom: 4, marginTop: 8 }}>Data carrier DEDUCTED from your balance (MB)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 45"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={form.carrierClaimedMB}
              onChangeText={(t) => setForm((f) => ({ ...f, carrierClaimedMB: t }))}
            />

            <Text variant="caption" style={{ marginBottom: 4, marginTop: 8 }}>What were you doing? (optional)</Text>
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
              placeholder="e.g. Watched a 10 min YouTube video on 4G"
              placeholderTextColor={colors.textMuted}
              multiline
              value={form.note}
              onChangeText={(t) => setForm((f) => ({ ...f, note: t }))}
            />

            <View style={styles.modalActions}>
              <Button label="Cancel" variant="ghost" onPress={() => setShowAdd(false)} />
              <Button label="Save Entry" onPress={addEntry} />
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryGrid: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, gap: 4 },
  summaryVal: { fontSize: 20, fontWeight: '800' },
  summarySub: { fontSize: 10, color: colors.textMuted },
  howto: { gap: 10 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, textAlign: 'center', lineHeight: 22, color: '#FFF', fontWeight: '800', fontSize: 12 },
  refRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  refMB: { fontSize: 12, fontWeight: '700', color: colors.accent },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  entryDate: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  entryRight: { alignItems: 'flex-end', gap: 2 },
  discrepancy: { fontSize: 12, fontWeight: '700' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  entrySide: { flex: 1, gap: 2 },
  entryVs: { color: colors.textMuted, fontWeight: '700' },
  note: { fontStyle: 'italic', marginBottom: 8 },
  deleteBtn: { color: colors.danger, fontSize: 12, textAlign: 'right' },
  nccCard: { borderColor: colors.warning + '55', borderWidth: 1 },
  nccLink: { color: colors.accent, fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  carrierPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  carrierChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
});
