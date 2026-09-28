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
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Dimensions, Platform, Animated
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useApp, formatTime, formatDate } from '../../context/AppContext';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, GR, card, SCREEN } from '../../ds';
import { ChevronLeft, ChevronRight, X, Clock, CheckCircle, AlertTriangle, Radio } from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const PATH_W  = SCREEN_W - 40;   // canvas width
const NODE_R  = 22;               // node circle radius
const V_STEP  = 110;              // vertical distance between nodes
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Tactical Status Tokens ─────────────────────────────────────────────────────
const STATUS = {
  yes:      { color: P.ok,      bg: P.okSubtle,      label: 'Verified Safe', icon: '✓' },
  missed:   { color: P.danger,  bg: P.dangerSubtle,  label: 'Missed SLA',    icon: '✗' },
  no:       { color: P.warn,    bg: P.warnSubtle,    label: 'Issue Noted',   icon: '!' },
  upcoming: { color: P.t3,      bg: 'transparent',   label: 'Scheduled',     icon: '·' },
  pending:  { color: P.blueLight, bg: P.blueSubtle,  label: 'Responding…',   icon: '⏳' },
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

  // ── Animations: Path Draw-in & Active Beacon Pulse ────────────────────────
  const pathFadeAnim = useRef(new Animated.Value(0)).current;
  const pathSlideAnim = useRef(new Animated.Value(20)).current;
  const beaconPulse = useRef(new Animated.Value(1)).current;

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

  useEffect(() => {
    pathFadeAnim.setValue(0);
    pathSlideAnim.setValue(18);
    Animated.parallel([
      Animated.timing(pathFadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(pathSlideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [sessionIdx, nodes.length]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beaconPulse, { toValue: 1.25, duration: 900, useNativeDriver: false }),
        Animated.timing(beaconPulse, { toValue: 1.0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Compute SVG geometry ──────────────────────────────────────────────────
  const svgHeight = Math.max(420, nodes.length * V_STEP + 80);

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <X color={P.t3} size={20} />
          </TouchableOpacity>
        ) : null
      } />

      <View style={styles.content}>
        {/* Guard info row */}
        <View style={styles.guardRow}>
          <View>
            <Text style={styles.guardName}>{targetUser.name}</Text>
            <Text style={styles.guardSub}>{targetUser.badgeNumber || 'Officer'} · {site?.name || 'Assigned Site'}</Text>
          </View>
          {isCurrentShift && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTxt}>LIVE DUTY</Text>
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
              <ChevronLeft color={P.t2} size={18} />
            </TouchableOpacity>

            <View style={styles.sessionInfo}>
              <Text style={styles.sessionDate}>
                {session ? formatDate(session.bookedOnAt) : 'No session'}
              </Text>
              <Text style={styles.sessionTime}>
                {session
                  ? `${formatTime(session.bookedOnAt)} – ${session.bookedOffAt ? formatTime(session.bookedOffAt) : 'Ongoing Shift'}`
                  : '—'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setSessionIdx(i => Math.max(i - 1, 0))}
              disabled={sessionIdx <= 0}
              style={[styles.navBtn, sessionIdx <= 0 && styles.navBtnDisabled]}
            >
              <ChevronRight color={P.t2} size={18} />
            </TouchableOpacity>
          </View>
        ) : null}

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

      {/* Winding SVG path with subtle draw-in motion */}
      {nodes.length > 0 ? (
        <Animated.View style={{ flex: 1, opacity: pathFadeAnim, transform: [{ translateY: pathSlideAnim }] }}>
          <ScrollView
            style={styles.svgScroll}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <Svg width={PATH_W} height={svgHeight}>
              <Defs>
                <LinearGradient id="pathGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={P.blueLight} stopOpacity="0.75" />
                  <Stop offset="1" stopColor={P.blue} stopOpacity="0.18" />
                </LinearGradient>
              </Defs>

              {/* Trail path with subtle glow */}
              <Path
                d={pathD}
                stroke={P.blueBorder}
                strokeWidth={10}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.3}
              />
              <Path
                d={pathD}
                stroke="url(#pathGrad)"
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Nodes */}
              {nodes.map((node, i) => {
                const { x, y } = points[i];
                const st = statusFor(node.cc);
                const isUpcoming = node.isUpcoming;
                const labelRight = x < PATH_W / 2;

                return (
                  <React.Fragment key={node.id}>
                    {/* Glowing radar beacon for active / next pending node */}
                    {(node.isActive || (!node.cc && !node.isUpcoming)) && (
                      <AnimatedCircle
                        cx={x} cy={y}
                        r={beaconPulse.interpolate({ inputRange: [1, 1.25], outputRange: [NODE_R + 7, NODE_R + 13] })}
                        fill="none"
                        stroke={P.blueLight}
                        strokeWidth={2}
                        opacity={beaconPulse.interpolate({ inputRange: [1, 1.25], outputRange: [0.55, 0.12] })}
                      />
                    )}

                    {/* Outer ring */}
                    <Circle
                      cx={x} cy={y} r={NODE_R}
                      fill={isUpcoming ? P.bg2 : st.bg}
                      stroke={isUpcoming ? P.b2 : st.color}
                      strokeWidth={isUpcoming ? 1.5 : 2.8}
                      onPress={() => setDetailNode(node)}
                    />

                    {/* Center Icon / sequence */}
                    <Text
                      style={{
                        position: 'absolute',
                        left: x - NODE_R,
                        top: y - 10,
                        width: NODE_R * 2,
                        textAlign: 'center',
                        fontSize: 14,
                        fontWeight: '800',
                        color: isUpcoming ? P.t3 : st.color,
                      }}
                    >
                      {isUpcoming ? node.seq : st.icon}
                    </Text>

                    {/* Time label */}
                    <Text
                      style={[
                        styles.nodeTimeLabel,
                        labelRight
                          ? { left: x + NODE_R + 10, top: y - 22, textAlign: 'left' }
                          : { right: PATH_W - x + NODE_R + 10, top: y - 22, textAlign: 'right' },
                      ]}
                    >
                      {formatTime(node.slotTime)}
                    </Text>

                    {/* Status label */}
                    <Text
                      style={[
                        styles.nodeStatusLabel,
                        labelRight
                          ? { left: x + NODE_R + 10, top: y + 2, textAlign: 'left' }
                          : { right: PATH_W - x + NODE_R + 10, top: y + 2, textAlign: 'right' },
                        { color: isUpcoming ? P.t4 : st.color },
                      ]}
                    >
                      {st.label}
                    </Text>
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Tactical Legend */}
            <View style={styles.legend}>
              {Object.entries(STATUS).filter(([k]) => k !== 'pending').map(([k, s]) => (
                <View key={k} style={styles.legendItem}>
                  <View style={[styles.legendDot, {
                    backgroundColor: k === 'upcoming' ? 'transparent' : s.color,
                    borderWidth: k === 'upcoming' ? 1.5 : 0,
                    borderColor: s.color,
                  }]} />
                  <Text style={styles.legendLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      ) : (
        <EmptyState
          icon="radar"
          title={guardSessions.length === 0 ? "No Shift History Recorded" : "Shift Check Calls Pending"}
          message={guardSessions.length === 0
            ? "Historical check call routes will be rendered along this timeline once shifts are completed."
            : "Hourly check call prompts will initiate 60 minutes after book-on."}
          style={{ marginTop: SP.px48 }}
        />
      )}

      {/* Node detail modal */}
      <Modal visible={!!detailNode} transparent animationType="fade" onRequestClose={() => setDetailNode(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {detailNode && (() => {
              const st = statusFor(detailNode.cc);
              const isActive = detailNode.isActive && !readOnly && activeCheckCall;
              return (
                <>
                  <View style={styles.modalHeader}>
                    <View style={[styles.modalStatusDot, { backgroundColor: st.color }]} />
                    <Text style={styles.modalTitle}>Check Call Station #{detailNode.seq}</Text>
                    <TouchableOpacity onPress={() => setDetailNode(null)}>
                      <X color={P.t3} size={20} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalSubTime}>Scheduled window: {formatTime(detailNode.slotTime)}</Text>

                  <View style={[styles.modalStatusBadge, { backgroundColor: st.bg, borderColor: st.color }]}>
                    <Text style={[styles.modalStatusText, { color: st.color }]}>{st.label}</Text>
                  </View>

                  {detailNode.cc?.respondedAt && (
                    <Text style={styles.modalDetail}>
                      Recorded: {formatTime(detailNode.cc.respondedAt)} · Verified on-site
                    </Text>
                  )}

                  {detailNode.note && (
                    <View style={styles.noteBox}>
                      <AlertTriangle color={P.warn} size={15} />
                      <Text style={styles.noteText}>{detailNode.note}</Text>
                    </View>
                  )}

                  {/* Live response buttons if this is the active check call */}
                  {isActive && (
                    <View style={styles.respondRow}>
                      <Text style={styles.respondPrompt}>Is everything secure on site?</Text>
                      <View style={styles.respondBtns}>
                        <TouchableOpacity
                          style={[styles.yesBtn, responding && styles.disabled]}
                          onPress={() => handleRespond('yes')}
                          disabled={responding}
                        >
                          <CheckCircle color="#fff" size={16} />
                          <Text style={styles.yesBtnTxt}>Verified Safe</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.noBtn, responding && styles.disabled]}
                          onPress={() => handleRespond('no')}
                          disabled={responding}
                        >
                          <AlertTriangle color="#fff" size={16} />
                          <Text style={styles.noBtnTxt}>Report Issue</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailNode(null)}>
                    <Text style={styles.closeBtnTxt}>Dismiss</Text>
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
  root:           { flex: 1, backgroundColor: P.bg0 },
  backBtn:        { padding: SP.px8 },
  content:        { paddingHorizontal: SP.px16 },
  guardRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SP.px12, marginBottom: SP.px8 },
  guardName:      { ...FONT.h3, color: P.t1 },
  guardSub:       { ...FONT.caption, color: P.t3, marginTop: 2 },
  livePill:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.okSubtle, borderRadius: BR.full, paddingHorizontal: SP.px12, paddingVertical: 4, borderWidth: 1, borderColor: P.okBorder },
  liveDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: P.ok },
  liveTxt:        { color: P.ok, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  sessionNav:     { flexDirection: 'row', alignItems: 'center', backgroundColor: P.bg2, borderRadius: BR.md, borderWidth: 1, borderColor: P.b2, marginBottom: SP.px12, marginTop: SP.px4 },
  navBtn:         { padding: SP.px12 },
  navBtnDisabled: { opacity: 0.25 },
  sessionInfo:    { flex: 1, alignItems: 'center', paddingVertical: SP.px8 },
  sessionDate:    { color: P.t1, fontSize: 13, fontWeight: '700' },
  sessionTime:    { color: P.t3, fontSize: 11, marginTop: 2 },
  statsBar:       { flexDirection: 'row', gap: SP.px8, marginBottom: SP.px12 },
  statItem:       { flex: 1, backgroundColor: P.bg2, borderRadius: BR.sm, padding: SP.px12, alignItems: 'center', borderWidth: 1, borderColor: P.b1 },
  statVal:        { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel:      { color: P.t3, fontSize: 9, marginTop: 2, textAlign: 'center', fontWeight: '700', textTransform: 'uppercase' },
  svgScroll:      { flex: 1 },
  nodeTimeLabel:  { position: 'absolute', color: P.t2, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  nodeStatusLabel:{ position: 'absolute', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  legend:         { flexDirection: 'row', justifyContent: 'center', gap: SP.px20, marginTop: SP.px20, paddingVertical: SP.px16, borderTopWidth: 1, borderTopColor: P.b1 },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:      { width: 9, height: 9, borderRadius: 5 },
  legendLabel:    { color: P.t3, fontSize: 11, fontWeight: '600' },
  modalOverlay:   { flex: 1, backgroundColor: P.overlay, justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: P.bg2, borderTopLeftRadius: BR.xxl, borderTopRightRadius: BR.xxl, padding: SP.px24, borderWidth: 1, borderColor: P.b3, ...SH_TOKENS.lg },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  modalStatusDot: { width: 10, height: 10, borderRadius: 5 },
  modalTitle:     { color: P.t1, fontSize: 18, fontWeight: '800', flex: 1 },
  modalSubTime:   { color: P.t3, fontSize: 12, marginBottom: SP.px12 },
  modalStatusBadge:{ alignSelf: 'flex-start', borderRadius: BR.sm, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, marginBottom: SP.px12 },
  modalStatusText:{ fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  modalDetail:    { color: P.t2, fontSize: 13, marginBottom: SP.px8 },
  noteBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: P.warnSubtle, borderRadius: BR.sm, padding: 12, marginBottom: SP.px16, borderWidth: 1, borderColor: P.warnBorder },
  noteText:       { color: P.warn, fontSize: 13, flex: 1, lineHeight: 18 },
  respondRow:     { marginBottom: SP.px16 },
  respondPrompt:  { color: P.t2, fontSize: 14, marginBottom: 10 },
  respondBtns:    { flexDirection: 'row', gap: 10 },
  yesBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: P.ok, borderRadius: BR.md, paddingVertical: 13, ...SH_TOKENS.ok },
  yesBtnTxt:      { color: '#fff', fontSize: 14, fontWeight: '800' },
  noBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: P.danger, borderRadius: BR.md, paddingVertical: 13, ...SH_TOKENS.danger },
  noBtnTxt:       { color: '#fff', fontSize: 14, fontWeight: '800' },
  disabled:       { opacity: 0.6 },
  closeBtn:       { backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: P.b2 },
  closeBtnTxt:    { color: P.t2, fontSize: 14, fontWeight: '700' },
});
