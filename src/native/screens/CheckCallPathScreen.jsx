/**
 * CheckCallPathScreen
 * Shows a guard's check calls for a shift as a winding SVG path
 * with coloured circular nodes — like a level-progress map.
 *
 * Used by: Guard (their own shifts) + Manager (view any guard's shift)
 * Props:
 *   guardId  – whose check calls to show (defaults to currentUser.id)
 *   readOnly – hide the "respond" actions (manager view)
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Dimensions, Platform
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useApp, formatTime, formatDate } from '../../context/AppContext';
import { AppHeader } from '../components/AppHeader';
import { T } from '../../theme';
import { ChevronLeft, ChevronRight, X, Clock, CheckCircle, AlertTriangle, Minus } from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const PATH_W  = SCREEN_W - 40;   // canvas width
const NODE_R  = 22;               // node circle radius
const V_STEP  = 110;              // vertical distance between nodes

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  yes:      { color: T.ok,      bg: T.okBg,      label: 'Okay',        icon: '✓' },
  missed:   { color: T.missed,  bg: T.missedBg,  label: 'Missed',      icon: '✗' },
  no:       { color: T.issue,   bg: T.issueBg,   label: 'Issue noted', icon: '!' },
  upcoming: { color: T.upcoming,bg: 'transparent',label: 'Upcoming',    icon: '·' },
  pending:  { color: '#1d4ed8', bg: 'rgba(29,78,216,0.12)', label: 'Responding…', icon: '⏳' },
};

function statusFor(cc) {
  if (!cc) return STATUS.upcoming;
  if (cc.response === 'yes')    return STATUS.yes;
  if (cc.response === 'missed') return STATUS.missed;
  if (cc.response === 'no')     return STATUS.no;
  return STATUS.pending;
}

// Build a winding cubic-bezier SVG path through an array of {x,y} points
function buildWindingPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cy   = (prev.y + curr.y) / 2;
    // Control points mirror x for smooth S-curve
    d += ` C ${prev.x} ${cy}, ${curr.x} ${cy}, ${curr.x} ${curr.y}`;
  }
  return d;
}

// Compute winding x positions: alternate left / center-right / right / center-left
function nodeX(index, total) {
  const margin = NODE_R + 30;
  const right  = PATH_W - NODE_R - 30;
  const mid    = PATH_W / 2;
  const positions = [
    right,
    margin + (mid - margin) * 0.35,
    margin,
    margin + (mid - margin) * 0.35 + (right - mid) * 0.5,
  ];
  return positions[index % 4];
}

export function CheckCallPathScreen({ route, navigation }) {
  const guardId  = route?.params?.guardId;
  const readOnly = route?.params?.readOnly ?? false;

  const {
    currentUser, users, sites, shiftSessions, checkCalls,
    rosters, activeCheckCall, respondToCheckCall,
  } = useApp();

  const targetId   = guardId || currentUser.id;
  const targetUser = users.find(u => u.id === targetId) || currentUser;
  const site       = sites.find(s => s.id === targetUser.siteId);

  // ── Shift selector ────────────────────────────────────────────────────────
  const guardSessions = useMemo(() =>
    [...shiftSessions]
      .filter(s => s.guardId === targetId)
      .sort((a, b) => new Date(b.bookedOnAt) - new Date(a.bookedOnAt)),
    [shiftSessions, targetId]
  );

  const [sessionIdx, setSessionIdx] = useState(0);
  const session = guardSessions[sessionIdx] || null;

  // ── Build hourly node list from session ───────────────────────────────────
  const nodes = useMemo(() => {
    if (!session) return [];

    const start = new Date(session.bookedOnAt);
    const end   = session.bookedOffAt
      ? new Date(session.bookedOffAt)
      : session.scheduledEnd
        ? (() => {
            const [h, m] = session.scheduledEnd.split(':').map(Number);
            const d = new Date(start);
            d.setHours(h, m, 0, 0);
            if (d <= start) d.setDate(d.getDate() + 1);
            return d;
          })()
        : new Date(start.getTime() + 12 * 3600000); // default 12h shift

    // First check call is 1h after book-on, then every hour
    const slots = [];
    const firstSlot = new Date(start.getTime() + 3600000);
    firstSlot.setSeconds(0, 0);

    let slot = new Date(firstSlot);
    while (slot <= end) {
      slots.push(new Date(slot));
      slot = new Date(slot.getTime() + 3600000);
    }

    const sessionCCs = checkCalls.filter(cc => cc.sessionId === session.id);

    return slots.map((slotTime, i) => {
      const windowEnd = new Date(slotTime.getTime() + 10 * 60000);
      const matched = sessionCCs.find(cc => {
        const fired = new Date(cc.firedAt);
        return Math.abs(fired - slotTime) < 10 * 60000;
      });

      const isPast    = slotTime < new Date();
      const isActive  = !matched && isPast && new Date() < windowEnd;
      const isUpcoming = !matched && !isPast;

      return {
        id:       matched?.id || `slot_${i}`,
        slotTime,
        cc:       matched || null,
        response: matched?.response || (isUpcoming ? 'upcoming' : isActive ? 'pending' : 'missed'),
        note:     matched?.note || null,
        seq:      i + 1,
        isActive,
        isUpcoming,
      };
    });
  }, [session, checkCalls]);

  // ── Compute SVG geometry ──────────────────────────────────────────────────
  const svgHeight = Math.max(400, nodes.length * V_STEP + 80);

  const points = nodes.map((n, i) => ({
    x: nodeX(i, nodes.length),
    y: 60 + i * V_STEP,
  }));

  const pathD = buildWindingPath(points);

  // ── Detail modal ──────────────────────────────────────────────────────────
  const [detailNode, setDetailNode] = useState(null);
  const [noteInput, setNoteInput]   = useState('');
  const [responding, setResponding] = useState(false);

  const handleRespond = async (response) => {
    if (!activeCheckCall) return;
    setResponding(true);
    await respondToCheckCall(activeCheckCall.id, response, noteInput || null);
    setResponding(false);
    setDetailNode(null);
    setNoteInput('');
  };

  const isCurrentShift = session && !session.bookedOffAt;

  return (
    <View style={styles.root}>
      <AppHeader right={
        navigation ? (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <X color={T.textMuted} size={20} />
          </TouchableOpacity>
        ) : null
      } />

      <View style={styles.content}>
        {/* Guard info row */}
        <View style={styles.guardRow}>
          <View>
            <Text style={styles.guardName}>{targetUser.name}</Text>
            <Text style={styles.guardSub}>{targetUser.badgeNumber} · {site?.name || '—'}</Text>
          </View>
          {isCurrentShift && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTxt}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Session selector */}
        {guardSessions.length > 0 ? (
          <View style={styles.sessionNav}>
            <TouchableOpacity
              onPress={() => setSessionIdx(i => Math.min(i + 1, guardSessions.length - 1))}
              disabled={sessionIdx >= guardSessions.length - 1}
              style={[styles.navBtn, sessionIdx >= guardSessions.length - 1 && styles.navBtnDisabled]}
            >
              <ChevronLeft color={T.textSecondary} size={18} />
            </TouchableOpacity>

            <View style={styles.sessionInfo}>
              <Text style={styles.sessionDate}>
                {session ? formatDate(session.bookedOnAt) : 'No session'}
              </Text>
              <Text style={styles.sessionTime}>
                {session
                  ? `${formatTime(session.bookedOnAt)} – ${session.bookedOffAt ? formatTime(session.bookedOffAt) : 'ongoing'}`
                  : '—'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setSessionIdx(i => Math.max(i - 1, 0))}
              disabled={sessionIdx <= 0}
              style={[styles.navBtn, sessionIdx <= 0 && styles.navBtnDisabled]}
            >
              <ChevronRight color={T.textSecondary} size={18} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No shifts recorded yet</Text>
            <Text style={styles.emptySub}>Check calls will appear here once a shift is started.</Text>
          </View>
        )}

        {/* Stats bar */}
        {nodes.length > 0 && (
          <View style={styles.statsBar}>
            {['yes','missed','no','upcoming'].map(k => {
              const count = nodes.filter(n => n.response === k || (k === 'upcoming' && n.isUpcoming)).length;
              const s = STATUS[k];
              return (
                <View key={k} style={styles.statItem}>
                  <Text style={[styles.statVal, { color: s.color }]}>{count}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Winding SVG path */}
      {nodes.length > 0 ? (
        <ScrollView
          style={styles.svgScroll}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Svg width={PATH_W} height={svgHeight}>
            <Defs>
              <LinearGradient id="pathGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={T.brand} stopOpacity="0.6" />
                <Stop offset="1" stopColor={T.brand} stopOpacity="0.15" />
              </LinearGradient>
            </Defs>

            {/* Trail path */}
            <Path
              d={pathD}
              stroke="url(#pathGrad)"
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Nodes */}
            {nodes.map((node, i) => {
              const { x, y } = points[i];
              const st = statusFor(node.cc);
              const resp = node.response;
              const isUpcoming = node.isUpcoming;
              const labelRight = x < PATH_W / 2;

              return (
                <React.Fragment key={node.id}>
                  {/* Glow ring for active/pending */}
                  {node.isActive && (
                    <Circle cx={x} cy={y} r={NODE_R + 8}
                      fill="none" stroke="#1d4ed8" strokeWidth={2} opacity={0.5} />
                  )}

                  {/* Outer ring */}
                  <Circle
                    cx={x} cy={y} r={NODE_R}
                    fill={isUpcoming ? T.bgCard : st.bg}
                    stroke={isUpcoming ? T.borderMid : st.color}
                    strokeWidth={isUpcoming ? 2 : 3}
                    onPress={() => setDetailNode(node)}
                  />

                  {/* Icon / sequence */}
                  <Text
                    style={{
                      position: 'absolute',
                      left: x - NODE_R,
                      top: y - 10,
                      width: NODE_R * 2,
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: '800',
                      color: isUpcoming ? T.textMuted : st.color,
                    }}
                  >
                    {isUpcoming ? node.seq : st.icon}
                  </Text>

                  {/* Time label */}
                  <Text
                    style={[
                      styles.nodeTimeLabel,
                      labelRight
                        ? { left: x + NODE_R + 8, top: y - 22, textAlign: 'left' }
                        : { right: PATH_W - x + NODE_R + 8, top: y - 22, textAlign: 'right' },
                    ]}
                  >
                    {formatTime(node.slotTime)}
                  </Text>

                  {/* Status label */}
                  <Text
                    style={[
                      styles.nodeStatusLabel,
                      labelRight
                        ? { left: x + NODE_R + 8, top: y + 2, textAlign: 'left' }
                        : { right: PATH_W - x + NODE_R + 8, top: y + 2, textAlign: 'right' },
                      { color: isUpcoming ? T.textDisabled : st.color },
                    ]}
                  >
                    {st.label}
                  </Text>
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Legend */}
          <View style={styles.legend}>
            {Object.entries(STATUS).filter(([k]) => k !== 'pending').map(([k, s]) => (
              <View key={k} style={styles.legendItem}>
                <View style={[styles.legendDot, {
                  backgroundColor: k === 'upcoming' ? 'transparent' : s.color,
                  borderWidth: k === 'upcoming' ? 2 : 0,
                  borderColor: s.color,
                }]} />
                <Text style={styles.legendLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        guardSessions.length > 0 && (
          <View style={styles.noNodesState}>
            <Clock color={T.borderMid} size={40} />
            <Text style={styles.noNodesTitle}>No check calls yet this shift</Text>
            <Text style={styles.noNodesSub}>Check calls begin 1 hour after booking on.</Text>
          </View>
        )
      )}

      {/* Node detail modal */}
      <Modal visible={!!detailNode} transparent animationType="slide" onRequestClose={() => setDetailNode(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {detailNode && (() => {
              const st = statusFor(detailNode.cc);
              const isActive = detailNode.isActive && !readOnly && activeCheckCall;
              return (
                <>
                  <View style={styles.modalHeader}>
                    <View style={[styles.modalStatusDot, { backgroundColor: st.color }]} />
                    <Text style={styles.modalTitle}>Check Call #{detailNode.seq}</Text>
                    <TouchableOpacity onPress={() => setDetailNode(null)}>
                      <X color={T.textMuted} size={20} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalSubTime}>{formatTime(detailNode.slotTime)}</Text>

                  <View style={[styles.modalStatusBadge, { backgroundColor: st.bg, borderColor: st.color }]}>
                    <Text style={[styles.modalStatusText, { color: st.color }]}>{st.label}</Text>
                  </View>

                  {detailNode.cc?.respondedAt && (
                    <Text style={styles.modalDetail}>
                      Responded at: {formatTime(detailNode.cc.respondedAt)}
                    </Text>
                  )}

                  {detailNode.note && (
                    <View style={styles.noteBox}>
                      <AlertTriangle color={T.issue} size={14} />
                      <Text style={styles.noteText}>{detailNode.note}</Text>
                    </View>
                  )}

                  {/* Live response buttons if this is the active check call */}
                  {isActive && (
                    <View style={styles.respondRow}>
                      <Text style={styles.respondPrompt}>Is everything okay?</Text>
                      <View style={styles.respondBtns}>
                        <TouchableOpacity
                          style={[styles.yesBtn, responding && styles.disabled]}
                          onPress={() => handleRespond('yes')}
                          disabled={responding}
                        >
                          <CheckCircle color="#fff" size={16} />
                          <Text style={styles.yesBtnTxt}>Yes, okay</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.noBtn, responding && styles.disabled]}
                          onPress={() => handleRespond('no')}
                          disabled={responding}
                        >
                          <AlertTriangle color="#fff" size={16} />
                          <Text style={styles.noBtnTxt}>No, issue</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailNode(null)}>
                    <Text style={styles.closeBtnTxt}>Close</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: T.bgRoot },
  content:        { paddingHorizontal: 20 },
  guardRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  guardName:      { color: T.textPrimary, fontSize: 17, fontWeight: '800' },
  guardSub:       { color: T.textMuted, fontSize: 12, marginTop: 2 },
  livePill:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.okBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.brandBorder },
  liveDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: T.ok },
  liveTxt:        { color: T.ok, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  sessionNav:     { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radiusMd, borderWidth: 1, borderColor: T.borderSubtle, marginBottom: 12, marginTop: 8 },
  navBtn:         { padding: 12 },
  navBtnDisabled: { opacity: 0.3 },
  sessionInfo:    { flex: 1, alignItems: 'center', paddingVertical: 8 },
  sessionDate:    { color: T.textPrimary, fontSize: 13, fontWeight: '700' },
  sessionTime:    { color: T.textMuted, fontSize: 12, marginTop: 2 },
  statsBar:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statItem:       { flex: 1, backgroundColor: T.bgCard, borderRadius: T.radiusSm, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: T.borderSubtle },
  statVal:        { fontSize: 18, fontWeight: '800' },
  statLabel:      { color: T.textMuted, fontSize: 9, marginTop: 2, textAlign: 'center' },
  svgScroll:      { flex: 1 },
  nodeTimeLabel:  { position: 'absolute', color: T.textSecondary, fontSize: 11, fontWeight: '700' },
  nodeStatusLabel:{ position: 'absolute', fontSize: 10, fontWeight: '600' },
  legend:         { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: T.borderSubtle },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:      { width: 10, height: 10, borderRadius: 5 },
  legendLabel:    { color: T.textSecondary, fontSize: 12 },
  emptyState:     { alignItems: 'center', paddingVertical: 48, gap: 8, paddingHorizontal: 20 },
  emptyTitle:     { color: T.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySub:       { color: T.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  noNodesState:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noNodesTitle:   { color: T.textPrimary, fontSize: 15, fontWeight: '700' },
  noNodesSub:     { color: T.textMuted, fontSize: 13, textAlign: 'center' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: T.bgCard, borderTopLeftRadius: T.radiusXl, borderTopRightRadius: T.radiusXl, padding: 24, borderWidth: 1, borderColor: T.borderSubtle },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  modalStatusDot: { width: 12, height: 12, borderRadius: 6 },
  modalTitle:     { color: T.textPrimary, fontSize: 18, fontWeight: '800', flex: 1 },
  modalSubTime:   { color: T.textMuted, fontSize: 13, marginBottom: 12 },
  modalStatusBadge:{ alignSelf: 'flex-start', borderRadius: T.radiusSm, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, marginBottom: 12 },
  modalStatusText:{ fontSize: 13, fontWeight: '800' },
  modalDetail:    { color: T.textSecondary, fontSize: 13, marginBottom: 8 },
  noteBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: T.issueBg, borderRadius: T.radiusSm, padding: 12, marginBottom: 16 },
  noteText:       { color: T.issue, fontSize: 13, flex: 1, lineHeight: 18 },
  respondRow:     { marginBottom: 16 },
  respondPrompt:  { color: T.textSecondary, fontSize: 14, marginBottom: 10 },
  respondBtns:    { flexDirection: 'row', gap: 10 },
  yesBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.ok, borderRadius: T.radiusSm + 2, paddingVertical: 12 },
  yesBtnTxt:      { color: '#fff', fontSize: 14, fontWeight: '800' },
  noBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.missed, borderRadius: T.radiusSm + 2, paddingVertical: 12 },
  noBtnTxt:       { color: '#fff', fontSize: 14, fontWeight: '800' },
  disabled:       { opacity: 0.6 },
  closeBtn:       { backgroundColor: T.bgInput, borderRadius: T.radiusMd, paddingVertical: 12, alignItems: 'center' },
  closeBtnTxt:    { color: T.textSecondary, fontSize: 14, fontWeight: '600' },
});
