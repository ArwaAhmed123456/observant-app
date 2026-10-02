import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Bell, X, ShieldAlert, Clock, Calendar, Info, CheckCheck, MapPin, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { P, SP, BR, FONT, SH_TOKENS } from '../../ds';
import { useApp } from '../../context/AppContext';
import { useSecurity } from '../../context/SecurityContext';

export const NotificationsModal = ({ visible, onClose, onSelectAlert }) => {
  // Gracefully support AppContext and SecurityContext
  let appContext = null;
  let securityContext = null;
  try { appContext = useApp(); } catch (_) {}
  try { securityContext = useSecurity(); } catch (_) {}

  const rawAlerts = appContext?.alerts || [];
  const rawNotifs = securityContext?.notifications || [];

  // Unified items list
  const items = rawAlerts.length > 0
    ? rawAlerts.map(a => ({
        id: a.id || a._id,
        title: a.title || 'Security alert',
        message: a.message || '',
        note: a.note || null,
        type: a.type || 'info',
        read: !!a.read,
        timestamp: a.createdAt || new Date().toISOString(),
        guardName: a.guardName || a.guard?.name || null,
        siteName: a.siteName || a.site?.name || null,
        raw: a,
      }))
    : rawNotifs.map(n => ({
        id: n.id || String(Math.random()),
        title: n.title || 'Notification',
        message: n.message || '',
        note: null,
        type: n.type || 'info',
        read: !!n.read,
        timestamp: n.timestamp || new Date().toISOString(),
        guardName: null,
        siteName: null,
        raw: n,
      }));

  const handleMarkAllRead = () => {
    if (appContext?.markAllAlertsRead) {
      appContext.markAllAlertsRead();
    }
    if (securityContext?.setNotifications) {
      securityContext.setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'emergency':
      case 'sos':
      case 'random_prompt_ignored':
        return <ShieldAlert color={P.danger} size={18} />;
      case 'shift':
      case 'check_call':
      case 'check_call_missed':
        return <Clock color="#D97706" size={18} />;
      case 'roster':
        return <Calendar color={P.blueLight} size={18} />;
      default:
        return <Info color={P.t3} size={18} />;
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={StyleSheet.absoluteFillObject} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.bellWrap}>
                <Bell color="#D97706" size={18} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Operations Inbox</Text>
                <Text style={styles.headerSubtitle}>Real-time alerts & shift notices</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadButton} activeOpacity={0.7}>
                <CheckCheck color="#D97706" size={15} />
                <Text style={styles.markReadTxt}>Mark read</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
                <X color={P.t3} size={18} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            {items.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Bell color={P.t4} size={36} />
                <Text style={styles.emptyText}>No notifications in your inbox.</Text>
                <Text style={styles.emptySub}>All monitored operations are running smoothly.</Text>
              </View>
            ) : (
              items.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.notifCard, !n.read && styles.notifCardUnread]}
                  onPress={() => {
                    if (onSelectAlert) onSelectAlert(n.raw);
                  }}
                  activeOpacity={onSelectAlert ? 0.75 : 1}
                >
                  <View style={styles.iconWrap}>{getIcon(n.type)}</View>
                  <View style={styles.notifCol}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.notifTitle, !n.read && styles.notifTitleUnread]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text style={styles.notifTime}>
                        {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.notifMsg}>{n.message}</Text>
                    {(n.guardName || n.siteName) && (
                      <View style={styles.metaRow}>
                        {n.guardName && (
                          <View style={styles.metaPill}>
                            <User size={10} color={P.t3} />
                            <Text style={styles.metaPillTxt}>{n.guardName}</Text>
                          </View>
                        )}
                        {n.siteName && (
                          <View style={styles.metaPill}>
                            <MapPin size={10} color={P.t3} />
                            <Text style={styles.metaPillTxt}>{n.siteName}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {n.note && <Text style={styles.notifNote}>"{n.note}"</Text>}
                  </View>
                  {!n.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeFooterBtnTxt}>Dismiss & Return</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: P.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SP.px16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: P.bg0,
    borderRadius: BR.xl,
    borderWidth: 1.5,
    borderColor: P.b3,
    maxHeight: '82%',
    padding: SP.px18,
    overflow: 'hidden',
    ...SH_TOKENS.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SP.px12,
    borderBottomWidth: 1,
    borderBottomColor: P.b1,
    marginBottom: SP.px12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(217,119,6,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: P.t1,
  },
  headerSubtitle: {
    fontSize: 11,
    color: P.t3,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BR.sm,
    backgroundColor: 'rgba(217,119,6,0.1)',
  },
  markReadTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  closeButton: {
    padding: 6,
    borderRadius: BR.sm,
    backgroundColor: P.bg2,
    borderWidth: 1,
    borderColor: P.b2,
  },
  body: {
    maxHeight: 400,
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: P.t2,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySub: {
    color: P.t4,
    fontSize: 12,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: P.bg1,
    borderRadius: BR.md,
    padding: SP.px12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: P.b2,
    position: 'relative',
  },
  notifCardUnread: {
    borderColor: 'rgba(217,119,6,0.4)',
    backgroundColor: 'rgba(217,119,6,0.06)',
  },
  iconWrap: {
    marginTop: 2,
    width: 28,
    alignItems: 'center',
  },
  notifCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: P.t2,
    flex: 1,
    marginRight: 6,
  },
  notifTitleUnread: {
    color: P.t1,
    fontWeight: '800',
  },
  notifMsg: {
    fontSize: 12,
    color: P.t3,
    lineHeight: 16,
  },
  notifTime: {
    fontSize: 10,
    color: P.t4,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: P.bg3,
    borderRadius: BR.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaPillTxt: {
    fontSize: 10,
    fontWeight: '600',
    color: P.t3,
  },
  notifNote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#D97706',
    marginTop: 4,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D97706',
    position: 'absolute',
    top: 12,
    right: 10,
  },
  closeFooterBtn: {
    marginTop: 8,
    backgroundColor: P.bg2,
    borderWidth: 1,
    borderColor: P.b2,
    borderRadius: BR.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeFooterBtnTxt: {
    color: P.t2,
    fontSize: 13,
    fontWeight: '700',
  },
});
