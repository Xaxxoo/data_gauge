import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGBalance,
  isWhitelisted,
  getClaimable,
  getContractCredits,
  getGPriceUSD,
  getUSDToNGN,
  gToNGN,
  ngnToG,
  watchIncomingG,
  depositCreditsOnChain,
  spendCreditsOnChain,
  withdrawCreditsOnChain,
  directSpendOnChain,
  claimUBIOnChain,
  CONTRACT_CONFIGURED,
} from '../lib/gooddollar';

const WALLET_KEY = 'gd_wallet_address';
const PRICE_TTL  = 5 * 60 * 1000; // 5 min cache

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
  walletAddress:   string | null;
  balance:         number;   // G$ in wallet
  contractCredits: number;   // G$ deposited in DataGaugeCredits contract
  claimable:       number;   // G$ claimable today from UBI
  verified:        boolean;  // whitelisted on GoodDollar identity
  priceUSD:        number;   // G$ in USD
  usdToNGN:        number;   // USD/NGN rate
  loading:         boolean;
  refreshing:      boolean;
  lastUpdated:     Date | null;
}

export function useGoodDollar() {
  const [state, setState] = useState<GoodDollarState>({
    walletAddress:   null,
    balance:         0,
    contractCredits: 0,
    claimable:       0,
    verified:        false,
    priceUSD:        0.0012,
    usdToNGN:        1600,
    loading:         true,
    refreshing:      false,
    lastUpdated:     null,
  });

  const priceCache = useRef<{ priceUSD: number; usdToNGN: number; ts: number } | null>(null);

  // ── Price fetch with cache ───────────────────────────────
  async function fetchPrices() {
    const now = Date.now();
    if (priceCache.current && now - priceCache.current.ts < PRICE_TTL) {
      return { priceUSD: priceCache.current.priceUSD, usdToNGN: priceCache.current.usdToNGN };
    }
    const [priceUSD, usdToNGN] = await Promise.all([getGPriceUSD(), getUSDToNGN()]);
    priceCache.current = { priceUSD, usdToNGN, ts: now };
    return { priceUSD, usdToNGN };
  }

  // ── Refresh all on-chain data ────────────────────────────
  const refresh = useCallback(async (silent = false) => {
    const addr = await storage.getItem(WALLET_KEY);
    if (!silent) setState((s) => ({ ...s, refreshing: true }));

    const { priceUSD, usdToNGN } = await fetchPrices();

    if (!addr) {
      setState((s) => ({
        ...s,
        walletAddress:   null,
        contractCredits: 0,
        loading:         false,
        refreshing:      false,
        priceUSD,
        usdToNGN,
      }));
      return;
    }

    const [balance, verified, claimable, contractCredits] = await Promise.all([
      getGBalance(addr),
      isWhitelisted(addr),
      getClaimable(addr),
      getContractCredits(addr),
    ]);

    setState({
      walletAddress: addr,
      balance,
      contractCredits,
      claimable,
      verified,
      priceUSD,
      usdToNGN,
      loading:     false,
      refreshing:  false,
      lastUpdated: new Date(),
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Set / clear wallet ───────────────────────────────────
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
      walletAddress:   null,
      balance:         0,
      contractCredits: 0,
      claimable:       0,
      verified:        false,
    }));
  }, []);

  // ── Contract actions ─────────────────────────────────────

  /** Approve + deposit G$ into the DataGaugeCredits contract */
  const depositCredits = useCallback(async (gdAmount: number) => {
    const result = await depositCreditsOnChain(gdAmount);
    // Refresh after confirmed
    await refresh(true);
    return result;
  }, [refresh]);

  /**
   * Spend G$ credits from the contract to pay for a data bundle.
   * Call this BEFORE calling VTPass — the on-chain tx is the payment proof.
   */
  const spendCredits = useCallback(
    async (gdAmount: number, planId: string, phone: string) => {
      const result = await spendCreditsOnChain(gdAmount, planId, phone);
      await refresh(true);
      return result;
    },
    [refresh]
  );

  /** Withdraw unspent G$ credits back to wallet */
  const withdrawCredits = useCallback(async (gdAmount: number) => {
    const result = await withdrawCreditsOnChain(gdAmount);
    await refresh(true);
    return result;
  }, [refresh]);

  /**
   * Pay for data directly from wallet G$ — no pre-deposit needed.
   * Approve (if needed) + directSpend in two wallet confirmations.
   */
  const directSpend = useCallback(
    async (gdAmount: number, planId: string, phone: string) => {
      const result = await directSpendOnChain(gdAmount, planId, phone);
      await refresh(true);
      return result;
    },
    [refresh]
  );

  /**
   * Claim daily UBI G$ in-app via injected Web3 wallet.
   * Throws if no wallet is connected or the user has nothing to claim.
   */
  const claimUBI = useCallback(async () => {
    const result = await claimUBIOnChain();
    await refresh(true);
    return result;
  }, [refresh]);

  // ── Watch for incoming G$ (legacy manual-send flow) ──────
  const watchForPayment = useCallback(
    (platformAddress: string, onReceive: (from: string, amount: number) => void) => {
      return watchIncomingG(platformAddress, onReceive);
    },
    []
  );

  // ── Derived helpers ──────────────────────────────────────
  const balanceNGN = gToNGN(state.balance, state.priceUSD, state.usdToNGN);
  const contractCreditsNGN = gToNGN(state.contractCredits, state.priceUSD, state.usdToNGN);
  const toNGN = (g: number) => gToNGN(g, state.priceUSD, state.usdToNGN);
  const toG   = (ngn: number) => ngnToG(ngn, state.priceUSD, state.usdToNGN);

  return {
    ...state,
    balanceNGN,
    contractCreditsNGN,
    contractConfigured: CONTRACT_CONFIGURED,
    toNGN,
    toG,
    refresh:         () => refresh(false),
    setWallet,
    clearWallet,
    depositCredits,
    spendCredits,
    withdrawCredits,
    directSpend,
    claimUBI,
    watchForPayment,
  };
}
