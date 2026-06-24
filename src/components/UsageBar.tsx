import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import { useTheme } from '../lib/theme';
import { ThemeColors } from '../components/ui/colors';
import { formatBytes, formatNaira } from '../lib/dataCalc';

interface Props {
  label: string;
  usedMB: number;
  totalMB: number;
  nairaPerMB: number;
  color?: string;
}

export function UsageBar({ label, usedMB, totalMB, nairaPerMB, color }: Props) {
  const { colors, isDark, setMode, mode } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const pct = totalMB > 0 ? Math.min(100, (usedMB / totalMB) * 100) : 0;
  const barColor = pct >= 90 ? colors.danger : pct >= 70 ? colors.warning : (color || colors.accent);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text variant="h3">{label}</Text>
        <Text style={{ color: barColor, fontWeight: '700', fontSize: 13 }}>
          {pct.toFixed(0)}%
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>

      <View style={styles.row}>
        <Text variant="body">
          {formatBytes(usedMB * 1024 * 1024)} used
        </Text>
        <Text variant="body">
          {formatBytes((totalMB - usedMB) * 1024 * 1024)} left
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.cost}>
          {formatNaira(usedMB * nairaPerMB)} spent
        </Text>
        <Text style={styles.cost}>
          {formatNaira((totalMB - usedMB) * nairaPerMB)} remaining value
        </Text>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  cost: { fontSize: 11, color: colors.textMuted },
});
