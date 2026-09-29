import NfcManager, { NfcTech } from 'react-native-nfc-manager';

export async function readNfcTag() {
  if (!(await NfcManager.isSupported())) throw new Error('This phone does not support NFC.');
  await NfcManager.start();
  if (!(await NfcManager.isEnabled())) throw new Error('Turn on NFC in Android settings and try again.');
  try {
    await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA, NfcTech.IsoDep]);
    const tag = await NfcManager.getTag();
    if (!tag?.id) throw new Error('Could not read the NFC card. Hold it near the back of the phone.');
    return String(tag.id).replace(/[^a-f0-9]/gi, '').toLowerCase();
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
