import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui/Text';
import { useTheme } from '../lib/theme';

interface Props {
  title: string;
  backLabel?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, right }: Props) {
  const router = useRouter();

  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back-outline" size={18} color={colors.accent} />
      </TouchableOpacity>
      <Text variant="h2" style={styles.title}>{title}</Text>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginRight: -60,
  },
  spacer: {
    width: 48,
  },
});
