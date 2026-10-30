import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Bell, X, ShieldAlert, Clock, Calendar, Info, CheckCheck, MapPin, User, Camera, AlertTriangle, ChevronRight, Shield, Settings, Mail } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { P, SP, BR, FONT, SH_TOKENS } from '../../ds';
import { useApp } from '../../context/AppContext';
import { authorizedImageSource } from '../../services/api';

export const NotificationsModal = ({ visible, onClose, onSelectAlert }) => {
  // Uses AppContext only — SecurityContext is the web/demo provider and is not mounted in the native app
  const appContext = useApp();
  const securityContext = null;

  const rawAlerts = appContext?.alerts || [];
  const rawNotifs = securityContext?.notifications || [];
  const [selectedItem, setSelectedItem] = useState(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingPreference, setSavingPreference] = useState(null);
  const [emailDeliveryConfigured, setEmailDeliveryConfigured] = useState(null);
  const isManager = ['manager', 'admin', 'superadmin'].includes(appContext?.currentUser?.role);
  const selectedIsPatrol = Boolean(selectedItem?.type?.startsWith('patrol_'));
  const preferences = {
    exceptionOnly: false,
    routinePatrolPush: false,
    dailyPatrolEmailDigest: false,
    includePatrolPhotosInDigest: true,
    ...(appContext?.currentUser?.notificationPreferences || {}),
  };

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
        badgeNumber: a.badgeNumber || null,
        siteName: a.siteName || a.site?.name || null,
        photoUrl: a.photoUrl || a.photoUri || null,
        photoUrls: [...new Set([...(a.photoUrls || []), a.photoUrl, a.photoUri].filter(Boolean))],
        category: a.category || null,
        location: a.location || null,
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
        badgeNumber: null,
        siteName: null,
        photoUrl: null,
        photoUrls: [],
        category: null,
        location: null,
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

  const handleSelectItem = (item) => {
    if (appContext?.markAlertRead && item.id) {
      appContext.markAlertRead(item.id);
    }
    setSelectedItem(item);
    if (onSelectAlert) onSelectAlert(item.raw);
  };

  const handlePreferenceChange = async (key, value) => {
    if (!appContext?.saveNotificationPreferences) return;
    setSavingPreference(key);
    try {
      const result = await appContext.saveNotificationPreferences({ [key]: value });
      if (typeof result?.emailDeliveryConfigured === 'boolean') setEmailDeliveryConfigured(result.emailDeliveryConfigured);
    } catch (error) {
      Alert.alert('Could not save settings', error.message || 'Check your connection and try again.');
    } finally {
      setSavingPreference(null);
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
      case 'check_call_issue':
        return <AlertTriangle color="#D97706" size={18} />;
      case 'account_deletion_request':
        return <Shield color={P.danger} size={18} />;
      case 'patrol_complete':
        return <CheckCheck color={P.ok} size={18} />;
      case 'roster':
        return <Calendar color={P.blueLight} size={18} />;
      default:
        return <Info color={P.t3} size={18} />;
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => { setSelectedItem(null); onClose(); }}>
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
                <Text style={styles.headerTitle}>{showSettings ? 'Notification Settings' : selectedItem ? (selectedIsPatrol ? 'Patrol Report' : 'Incident Report') : 'Operations Inbox'}</Text>
                <Text style={styles.headerSubtitle}>{showSettings ? 'Choose routine and exception delivery' : selectedItem ? (selectedIsPatrol ? 'Checkpoint status & photo evidence' : 'Full issue details & evidence') : 'Real-time alerts & shift notices'}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {!selectedItem && !showSettings && isManager && (
                <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.markReadButton} activeOpacity={0.7}>
                  <Settings color={P.t2} size={15} />
                  <Text style={[styles.markReadTxt, { color: P.t2 }]}>Settings</Text>
                </TouchableOpacity>
              )}
              {showSettings && (
                <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.closeButton} activeOpacity={0.7}>
                  <X color={P.t3} size={18} />
                </TouchableOpacity>
              )}
              {!selectedItem && !showSettings && (
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadButton} activeOpacity={0.7}>
                  <CheckCheck color="#D97706" size={15} />
                  <Text style={styles.markReadTxt}>Mark read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setSelectedItem(null); onClose(); }} style={styles.closeButton} activeOpacity={0.7}>
                <X color={P.t3} size={18} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body: Either Detail View or List */}
          {showSettings ? (
            <ScrollView style={styles.body} contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
              <PreferenceRow
                title="Exception-only mode"
                description="Send push alerts for missed patrols, incidents, and other exceptions. Routine completion records stay in the inbox."
                value={preferences.exceptionOnly}
                loading={savingPreference === 'exceptionOnly'}
                onValueChange={value => handlePreferenceChange('exceptionOnly', value)}
              />
              <PreferenceRow
                title="Routine patrol push"
                description="Send a push notification when a guard completes a patrol."
                value={preferences.routinePatrolPush && !preferences.exceptionOnly}
                loading={savingPreference === 'routinePatrolPush'}
                disabled={preferences.exceptionOnly}
                onValueChange={value => handlePreferenceChange('routinePatrolPush', value)}
              />
              <PreferenceRow
                title="Daily routine email digest"
                description={emailDeliveryConfigured === false
                  ? 'Email delivery is not configured on the server yet. Your preference will be saved, but no digest will be sent until SMTP is configured.'
                  : 'Email routine patrol logs once each day. Email delivery must be configured on the server.'}
                value={preferences.dailyPatrolEmailDigest}
                loading={savingPreference === 'dailyPatrolEmailDigest'}
                onValueChange={value => handlePreferenceChange('dailyPatrolEmailDigest', value)}
              />
              <PreferenceRow
                title="Include patrol photo links"
                description="Add time-limited links to captured checkpoint photos in the email digest."
                value={preferences.includePatrolPhotosInDigest}
                loading={savingPreference === 'includePatrolPhotosInDigest'}
                onValueChange={value => handlePreferenceChange('includePatrolPhotosInDigest', value)}
              />
              <View style={styles.preferenceInfo}>
                <Mail size={15} color={P.info} />
                <Text style={styles.preferenceInfoText}>Exception alerts remain visible in the in-app inbox regardless of push settings.</Text>
              </View>
            </ScrollView>
          ) : selectedItem ? (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={styles.detailCard}>
                <View style={styles.detailBadgeRow}>
                  <View style={[styles.detailBadge, selectedItem.type.includes('issue') ? styles.detailBadgeWarn : styles.detailBadgeInfo]}>
                    <Text style={styles.detailBadgeTxt}>
                      {selectedItem.type === 'check_call_issue' ? '⚠️ ISSUE REPORT' : selectedItem.type === 'sos' ? '🚨 SOS EMERGENCY' : selectedItem.title.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.detailTime}>
                    {new Date(selectedItem.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                </View>

                {/* Guard & Site Info */}
                <View style={styles.detailMetaGrid}>
                  <View style={styles.detailMetaCol}>
                    <Text style={styles.detailMetaLabel}>REPORTING OFFICER</Text>
                    <Text style={styles.detailMetaVal}>{selectedItem.guardName || 'Security Guard'}</Text>
                    {selectedItem.badgeNumber && <Text style={styles.detailMetaSub}>SIA: {selectedItem.badgeNumber}</Text>}
                  </View>
                  <View style={styles.detailMetaCol}>
                    <Text style={styles.detailMetaLabel}>SECURITY SITE</Text>
                    <Text style={styles.detailMetaVal}>{selectedItem.siteName || 'Assigned Site'}</Text>
                  </View>
                </View>

                {selectedItem.category && (
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryLabel}>INCIDENT CATEGORY: </Text>
                    <Text style={styles.categoryVal}>{selectedItem.category}</Text>
                  </View>
                )}

                {/* Full Message Statement */}
                <View style={styles.detailSectionBox}>
                  <Text style={styles.detailSectionTitle}>{selectedIsPatrol ? 'PATROL SUMMARY' : 'ISSUE REPORT STATEMENT'}</Text>
                  <Text style={styles.detailMessageText}>{selectedItem.message}</Text>
                </View>

                {/* Officer written note if distinct */}
                {selectedItem.note && (
                  <View style={[styles.detailSectionBox, styles.detailNoteBox]}>
                    <Text style={styles.detailNoteTitle}>OFFICER NOTE / EXPLANATION</Text>
                    <Text style={styles.detailNoteText}>"{selectedItem.note}"</Text>
                  </View>
                )}

                {/* Photo Evidence */}
                {Boolean(selectedItem.photoUrls?.length || selectedItem.photoUrl) && (
                  <View style={styles.detailSectionBox}>
                    <View style={styles.photoHeaderRow}>
                      <Camera size={14} color={P.blue} />
                      <Text style={styles.photoHeaderTxt}>ATTACHED PHOTO EVIDENCE</Text>
                    </View>
                    {(selectedItem.photoUrls?.length ? selectedItem.photoUrls : [selectedItem.photoUrl]).map((url, index) => (
                      <TouchableOpacity key={`${url}-${index}`} onPress={() => setEnlargedPhoto(url)} activeOpacity={0.9} style={styles.photoWrap}>
                        <Image source={authorizedImageSource(url)} style={styles.issueImage} resizeMode="cover" />
                        <View style={styles.tapToZoomPill}><Text style={styles.tapToZoomTxt}>🔍 Checkpoint {index + 1} · Tap to enlarge</Text></View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Location Telemetry */}
                {selectedItem.location && (
                  <View style={styles.locationPillRow}>
                    <MapPin size={12} color="#E11D48" />
                    <Text style={styles.locationTxt}>
                      {selectedItem.location.what3words || `${Number(selectedItem.location.latitude).toFixed(4)}°, ${Number(selectedItem.location.longitude).toFixed(4)}°`}
                    </Text>
                  </View>
                )}

                <TouchableOpacity style={styles.backToListBtn} onPress={() => setSelectedItem(null)} activeOpacity={0.85}>
                  <Text style={styles.backToListBtnTxt}>← Back to Notifications</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
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
                    onPress={() => handleSelectItem(n)}
                    activeOpacity={0.75}
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
                      <Text style={styles.notifMsg} numberOfLines={2}>{n.message}</Text>
                      {(n.guardName || n.siteName || n.photoUrls?.length || n.photoUrl) && (
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
                          {(n.photoUrls?.length || n.photoUrl) && (
                            <View style={[styles.metaPill, styles.photoPill]}>
                              <Camera size={10} color={P.blue} />
                              <Text style={[styles.metaPillTxt, { color: P.blue, fontWeight: '700' }]}>Photo Evidence</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    <ChevronRight size={15} color={P.t3} style={{ alignSelf: 'center', marginLeft: 4 }} />
                    {!n.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {!selectedItem && !showSettings && (
            <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeFooterBtnTxt}>Dismiss & Return</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Enlarged Photo Modal */}
      {enlargedPhoto && (
        <Modal visible={!!enlargedPhoto} transparent animationType="fade" onRequestClose={() => setEnlargedPhoto(null)}>
          <View style={styles.photoOverlay}>
            <TouchableOpacity style={styles.photoOverlayBg} activeOpacity={1} onPress={() => setEnlargedPhoto(null)} />
            <View style={styles.photoModalCard}>
              <View style={styles.photoModalHeader}>
                <Text style={styles.photoModalTitle}>Evidence Photograph</Text>
                <TouchableOpacity onPress={() => setEnlargedPhoto(null)} style={styles.closePhotoBtn}>
                  <X size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Image source={authorizedImageSource(enlargedPhoto)} style={styles.fullImage} resizeMode="contain" />
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
};

function PreferenceRow({ title, description, value, onValueChange, loading, disabled = false }) {
  return (
    <View style={[styles.preferenceRow, disabled && { opacity: 0.55 }]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      {loading ? <ActivityIndicator size="small" color={P.info} /> : (
        <Switch value={Boolean(value)} onValueChange={onValueChange} disabled={disabled} />
      )}
    </View>
  );
}

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
  preferenceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: P.b2, borderRadius: BR.lg,
    backgroundColor: P.bg0, padding: SP.px12,
  },
  preferenceTitle: { color: P.t1, fontSize: 13, fontWeight: '800' },
  preferenceDescription: { color: P.t3, fontSize: 11, lineHeight: 16, marginTop: 4 },
  preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SP.px10 },
  preferenceInfoText: { flex: 1, color: P.t3, fontSize: 11, lineHeight: 15 },
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
  photoPill: {
    backgroundColor: 'rgba(27,79,190,0.1)',
    borderColor: 'rgba(27,79,190,0.3)',
    borderWidth: 1,
  },
  detailCard: {
    paddingVertical: 4,
  },
  detailBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailBadge: {
    borderRadius: BR.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  detailBadgeWarn: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: '#D97706',
  },
  detailBadgeInfo: {
    backgroundColor: 'rgba(27,79,190,0.1)',
    borderColor: P.blueBorder,
  },
  detailBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  detailTime: {
    fontSize: 11,
    color: P.t3,
    fontWeight: '600',
  },
  detailMetaGrid: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: P.bg1,
    borderRadius: BR.md,
    padding: SP.px12,
    borderWidth: 1,
    borderColor: P.b2,
    marginBottom: 10,
  },
  detailMetaCol: {
    flex: 1,
  },
  detailMetaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: P.t4,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  detailMetaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: P.t1,
  },
  detailMetaSub: {
    fontSize: 11,
    color: P.t3,
    marginTop: 1,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: BR.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    marginBottom: 10,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: P.t3,
  },
  categoryVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  detailSectionBox: {
    backgroundColor: P.bg1,
    borderRadius: BR.md,
    padding: SP.px12,
    borderWidth: 1,
    borderColor: P.b2,
    marginBottom: 10,
  },
  detailSectionTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: P.t4,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  detailMessageText: {
    fontSize: 13,
    color: P.t1,
    lineHeight: 18,
    fontWeight: '600',
  },
  detailNoteBox: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderColor: 'rgba(245,158,11,0.25)',
  },
  detailNoteTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  detailNoteText: {
    fontSize: 12,
    color: P.t1,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  photoHeaderTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: P.blue,
    letterSpacing: 0.6,
  },
  photoWrap: {
    borderRadius: BR.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: P.b2,
    position: 'relative',
  },
  issueImage: {
    width: '100%',
    height: 190,
  },
  tapToZoomPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BR.xs,
  },
  tapToZoomTxt: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  locationPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BR.sm,
    marginBottom: 12,
  },
  locationTxt: {
    fontSize: 11,
    color: '#BE123C',
    fontWeight: '700',
  },
  backToListBtn: {
    backgroundColor: P.bg2,
    borderWidth: 1.5,
    borderColor: P.b2,
    borderRadius: BR.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  backToListBtnTxt: {
    color: P.t1,
    fontSize: 13,
    fontWeight: '800',
  },
  photoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SP.px16,
  },
  photoOverlayBg: {
    ...StyleSheet.absoluteFillObject,
  },
  photoModalCard: {
    width: '100%',
    maxHeight: '90%',
    alignItems: 'center',
  },
  photoModalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  closePhotoBtn: {
    padding: 6,
    borderRadius: BR.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  fullImage: {
    width: '100%',
    height: 380,
    borderRadius: BR.lg,
  },
});
