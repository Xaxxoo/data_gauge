export interface ThemeColors {
  bg: string;
  surface: string;
  card: string;
  border: string;
  accent: string;
  accentDim: string;
  warning: string;
  danger: string;
  success: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  mtn: string;
  airtel: string;
  glo: string;
  '9mobile': string;
}

export const lightTheme: ThemeColors = {
  bg: '#F9FAFB', // Off-white
  surface: '#FFFFFF', // Pure white
  card: '#FFFFFF',
  border: '#F3F4F6',
  accent: '#000000', // Pitch black
  accentDim: '#0000000A',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  textPrimary: '#111827', // Almost black
  textSecondary: '#6B7280', // Medium grey
  textMuted: '#9CA3AF', // Light grey
  mtn: '#FFCC00',
  airtel: '#E40000',
  glo: '#009640',
  '9mobile': '#00B050',
};

export const darkTheme: ThemeColors = {
  bg: '#000000', // Pitch black
  surface: '#1A1A1A', // Dark grey for surfaces
  card: '#121212', // Slightly lighter than black for cards
  border: '#27272A', // Subtle dark border
  accent: '#FFFFFF', // Pure white for high contrast
  accentDim: '#FFFFFF1A', // Dim white
  warning: '#FBBF24',
  danger: '#F87171',
  success: '#34D399',
  textPrimary: '#F9FAFB', // Almost white
  textSecondary: '#9CA3AF', // Medium grey
  textMuted: '#4B5563', // Darker grey
  mtn: '#FFCC00',
  airtel: '#E40000',
  glo: '#009640',
  '9mobile': '#00B050',
};

export const CARRIER_COLORS: Record<string, string> = {
  mtn: lightTheme.mtn,
  airtel: lightTheme.airtel,
  glo: lightTheme.glo,
  '9mobile': lightTheme['9mobile'],
  other: lightTheme.textSecondary, // We will use context for this in UI, but keep static mapping for raw values
};

// Legacy C export temporarily so we don't break the app while refactoring
export const C = lightTheme;
