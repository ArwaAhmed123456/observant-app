import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LogOut, AlertTriangle, ShieldCheck, X } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { P, BR, SP, FONT } from '../../ds';
import { COLORS } from '../../theme';

export function GuardLogoutButton() {
  const { logout, currentUser, shiftSessions, sites, bookOff } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentGuardId = String(currentUser?.id || currentUser?._id || '');
  const activeSession = (shiftSessions || []).find(s => {
    const sGuardId = String(s.guardId?._id || s.guardId?.id || s.guardId || '');
    return sGuardId === currentGuardId && !s.bookedOffAt && s.status !== 'completed' && s.status !== 'booked_off';
  });

  const activeSite = activeSession
    ? (sites || []).find(s => String(s.id || s._id) === String(activeSession.siteId?._id || activeSession.siteId || ''))
    : null;

  const handleSignOutOnly = async () => {
    if (busy) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await logout();
      setModalVisible(false);
    } catch (err) {
      console.warn('[GuardLogoutButton] Sign out fallback:', err);
      setModalVisible(false);
    } finally {
      setBusy(false);
    }
  };

  const handleBookOffAndSignOut = async () => {
    if (busy) return;
    setBusy(true);
    setErrorMsg('');
    try {
      if (bookOff && activeSession) {
        await bookOff();
      }
      await logout();
      setModalVisible(false);
    } catch (err) {
      console.warn('[GuardLogoutButton] Book off error, signing out anyway:', err);
      await logout();
      setModalVisible(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityHint="Opens sign out dialog"
        style={styles.button}
        onPress={() => {
          setErrorMsg('');
          setModalVisible(true);
        }}
        disabled={busy}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {busy ? <ActivityIndicator size="small" color={P.t2} /> : <LogOut size={18} color={P.t2} />}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => !busy && setModalVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={P.t3} />
            </TouchableOpacity>

            <View style={[styles.iconCircle, activeSession ? styles.iconWarn : styles.iconDanger]}>
              {activeSession ? (
                <AlertTriangle size={24} color="#D97706" />
              ) : (
                <LogOut size={22} color={P.danger} />
              )}
            </View>

            <Text style={styles.modalTitle}>
              {activeSession ? 'Active Shift in Progress' : 'Sign Out?'}
            </Text>

            <Text style={styles.modalBody}>
              {activeSession
                ? `You are currently booked on duty at ${activeSite?.name || 'your assigned site'}. Would you like to book off before signing out?`
                : 'Are you sure you want to sign out of Observant Security on this device?'}
            </Text>

            {errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : null}

            {activeSession ? (
              <View style={styles.actionGroup}>
                <TouchableOpacity
                  style={[styles.btnPrimary, busy && styles.btnDisabled]}
                  onPress={handleBookOffAndSignOut}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <ShieldCheck size={16} color="#FFFFFF" />
                      <Text style={styles.btnPrimaryText}>Book Off & Sign Out</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnSecondary, busy && styles.btnDisabled]}
                  onPress={handleSignOutOnly}
                  disabled={busy}
                >
                  <Text style={styles.btnSecondaryText}>Sign Out Only</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => !busy && setModalVisible(false)}
                  disabled={busy}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actionGroup}>
                <TouchableOpacity
                  style={[styles.btnDanger, busy && styles.btnDisabled]}
                  onPress={handleSignOutOnly}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <LogOut size={16} color="#FFFFFF" />
                      <Text style={styles.btnDangerText}>Yes, Sign Out</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => !busy && setModalVisible(false)}
                  disabled={busy}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: BR.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.bg3,
    borderWidth: 1,
    borderColor: P.b2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 25, 44, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SP.px20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: BR.lg,
    padding: SP.px24,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SP.px16,
  },
  iconDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  iconWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B192C',
    textAlign: 'center',
    marginBottom: SP.px8,
  },
  modalBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: SP.px20,
    paddingHorizontal: SP.px8,
  },
  errorText: {
    fontSize: 12,
    color: P.danger,
    marginBottom: SP.px12,
    textAlign: 'center',
  },
  actionGroup: {
    width: '100%',
    gap: 10,
  },
  btnPrimary: {
    height: 46,
    backgroundColor: '#1E40AF',
    borderRadius: BR.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnSecondary: {
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: BR.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  btnDanger: {
    height: 46,
    backgroundColor: '#DC2626',
    borderRadius: BR.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnCancel: {
    height: 42,
    borderRadius: BR.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
