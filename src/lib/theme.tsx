import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, ThemeColors } from '../components/ui/colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  isDark: false,
  colors: lightTheme,
  setMode: () => {},
});

const THEME_STORAGE_KEY = 'burnrate_theme_mode';

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    const SecureStore = require('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadTheme() {
      try {
        const savedMode = await storage.getItem(THEME_STORAGE_KEY);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setModeState(savedMode as ThemeMode);
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      } finally {
        setIsReady(true);
      }
    }
    loadTheme();
  }, []);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await storage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  };

  const isDark = mode === 'system' ? systemColorScheme === 'dark' : mode === 'dark';
  const colors = isDark ? darkTheme : lightTheme;

  if (!isReady) return null; // Or a splash screen

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
