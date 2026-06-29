import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkInfo {
  isConnected: boolean;
  type: string; // 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown'
  cellularGeneration: string | null; // '2g' | '3g' | '4g' | '5g'
  isInternetReachable: boolean;
  displayType: string; // human readable: "WiFi", "4G LTE", "3G", "Offline" etc.
}

function toDisplayType(state: NetInfoState): string {
  if (state.type === 'wifi') return 'WiFi';
  if (state.type === 'cellular') {
    const gen = (state.details as { cellularGeneration?: string })?.cellularGeneration;
    if (gen === '5g') return '5G';
    if (gen === '4g') return '4G LTE';
    if (gen === '3g') return '3G';
    if (gen === '2g') return '2G';
    return 'Cellular';
  }
  if (state.type === 'none') return 'Offline';
  return 'Unknown';
}

// Web-only: read from the Network Information API (navigator.connection)
function readWebInfo(): NetworkInfo {
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

  const conn: any =
    typeof navigator !== 'undefined'
      ? (navigator as any).connection ??
        (navigator as any).mozConnection ??
        (navigator as any).webkitConnection
      : null;

  if (!conn) {
    return {
      isConnected: isOnline,
      type: isOnline ? 'unknown' : 'none',
      cellularGeneration: null,
      isInternetReachable: isOnline,
      displayType: isOnline ? 'Connected' : 'Offline',
    };
  }

  const connType: string = conn.type ?? 'unknown';
  const effectiveType: string = conn.effectiveType ?? '';

  if (!isOnline || connType === 'none') {
    return {
      isConnected: false,
      type: 'none',
      cellularGeneration: null,
      isInternetReachable: false,
      displayType: 'Offline',
    };
  }

  if (connType === 'wifi' || connType === 'ethernet') {
    return {
      isConnected: true,
      type: connType === 'ethernet' ? 'ethernet' : 'wifi',
      cellularGeneration: null,
      isInternetReachable: true,
      displayType: connType === 'ethernet' ? 'Ethernet' : 'WiFi',
    };
  }

  if (connType === 'cellular') {
    const genMap: Record<string, string> = {
      '4g': '4G LTE',
      '3g': '3G',
      '2g': '2G',
      'slow-2g': '2G',
    };
    return {
      isConnected: true,
      type: 'cellular',
      cellularGeneration: effectiveType.replace('slow-', '') || null,
      isInternetReachable: true,
      displayType: genMap[effectiveType] ?? 'Cellular',
    };
  }

  // connType is 'unknown' but we are online — guess from effectiveType
  const fallbackDisplay: Record<string, string> = {
    '4g': '4G',
    '3g': '3G',
    '2g': '2G',
    'slow-2g': '2G',
  };
  return {
    isConnected: true,
    type: 'unknown',
    cellularGeneration: null,
    isInternetReachable: true,
    displayType: fallbackDisplay[effectiveType] ?? 'Connected',
  };
}

export function useNetworkInfo(): NetworkInfo {
  const [info, setInfo] = useState<NetworkInfo>({
    isConnected: false,
    type: 'unknown',
    cellularGeneration: null,
    isInternetReachable: false,
    displayType: 'Detecting...',
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      setInfo(readWebInfo());

      const refresh = () => setInfo(readWebInfo());
      const goOffline = () =>
        setInfo({
          isConnected: false,
          type: 'none',
          cellularGeneration: null,
          isInternetReachable: false,
          displayType: 'Offline',
        });

      window.addEventListener('online', refresh);
      window.addEventListener('offline', goOffline);

      const conn: any = (navigator as any).connection;
      if (conn) conn.addEventListener('change', refresh);

      return () => {
        window.removeEventListener('online', refresh);
        window.removeEventListener('offline', goOffline);
        if (conn) conn.removeEventListener('change', refresh);
      };
    }

    // Native (iOS / Android) — use react-native-community/netinfo
    const unsubscribe = NetInfo.addEventListener((state) => {
      setInfo({
        isConnected: state.isConnected ?? false,
        type: state.type,
        cellularGeneration:
          state.type === 'cellular'
            ? ((state.details as { cellularGeneration?: string })?.cellularGeneration ?? null)
            : null,
        isInternetReachable: state.isInternetReachable ?? false,
        displayType: toDisplayType(state),
      });
    });

    NetInfo.fetch().then((state) => {
      setInfo({
        isConnected: state.isConnected ?? false,
        type: state.type,
        cellularGeneration:
          state.type === 'cellular'
            ? ((state.details as { cellularGeneration?: string })?.cellularGeneration ?? null)
            : null,
        isInternetReachable: state.isInternetReachable ?? false,
        displayType: toDisplayType(state),
      });
    });

    return unsubscribe;
  }, []);

  return info;
}
