import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGBalance,
  isWhitelisted,
  getClaimable,
  getGPriceUSD,
  getUSDToNGN,
  gToNGN,
  ngnToG,
  watchIncomingG,
} from '../lib/gooddollar';

const WALLET_KEY = 'gd_wallet_address';
const PRICE_TTL = 5 * 60 * 1000; // 5 min cache

// SecureStore doesn't work on web — fall back to AsyncStorage
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
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
    const SecureStore = require('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  },
};

export interface GoodDollarState {
  walletAddress: string | null;
  balance: number;        // G$
  claimable: number;      // G$ available to claim today
  verified: boolean;      // whitelisted on GoodDollar identity
  priceUSD: number;       // G$ in USD
  usdToNGN: number;       // USD/NGN rate
  loading: boolean;
  refreshing: boolean;
  lastUpdated: Date | null;
}

export function useGoodDollar() {
  const [state, setState] = useState<GoodDollarState>({
    walletAddress: null,
    balance: 0,
    claimable: 0,
    verified: false,
    priceUSD: 0.0012,
    usdToNGN: 1600,
    loading: true,
    refreshing: false,
    lastUpdated: null,
  });

  const priceCache = useRef<{ priceUSD: number; usdToNGN: number; ts: number } | null>(null);

  // ── Price fetch with cache ─────────────────────────────
  async function fetchPrices() {
    const now = Date.now();
    if (priceCache.current && now - priceCache.current.ts < PRICE_TTL) {
      return { priceUSD: priceCache.current.priceUSD, usdToNGN: priceCache.current.usdToNGN };
    }
    const [priceUSD, usdToNGN] = await Promise.all([getGPriceUSD(), getUSDToNGN()]);
    priceCache.current = { priceUSD, usdToNGN, ts: now };
    return { priceUSD, usdToNGN };
  }

  // ── Refresh on-chain data ──────────────────────────────
  const refresh = useCallback(async (silent = false) => {
    const addr = await storage.getItem(WALLET_KEY);
    if (!silent) setState((s) => ({ ...s, refreshing: true }));

    const { priceUSD, usdToNGN } = await fetchPrices();

    if (!addr) {
      setState((s) => ({
        ...s,
        walletAddress: null,
        loading: false,
        refreshing: false,
        priceUSD,
        usdToNGN,
      }));
      return;
    }

    const [balance, verified, claimable] = await Promise.all([
      getGBalance(addr),
      isWhitelisted(addr),
      getClaimable(addr),
    ]);

    setState({
      walletAddress: addr,
      balance,
      claimable,
      verified,
      priceUSD,
      usdToNGN,
      loading: false,
      refreshing: false,
      lastUpdated: new Date(),
    });
  }, []);

  // ── Load on mount ──────────────────────────────────────
  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Set wallet address ─────────────────────────────────
  const setWallet = useCallback(async (address: string) => {
    const cleaned = address.trim().toLowerCase();
    if (!cleaned.startsWith('0x') || cleaned.length !== 42) {
      throw new Error('Invalid Celo address — must start with 0x and be 42 characters');
    }
    await storage.setItem(WALLET_KEY, cleaned);
    await refresh();
  }, [refresh]);

  const clearWallet = useCallback(async () => {
    await storage.deleteItem(WALLET_KEY);
    setState((s) => ({
      ...s,
      walletAddress: null,
      balance: 0,
      claimable: 0,
      verified: false,
    }));
  }, []);

  // ── Watch for incoming G$ payment to platform wallet ──
  const watchForPayment = useCallback(
    (platformAddress: string, onReceive: (from: string, amount: number) => void) => {
      return watchIncomingG(platformAddress, onReceive);
    },
    []
  );

  // ── Derived helpers ────────────────────────────────────
  const balanceNGN = gToNGN(state.balance, state.priceUSD, state.usdToNGN);
  const toNGN = (g: number) => gToNGN(g, state.priceUSD, state.usdToNGN);
  const toG = (ngn: number) => ngnToG(ngn, state.priceUSD, state.usdToNGN);

  return {
    ...state,
    balanceNGN,
    toNGN,
    toG,
    refresh: () => refresh(false),
    setWallet,
    clearWallet,
    watchForPayment,
  };
}
