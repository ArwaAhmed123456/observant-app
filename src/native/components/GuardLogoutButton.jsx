import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { P, BR } from '../../ds';

export function GuardLogoutButton() {
  const { logout } = useApp();
  const [busy, setBusy] = useState(false);
  const confirmLogout = () => Alert.alert('Sign out?', 'Your session will be cleared from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => {
      if (busy) return;
      setBusy(true);
      try { await logout(); }
      catch (error) { Alert.alert('Sign out issue', error.message || 'Your local session was cleared.'); }
      finally { setBusy(false); }
    } },
  ]);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      accessibilityHint="Clears your guard session and returns to sign in"
      style={styles.button}
      onPress={confirmLogout}
      disabled={busy}
      hitSlop={8}
    >
      {busy ? <ActivityIndicator size="small" color={P.t2} /> : <LogOut size={18} color={P.t2} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 38, height: 38, borderRadius: BR.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg3, borderWidth: 1, borderColor: P.b2 },
});
