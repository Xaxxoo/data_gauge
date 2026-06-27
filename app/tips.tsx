import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
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

interface Tip {
  id: string;
  title: string;
  body: string;
  saving: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: 'streaming' | 'apps' | 'system' | 'bundles' | 'browsing';
}

const CATEGORY_LABELS: Record<Tip['category'], string> = {
  streaming: 'Streaming',
  apps: 'Apps',
  system: 'System',
  bundles: 'Bundles',
  browsing: 'Browsing',
};

const CATEGORY_COLORS: Record<Tip['category'], string> = {
  streaming: '#E40000',
  apps: '#FFCC00',
  system: '#6B7280',
  bundles: '#10B981',
  browsing: '#3B82F6',
};

const TIPS: Tip[] = [
  {
    id: '1',
    title: 'Lower YouTube video quality',
    body: 'YouTube defaults to high quality. Go to Settings → Quality and select 360p or 480p. You\'ll barely notice the difference on a phone screen.',
    saving: 'Up to 75% less data',
    icon: 'videocam-outline',
    category: 'streaming',
  },
  {
    id: '2',
    title: 'Turn off autoplay on social media',
    body: 'Facebook, Instagram, and TikTok auto-play videos as you scroll. Disable this in each app\'s settings under "Video & Audio" or "Data Usage".',
    saving: '200–500MB/day',
    icon: 'pause-circle-outline',
    category: 'apps',
  },
  {
    id: '3',
    title: 'Use WhatsApp\'s data saving mode',
    body: 'In WhatsApp, go to Settings → Storage & Data → Media auto-download. Set all categories to "Wi-Fi only" so photos and videos only download on WiFi.',
    saving: '100–300MB/day',
    icon: 'chatbubble-ellipses-outline',
    category: 'apps',
  },
  {
    id: '4',
    title: 'Buy larger bundles for better value',
    body: 'A 1GB bundle at ₦300 costs ₦0.29/MB. A 10GB bundle at ₦2,000 costs ₦0.19/MB — 34% cheaper per MB. If you use more than 3GB/month, bigger bundles save real money.',
    saving: '20–40% cost reduction',
    icon: 'trending-down-outline',
    category: 'bundles',
  },
  {
    id: '5',
    title: 'Enable Chrome Lite mode (Data Saver)',
    body: 'In Chrome, go to Settings → Lite mode. Google compresses pages before sending them to your phone, significantly reducing page sizes.',
    saving: 'Up to 60% on browsing',
    icon: 'globe-outline',
    category: 'browsing',
  },
  {
    id: '6',
    title: 'Download music and podcasts on WiFi',
    body: 'Streaming music uses 1–3MB per minute. Downloading a playlist on WiFi and listening offline costs zero mobile data. Spotify, Boomplay, and Audiomack all support offline mode.',
    saving: '50–150MB per hour',
    icon: 'musical-notes-outline',
    category: 'streaming',
  },
  {
    id: '7',
    title: 'Disable background app refresh',
    body: 'Apps silently use data in the background to sync content. On Android, go to Settings → Apps → [App] → Mobile Data and disable "Background data" for apps you don\'t need to sync constantly.',
    saving: '50–200MB/day',
    icon: 'refresh-outline',
    category: 'system',
  },
  {
    id: '8',
    title: 'Update apps only on WiFi',
    body: 'App updates can be 50–500MB each. In Play Store settings, change "Auto-update apps" to "Over Wi-Fi only". Do the same for system updates.',
    saving: '500MB–2GB per update cycle',
    icon: 'cloud-download-outline',
    category: 'system',
  },
  {
    id: '9',
    title: 'Use Opera Mini or UC Browser',
    body: 'These browsers compress web content on their servers before delivering it to your device. Effective for news sites and social feeds that load many images.',
    saving: '40–70% on browsing',
    icon: 'browsers-outline',
    category: 'browsing',
  },
  {
    id: '10',
    title: 'Check your bundle before it expires',
    body: 'Many bundles expire in 7–30 days regardless of remaining data. Use the USSD check or your carrier app to see your expiry date. Roll over unused data by buying a new bundle before the old one expires (carrier-dependent).',
    saving: 'Prevent wasted data',
    icon: 'calendar-outline',
    category: 'bundles',
  },
  {
    id: '11',
    title: 'Disable GPS and sync when not needed',
    body: 'Location-based apps and background sync (Gmail, Calendar, Drive) use data regularly. Toggle off Mobile Data for specific apps you don\'t need syncing in real time.',
    saving: '20–100MB/day',
    icon: 'location-outline',
    category: 'system',
  },
  {
    id: '12',
    title: 'Use the Google Go or Facebook Lite apps',
    body: 'The "Lite" versions of major apps are designed specifically for low-bandwidth markets and use a fraction of the data of their full counterparts.',
    saving: '50–80% vs full apps',
    icon: 'phone-portrait-outline',
    category: 'apps',
  },
];

const ALL_CATEGORIES = ['all', 'streaming', 'apps', 'system', 'bundles', 'browsing'] as const;
type FilterCategory = typeof ALL_CATEGORIES[number];

export default function TipsScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = activeFilter === 'all'
    ? TIPS
    : TIPS.filter((t) => t.category === activeFilter);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Data Saving Tips" />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Summary */}
        <Card>
          <View style={styles.summaryRow}>
            <Ionicons name="bulb-outline" size={20} color={colors.warning} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text variant="h3">Save More, Spend Less</Text>
              <Text variant="body" style={{ marginTop: 2 }}>
                {TIPS.length} tips to stretch your data bundle further.
              </Text>
            </View>
          </View>
        </Card>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {ALL_CATEGORIES.map((cat) => {
            const isActive = activeFilter === cat;
            const label = cat === 'all' ? 'All' : CATEGORY_LABELS[cat];
            const color = cat === 'all' ? colors.accent : CATEGORY_COLORS[cat];
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveFilter(cat)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? color : colors.surface,
                    borderColor: isActive ? color : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    { color: isActive ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tips list */}
        {filtered.map((tip) => {
          const isOpen = expanded.has(tip.id);
          const catColor = CATEGORY_COLORS[tip.category];
          return (
            <TouchableOpacity key={tip.id} onPress={() => toggle(tip.id)} activeOpacity={0.85}>
              <Card>
                <View style={styles.tipHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: catColor + '1A' }]}>
                    <Ionicons name={tip.icon} size={18} color={catColor} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text variant="h3" style={{ flexShrink: 1 }}>{tip.title}</Text>
                    <Badge
                      label={CATEGORY_LABELS[tip.category]}
                      color={catColor}
                      size="sm"
                      style={{ alignSelf: 'flex-start', marginTop: 4 }}
                    />
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={16}
                    color={colors.textMuted}
                    style={{ marginLeft: 8 }}
                  />
                </View>

                {isOpen && (
                  <View style={styles.tipBody}>
                    <View style={styles.divider} />
                    <Text variant="body" style={{ lineHeight: 22 }}>{tip.body}</Text>
                    <View style={styles.savingRow}>
                      <Ionicons name="flash-outline" size={13} color={colors.success} />
                      <Text style={[styles.savingText, { color: colors.success }]}>
                        {tip.saving}
                      </Text>
                    </View>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterLabel: { fontSize: 13, fontWeight: '600' },
  tipHeader: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipBody: { marginTop: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  savingText: { fontSize: 12, fontWeight: '700' },
});
