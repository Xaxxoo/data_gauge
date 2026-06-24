import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { Text } from './ui/Text';
import { C } from './ui/colors';

interface Props {
  value: number;   // Mbps
  max?: number;    // max Mbps on gauge
  label: string;  // "Download" | "Upload"
  color: string;
  size?: number;
}

export function SpeedGauge({ value, max = 100, label, color, size = 160 }: Props) {
  const cx = size / 2;
  const cy = size * 0.65;
  const r = size * 0.38;
  const strokeWidth = 10;

  const startAngle = Math.PI;
  const endAngle = 0;

  const pct = Math.min(1, value / max);
  const currentAngle = startAngle - pct * Math.PI;

  function polarToCartesian(angle: number) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),
    };
  }

  const trackStart = polarToCartesian(startAngle);
  const trackEnd = polarToCartesian(endAngle);
  const progEnd = polarToCartesian(currentAngle);

  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}`;
  const progPath = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 ${pct > 0.5 ? 0 : 0} 1 ${progEnd.x} ${progEnd.y}`;

  const speedColor =
    value === 0 ? C.textMuted
    : value < 1 ? C.danger
    : value < 5 ? C.warning
    : color;

  return (
    <View style={[styles.container, { width: size }]}>
      <Svg width={size} height={size * 0.75}>
        <Path
          d={trackPath}
          stroke={C.border}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {value > 0 && (
          <Path
            d={progPath}
            stroke={speedColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        )}
        <Circle
          cx={progEnd.x}
          cy={progEnd.y}
          r={6}
          fill={value > 0 ? speedColor : C.textMuted}
        />
        <SvgText
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill={speedColor}
          fontSize={20}
          fontWeight="800"
        >
          {value > 0 ? value.toFixed(1) : '—'}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fill={C.textMuted}
          fontSize={10}
        >
          Mbps
        </SvgText>
        <SvgText x={trackStart.x - 2} y={cy + 18} fill={C.textMuted} fontSize={9}>
          0
        </SvgText>
        <SvgText x={trackEnd.x - 12} y={cy + 18} fill={C.textMuted} fontSize={9}>
          {max}
        </SvgText>
      </Svg>
      <Text variant="caption" style={{ textAlign: 'center', color: speedColor }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});
