/**
 * NFC Card Reader Service
 * Defensively handles NFC hardware across Android & iOS with clear status differentiation:
 *  - 'READY': NFC is supported and active
 *  - 'DISABLED': NFC hardware exists but is switched OFF in phone settings (with shortcut to Settings)
 *  - 'UNSUPPORTED': Phone truly lacks NFC hardware or is running in a simulator/web environment
 */
import { Platform, Alert, Linking } from 'react-native';

let NfcManagerModule = null;
let NfcTechModule = null;
let scanInProgress = false;

try {
  const nfc = require('react-native-nfc-manager');
  NfcManagerModule = nfc.default || nfc;
  NfcTechModule = nfc.NfcTech;
} catch (_) {
  // Not installed or native bridge unavailable (Expo Go, simulator, etc.)
}

/**
 * Normalizes an NFC Tag ID or card serial number:
 * strips colons, spaces, dashes and converts to lowercase alphanumeric.
 */
export function normalizeNfcTag(rawId) {
  if (!rawId) return '';
  return String(rawId).replace(/[^a-f0-9]/gi, '').toLowerCase();
}

/**
 * Distinguishes the 3 NFC hardware states:
 * 1. 'READY': Available and switched on
 * 2. 'DISABLED': Present on phone but turned off in Settings
 * 3. 'UNSUPPORTED': Phone truly lacks NFC hardware
 */
export async function getNfcState() {
  if (!NfcManagerModule) {
    return {
      status: 'UNSUPPORTED',
      message: 'This device or build does not have NFC hardware access.',
      canOpenSettings: false,
    };
  }

  try {
    const supported = await NfcManagerModule.isSupported();
    if (!supported) {
      return {
        status: 'UNSUPPORTED',
        message: 'This device does not have NFC hardware support.',
        canOpenSettings: false,
      };
    }

    await NfcManagerModule.start().catch(() => {});
    const enabled = Platform.OS === 'android'
      ? await NfcManagerModule.isEnabled().catch(() => false)
      : true;
    if (!enabled) {
      return {
        status: 'DISABLED',
        message: 'NFC is supported on your phone but is currently turned off in Settings.',
        canOpenSettings: true,
      };
    }

    return {
      status: 'READY',
      message: 'NFC sensor is active and ready to scan tags.',
      canOpenSettings: false,
    };
  } catch (err) {
    return {
      status: 'UNSUPPORTED',
      message: err?.message || 'NFC detection failed.',
      canOpenSettings: false,
    };
  }
}

/**
 * Direct shortcut to phone NFC settings so user can enable it
 */
export async function openNfcSettings() {
  try {
    if (Platform.OS === 'android' && NfcManagerModule?.goToNfcSetting) {
      await NfcManagerModule.goToNfcSetting();
    } else {
      await Linking.openSettings();
    }
  } catch (_) {
    await Linking.openSettings().catch(() => {});
  }
}

/**
 * Convenience boolean check for NFC readiness
 */
export async function isNfcAvailable() {
  const state = await getNfcState();
  return state.status === 'READY';
}

/**
 * Reads an NFC tag from the device's NFC sensor with state detection,
 * automatic settings prompt if disabled, and clear success/failure feedback.
 */
async function performNfcTagScan(options = {}) {
  const { simulatedId = null, promptTitle = 'NFC Checkpoint Scan' } = options;

  if (simulatedId) {
    return normalizeNfcTag(simulatedId);
  }

  // Check hardware state
  const state = await getNfcState();

  // If supported but disabled in phone settings, guide user to enable it
  if (state.status === 'DISABLED') {
    return new Promise((resolve, reject) => {
      Alert.alert(
        'NFC is Turned Off',
        'Your phone supports NFC, but it is currently turned off. Please turn on NFC in Settings to scan checkpoint cards.',
        [
          {
            text: 'Open Settings',
            onPress: async () => {
              await openNfcSettings();
              reject(new Error('NFC is disabled. Please enable it in Settings and retry.'));
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => reject(new Error('NFC scan cancelled.')),
          },
        ]
      );
    });
  }

  if (state.status !== 'READY' || !NfcManagerModule || !NfcTechModule) {
    throw new Error('This device or app build cannot scan NFC cards. Use an NFC-capable phone and install the NFC-enabled app build.');
  }

  let requestStarted = false;
  try {
    await NfcManagerModule.start();
    requestStarted = true;
    const techs = Platform.OS === 'ios'
      ? [NfcTechModule.Ndef]
      : [NfcTechModule.Ndef, NfcTechModule.NfcA, NfcTechModule.IsoDep];
    await NfcManagerModule.requestTechnology(
      techs,
      { alertMessage: promptTitle },
    );
    const tag = await NfcManagerModule.getTag();
    const tagId = normalizeNfcTag(tag?.id);
    if (!tagId) throw new Error('The NFC card was detected but did not provide a readable card ID.');
    return tagId;
  } catch (err) {
    if (/cancel/i.test(err?.message || '')) throw new Error('NFC scan cancelled.');
    throw new Error(err?.message || 'NFC scan failed. Hold the card against the phone and try again.');
  } finally {
    if (requestStarted) await NfcManagerModule.cancelTechnologyRequest().catch(() => {});
  }
}

export async function readNfcTag(options = {}) {
  if (scanInProgress) throw new Error('An NFC scan is already in progress. Finish or cancel it before scanning another card.');
  scanInProgress = true;
  try {
    return await performNfcTagScan(options);
  } finally {
    scanInProgress = false;
  }
}
