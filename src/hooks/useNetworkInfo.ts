import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkInfo {
  isConnected: boolean;
  type: string; // 'wifi' | 'cellular' | 'none' | 'unknown'
  cellularGeneration: string | null; // '2g' | '3g' | '4g' | '5g'
  isInternetReachable: boolean;
  displayType: string; // human readable: "4G", "WiFi", "3G" etc.
}

function toDisplayType(state: NetInfoState): string {
  if (state.type === 'wifi') return 'WiFi';
  if (state.type === 'cellular') {
    const gen = (state.details as { cellularGeneration?: string })?.cellularGeneration;
    if (gen === '4g') return '4G LTE';
    if (gen === '5g') return '5G';
    if (gen === '3g') return '3G';
    if (gen === '2g') return '2G';
    return 'Cellular';
  }
  if (state.type === 'none') return 'Offline';
  return 'Unknown';
}

export function useNetworkInfo(): NetworkInfo {
  const [info, setInfo] = useState<NetworkInfo>({
    isConnected: false,
    type: 'unknown',
    cellularGeneration: null,
    isInternetReachable: false,
    displayType: 'Unknown',
  });

  useEffect(() => {
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

    // Fetch initial state
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
