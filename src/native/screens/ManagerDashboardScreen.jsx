import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert
} from 'react-native';
import {
  ShieldAlert,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Clock,
  Eye,
  Check,
  ChevronRight
} from 'lucide-react-native';
import { useSecurity } from '../../context/SecurityContext';

export const ManagerDashboardScreen = () => {
  const {
    sites,
    users,
    shiftSessions,
    managerAlert,
    dismissManagerAlert,
    antiIdleLogs,
    resolveIncident,
    patrolSessions
  } = useSecurity();

  const guards = users.filter((u) => u.role === 'guard');
  const activeSessions = shiftSessions.filter((s) => s.isActive);

  // Collect all incidents from active shift logs or mock
  const recentIncidents = [
    {
      id: 'inc-101',
      title: 'Perimeter Sensor Post 9 Alert',
      severity: 'Critical',
      siteName: 'Highland Logistics Hub',
      time: '12m ago',
      status: 'investigating'
    },
    {
      id: 'inc-102',
      title: 'Unidentified Vehicle at Gate B',
      severity: 'Medium',
      siteName: 'Apex Tower',
      time: '45m ago',
      status: 'pending'
    }
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Supervisor Command Console</Text>
          <Text style={styles.headerSubtitle}>Live Multi-Site Operations Center</Text>
        </View>
        <View style={styles.liveTag}>
          <Radio color="#10b981" size={14} />
          <Text style={styles.liveTagText}>DISPATCH LIVE</Text>
        </View>
      </View>

      {/* Critical Alert Banner if present */}
      {managerAlert && (
        <View style={styles.alertBanner}>
          <View style={styles.alertTop}>
            <ShieldAlert color="#ef4444" size={24} />
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertTitle}>{managerAlert.title}</Text>
              <Text style={styles.alertMsg}>{managerAlert.message}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={dismissManagerAlert} style={styles.dismissAlertButton}>
            <Text style={styles.dismissAlertText}>ACKNOWLEDGE & DISMISS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Site Status Overview */}
      <Text style={styles.sectionTitle}>Sites Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        {sites.map((site) => {
          const activeGuardsOnSite = activeSessions.filter((s) => s.siteId === site.id);
          const hasPatrol = patrolSessions.some((p) => p.siteId === site.id && p.status === 'in_progress');

          return (
            <View key={site.id} style={styles.siteCard}>
              <View style={styles.siteCardTop}>
                <Building2 color="#38bdf8" size={18} />
                <View
                  style={[
                    styles.siteDot,
                    { backgroundColor: activeGuardsOnSite.length > 0 ? '#10b981' : '#f59e0b' }
                  ]}
                />
              </View>
              <Text style={styles.siteCardName} numberOfLines={1}>
                {site.name}
              </Text>
              <Text style={styles.siteCardZone}>{site.zone}</Text>
              <View style={styles.siteMetaRow}>
                <Text style={styles.siteMetaText}>
                  {activeGuardsOnSite.length} Guard{activeGuardsOnSite.length !== 1 ? 's' : ''} On-Site
                </Text>
                <Text style={[styles.siteMetaText, { color: hasPatrol ? '#10b981' : '#64748b' }]}>
                  {hasPatrol ? 'Patrol Active' : 'Stationary'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Guard Roster & Deployment Status */}
      <Text style={styles.sectionTitle}>Active Field Officers</Text>
      {guards.map((guard) => {
        const active = activeSessions.find((s) => s.guardId === guard.id);
        const assignedSite = sites.find((s) => s.id === (active?.siteId || guard.assignedSiteId));

        return (
          <View key={guard.id} style={styles.guardCard}>
            <Image source={{ uri: guard.avatar }} style={styles.guardCardAvatar} />
            <View style={styles.guardCardInfo}>
              <View style={styles.guardNameRow}>
                <Text style={styles.guardCardName}>{guard.name}</Text>
                <View
                  style={[
                    styles.guardStatusTag,
                    { backgroundColor: active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)' }
                  ]}
                >
                  <Text
                    style={[
                      styles.guardStatusText,
                      { color: active ? '#10b981' : '#94a3b8' }
                    ]}
                  >
                    {active ? 'ON DUTY' : 'OFF DUTY'}
                  </Text>
                </View>
              </View>
              <Text style={styles.guardCardSite}>{assignedSite?.name}</Text>
              <View style={styles.guardSubRow}>
                <Text style={styles.guardBadge}>{guard.badgeNumber}</Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.guardGps}>
                  {active ? 'GPS Geofence Verified' : 'Last shift completed'}
                </Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* Incidents & Exceptions Feed */}
      <Text style={styles.sectionTitle}>Incident Watch</Text>
      {recentIncidents.map((inc) => (
        <View key={inc.id} style={styles.incidentCard}>
          <View style={styles.incidentTop}>
            <View style={styles.incidentTitleRow}>
              <AlertTriangle color="#ef4444" size={16} />
              <Text style={styles.incidentTitle}>{inc.title}</Text>
            </View>
            <View style={styles.sevBadge}>
              <Text style={styles.sevBadgeText}>{inc.severity}</Text>
            </View>
          </View>
          <View style={styles.incidentFooter}>
            <Text style={styles.incidentSite}>{inc.siteName}</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert('Incident Cleared', `${inc.title} marked as verified and resolved.`)
              }
              style={styles.resolveButton}
            >
              <Check color="#10b981" size={12} />
              <Text style={styles.resolveButtonText}>RESOLVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingHorizontal: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 45,
    paddingBottom: 16
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc'
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6
  },
  liveTagText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800'
  },
  alertBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 14,
    marginBottom: 16
  },
  alertTop: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10
  },
  alertTextWrap: {
    flex: 1
  },
  alertTitle: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800'
  },
  alertMsg: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16
  },
  dismissAlertButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center'
  },
  dismissAlertText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 6
  },
  horizontalScroll: {
    marginBottom: 16
  },
  siteCard: {
    width: 170,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginRight: 10
  },
  siteCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  siteDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  siteCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc'
  },
  siteCardZone: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8
  },
  siteMetaRow: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 8,
    gap: 2
  },
  siteMetaText: {
    fontSize: 10,
    color: '#94a3b8'
  },
  guardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    marginBottom: 10
  },
  guardCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#334155'
  },
  guardCardInfo: {
    flex: 1
  },
  guardNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  guardCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc'
  },
  guardStatusTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4
  },
  guardStatusText: {
    fontSize: 9,
    fontWeight: '800'
  },
  guardCardSite: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  guardSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3
  },
  guardBadge: {
    fontSize: 10,
    color: '#38bdf8',
    fontWeight: '700'
  },
  dot: {
    color: '#64748b',
    fontSize: 10
  },
  guardGps: {
    fontSize: 10,
    color: '#64748b'
  },
  incidentCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 10
  },
  incidentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  incidentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  incidentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc'
  },
  sevBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  sevBadgeText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800'
  },
  incidentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 8
  },
  incidentSite: {
    fontSize: 11,
    color: '#64748b'
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  resolveButtonText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800'
  }
});
