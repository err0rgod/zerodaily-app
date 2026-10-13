import * as Application from 'expo-application';
import { Platform } from 'react-native';

/**
 * Stable per-install identifier sent when creating a guest session, so the backend hands the
 * same device its existing guest account instead of creating a new one on every reinstall.
 * Android ID survives reinstalls and cleared app data (it is scoped to the app signing key).
 */
export async function getDeviceId(): Promise<string | undefined> {
  try {
    if (Platform.OS === 'android') return Application.getAndroidId() || undefined;
    if (Platform.OS === 'ios') return (await Application.getIosIdForVendorAsync()) || undefined;
  } catch {
    // Identifier unavailable: the backend falls back to a fresh guest
  }
  return undefined;
}

/** e.g. "ZeroDaily-Mobile/1.7.0 (android 36)" */
export const APP_USER_AGENT = `ZeroDaily-Mobile/${Application.nativeApplicationVersion ?? 'unknown'} (${Platform.OS} ${Platform.Version})`;
