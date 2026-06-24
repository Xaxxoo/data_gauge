import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CarrierId, UssdBalanceCheck } from '../types';
import { generateId } from './storage';

const USSD_STORAGE_KEY = '@dm:ussd_checks';

/** USSD codes per carrier for checking data balance */
export const USSD_CODES: Record<CarrierId, { code: string; label: string; description: string }> = {
  mtn: {
    code: '*461*4#',
    label: 'MTN Data Balance',
    description: 'Dial *461*4# to check your MTN data balance. You can also try *131*4# for a menu-based check.',
  },
  airtel: {
    code: '*140#',
    label: 'Airtel Data Balance',
    description: 'Dial *140# to check your Airtel data balance. The response will show all active bundles.',
  },
  glo: {
    code: '*127*0#',
    label: 'Glo Data Balance',
    description: 'Dial *127*0# to check your Glo data balance. You can also try *127*0*0#.',
  },
  '9mobile': {
    code: '*228#',
    label: '9mobile Data Balance',
    description: 'Dial *228# to check your 9mobile data balance and see remaining bundle.',
  },
  other: {
    code: '',
    label: 'Unknown Carrier',
    description: 'USSD code not available for this carrier. Please check your carrier\'s website or customer service.',
  },
};

/**
 * Dial the USSD code for balance check.
 * On Android: opens dialer with USSD code.
 * On iOS: shows instructions (Apple blocks programmatic USSD).
 */
export async function dialUssd(carrierId: CarrierId): Promise<boolean> {
  const entry = USSD_CODES[carrierId];
  if (!entry || !entry.code) {
    Alert.alert('Unavailable', 'USSD code is not available for this carrier.');
    return false;
  }

  if (Platform.OS === 'ios') {
    Alert.alert(
      'Manual USSD Check',
      `iOS doesn't support automatic USSD dialing.\n\nPlease open your Phone app and dial:\n\n${entry.code}\n\nThen come back and enter your balance.`,
      [{ text: 'OK' }]
    );
    return false;
  }

  // Android: open dialer with USSD code
  try {
    const url = `tel:${encodeURIComponent(entry.code)}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      Alert.alert('Error', 'Unable to open the dialer. Please dial manually: ' + entry.code);
      return false;
    }
  } catch (err) {
    Alert.alert('Error', 'Failed to dial USSD code. Please dial manually: ' + entry.code);
    return false;
  }
}

/** Save a USSD balance check entry */
export async function saveUssdCheck(check: UssdBalanceCheck): Promise<void> {
  const all = await getUssdChecks();
  all.unshift(check);
  await AsyncStorage.setItem(USSD_STORAGE_KEY, JSON.stringify(all.slice(0, 50)));
}

/** Get past USSD balance check history */
export async function getUssdChecks(): Promise<UssdBalanceCheck[]> {
  try {
    const raw = await AsyncStorage.getItem(USSD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Create a new balance check entry */
export function createUssdCheck(
  carrierId: CarrierId,
  balanceMB: number,
  method: 'ussd' | 'manual'
): UssdBalanceCheck {
  return {
    id: generateId(),
    carrierId,
    timestamp: new Date().toISOString(),
    balanceMB,
    method,
  };
}
