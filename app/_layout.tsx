import React from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBackgroundTracker } from '../src/hooks/useBackgroundTracker';
import { ThemeProvider, useTheme } from '../src/lib/theme';

const GD_GREEN = '#10B981';

function RootLayoutNav() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width > 480;
  const { colors, isDark } = useTheme();

  // Initialize background tracking
  useBackgroundTracker();

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: isWideWeb ? 'center' : undefined,
      }}
    >
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />
        <GestureHandlerRootView
          style={{
            flex: 1,
            width: '100%',
            maxWidth: isWideWeb ? 430 : undefined,
            ...(isWideWeb
              ? {
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderColor: colors.border,
                }
              : {}),
          }}
        >
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopWidth: 0,
                elevation: 0,
                shadowOpacity: 0,
                height: Platform.OS === 'web' ? 64 : 84,
                paddingBottom: Platform.OS === 'web' ? 8 : 28,
                paddingTop: 8,
              },
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: colors.textMuted,
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
                marginTop: 2,
              },
              tabBarIconStyle: {
                marginBottom: -2,
              },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: 'Home',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="home-outline" size={(size ?? 22) - 2} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="earn"
              options={{
                title: 'Earn G$',
                tabBarActiveTintColor: GD_GREEN,
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="wallet-outline" size={(size ?? 22) - 2} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="history"
              options={{
                title: 'History',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="bar-chart-outline" size={(size ?? 22) - 2} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                title: 'Settings',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="settings-outline" size={(size ?? 22) - 2} color={color} />
                ),
              }}
            />

            {/* Hidden screens — accessible via navigation but not in tab bar */}
            <Tabs.Screen name="bundles" options={{ href: null }} />
            <Tabs.Screen name="buy-data" options={{ href: null }} />
            <Tabs.Screen name="audit" options={{ href: null }} />
            <Tabs.Screen name="speed-test" options={{ href: null }} />
            <Tabs.Screen name="ussd-check" options={{ href: null }} />
            <Tabs.Screen name="tips" options={{ href: null }} /> 
          </Tabs>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}
