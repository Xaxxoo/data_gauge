import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './ui/Text';
import { C } from './ui/colors';

interface Props {
  usedMB: number;
  totalMB: number;
  size?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function DataRing({
  usedMB,
  totalMB,
  size = 160,
  color = C.accent,
  trackColor = C.border,
  label,
  sublabel,
}: Props) {
  const percent = totalMB > 0 ? Math.min(100, (usedMB / totalMB) * 100) : 0;
  const strokeWidth = 12;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - percent / 100);

  const ringColor =
    percent >= 90 ? C.danger : percent >= 70 ? C.warning : color;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        {label ? (
          <Text style={[styles.pct, { color: ringColor }]}>{label}</Text>
        ) : (
          <Text style={[styles.pct, { color: ringColor }]}>{percent.toFixed(0)}%</Text>
        )}
        {sublabel && (
          <Text style={styles.sub} numberOfLines={2}>
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  pct: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    fontSize: 10,
    color: C.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
});
