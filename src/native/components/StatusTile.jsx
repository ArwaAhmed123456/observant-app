import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Clock, CheckCircle2, AlertTriangle, Shield, ChevronRight, ClipboardList } from 'lucide-react-native';
import { P, SP, BR, FONT, SH_TOKENS, card } from '../../ds';
import { formatTime } from '../../context/AppContext';

export function StatusTile({
  guard,
  active,
  session,
  site,
  todayCheckCalls = [],
  todayPatrols = [],
  latestCheckCall,
  latestPatrol: latestPatrolRecord,
  onPress,
  onManualLog,
  onReassignSite,
}) {
  const missedCount = todayCheckCalls.filter(cc => cc.response === 'missed').length;
  const issueCount = todayCheckCalls.filter(cc => cc.response === 'no').length;
  const completedCount = todayCheckCalls.filter(cc => cc.response === 'yes').length;
  const lastCC = latestCheckCall || [...todayCheckCalls].sort((a, b) => new Date(b.firedAt) - new Date(a.firedAt))[0];
  const lastPatrol = latestPatrolRecord || [...todayPatrols].sort((a, b) => new Date(b.finishedAt || b.startedAt) - new Date(a.finishedAt || a.startedAt))[0];
  const checkCallAt = lastCC?.respondedAt || lastCC?.firedAt;
  const patrolAt = lastPatrol?.finishedAt || lastPatrol?.startedAt;
  const lastActivity = checkCallAt && (!patrolAt || new Date(checkCallAt) >= new Date(patrolAt))
    ? { label: 'Check call', at: checkCallAt, color: lastCC.response === 'yes' ? P.ok : lastCC.response === 'missed' ? P.danger : P.warn }
    : patrolAt ? { label: 'Patrol', at: patrolAt, color: P.blueLight } : null;
  const finishedPatrols = todayPatrols.filter(p => p.finishedAt).length;

  // Determine accent color for the left-edge bar
  let accentColor = P.t4;
  let statusLabel = 'BOOKED OFF';
  let badgeBg = 'rgba(255,255,255,0.04)';
  let badgeBorder = P.b2;
  let statusTextColor = P.t3;

  if (active) {
    if (missedCount > 0) {
      accentColor = P.danger;
      statusLabel = 'ALERT / MISSED';
      badgeBg = P.dangerSubtle;
      badgeBorder = P.dangerBorder;
      statusTextColor = P.danger;
    } else if (issueCount > 0 || (session?.punctuality && !['on_time', 'unscheduled'].includes(session.punctuality))) {
      accentColor = P.warn;
      statusLabel = 'ATTENTION';
      badgeBg = P.warnSubtle;
      badgeBorder = P.warnBorder;
      statusTextColor = P.warn;
    } else {
      accentColor = P.ok;
      statusLabel = 'BOOKED ON';
      badgeBg = P.okSubtle;
      badgeBorder = P.okBorder;
      statusTextColor = P.ok;
    }
  }

  return (
    <TouchableOpacity
      style={styles.cardWrap}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <LinearGradient
        colors={active ? ['#FFFFFF', '#F4F6FA'] : ['#FFFFFF', '#F4F6FA']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* 4px Tactical Left-Edge Accent Bar */}
      <View style={[styles.leftAccentBar, { backgroundColor: accentColor }]} />

      <View style={styles.inner}>
        {/* Top Header Row */}
        <View style={styles.topRow}>
          <View style={styles.identityGroup}>
            <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
            <View>
              <Text style={styles.guardName} numberOfLines={1}>{guard.name}</Text>
              <Text style={styles.badgeNumber}>{guard.badgeNumber || 'ID: —'}</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
            <Text style={[styles.statusBadgeText, { color: statusTextColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Site Location */}
        <View style={styles.siteRow}>
          <MapPin size={12} color={P.blueLight} />
          <Text style={styles.siteText} numberOfLines={1}>
            {site?.name || 'Unassigned Site'}
          </Text>
        </View>

        {/* Shift Timing Details */}
        {active && session && (
          <View style={styles.timingRow}>
            <Clock size={11} color={P.t3} />
            <Text style={styles.timingText}>
              Booked on at <Text style={styles.highlightText}>{formatTime(session.bookedOnAt)}</Text>
              {session.punctuality && !['on_time', 'unscheduled'].includes(session.punctuality) && (
                <Text style={{ color: P.warn }}> · {session.punctuality.replace(/_/g, ' ')}</Text>
              )}
            </Text>
          </View>
        )}

        {/* Metric Telemetry Pills */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <CheckCircle2 size={11} color={missedCount > 0 ? P.danger : P.ok} />
            <Text style={styles.metricVal}>
              {completedCount}/{todayCheckCalls.length} <Text style={styles.metricSub}>calls</Text>
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Shield size={11} color={P.blueLight} />
            <Text style={styles.metricVal}>
              {finishedPatrols} <Text style={styles.metricSub}>patrols</Text>
            </Text>
          </View>

          {lastActivity && (
            <>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricSub}>Last {lastActivity.label.toLowerCase()}: </Text>
                <Text style={[styles.metricVal, { color: lastActivity.color }]}>
                  {formatTime(lastActivity.at)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Bottom Actions Row */}
        <View style={styles.footerRow}>
          <View style={styles.drilldownHint}>
            <Text style={styles.drilldownText}>Call path telemetry</Text>
            <ChevronRight size={13} color={P.t3} />
          </View>

          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {onReassignSite && (
              <TouchableOpacity
                style={styles.reassignBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onReassignSite(guard);
                }}
                activeOpacity={0.7}
              >
                <MapPin size={11} color="#D97706" />
                <Text style={styles.reassignBtnText}>Assign site</Text>
              </TouchableOpacity>
            )}

            {onManualLog && (
              <TouchableOpacity
                style={styles.manualBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onManualLog(guard);
                }}
                activeOpacity={0.7}
              >
                <ClipboardList size={11} color={P.blueLight} />
                <Text style={styles.manualBtnText}>Manual Log</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    borderRadius: BR.lg,
    borderWidth: 1,
    borderColor: P.b2,
    marginBottom: SP.px12,
    overflow: 'hidden',
    position: 'relative',
    ...SH_TOKENS.sm,
  },
  leftAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    zIndex: 2,
  },
  inner: {
    paddingLeft: SP.px16 + 4,
    paddingRight: SP.px16,
    paddingVertical: SP.px12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SP.px8,
  },
  identityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.px8,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  guardName: {
    ...FONT.h4,
    color: P.t1,
    fontSize: 15,
  },
  badgeNumber: {
    ...FONT.caption,
    color: P.t3,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: SP.px8,
    paddingVertical: 3,
    borderRadius: BR.sm,
    borderWidth: 1,
  },
  statusBadgeText: {
    ...FONT.badge,
    fontSize: 9,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SP.px8,
  },
  siteText: {
    ...FONT.body2,
    color: P.t2,
    fontSize: 12,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SP.px8,
  },
  timingText: {
    ...FONT.caption,
    color: P.t3,
    fontSize: 11,
  },
  highlightText: {
    color: P.t1,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.bg0,
    borderRadius: BR.sm,
    borderWidth: 1,
    borderColor: P.b1,
    paddingHorizontal: SP.px12,
    paddingVertical: SP.px8,
    marginBottom: SP.px12,
    gap: SP.px12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricVal: {
    ...FONT.mono,
    fontSize: 12,
    color: P.t1,
    fontWeight: '600',
  },
  metricSub: {
    color: P.t3,
    fontWeight: '400',
  },
  metricDivider: {
    width: 1,
    height: 12,
    backgroundColor: P.b2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  drilldownHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  drilldownText: {
    ...FONT.caption,
    color: P.t3,
    fontSize: 11,
  },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(27,79,190,0.12)',
    borderWidth: 1,
    borderColor: P.blueBorder,
    borderRadius: BR.sm,
    paddingHorizontal: SP.px12,
    paddingVertical: 4,
  },
  manualBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: P.blueLight,
  },
  reassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(217,119,6,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
    borderRadius: BR.sm,
    paddingHorizontal: SP.px12,
    paddingVertical: 4,
  },
  reassignBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
});
