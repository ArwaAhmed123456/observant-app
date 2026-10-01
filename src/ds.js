/**
 * ═══════════════════════════════════════════════════════════════
 *  OBSERVANT SECURITY — TACTICAL COMMAND CENTER DESIGN SYSTEM
 *  Single source of truth. Every screen imports from here.
 *
 *  Brand colors extracted from the Observant Security badge logo:
 *    Royal Blue  #1B4FBE  (circular field)
 *    Crimson     #C8232C  (hexagon badge)
 *    Gold        #C9A84C  (laurel wreath)
 *    Porcelain   #F5F7FA  (app canvas)
 *    White       #FFFFFF  (surface)
 * ═══════════════════════════════════════════════════════════════
 */

import { Dimensions, Platform } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── 1. PALETTE ───────────────────────────────────────────────────────────────

export const P = {
  // ── Background scale (light, high-contrast operations UI)
  bg0: '#FFFFFF',   // white app canvas
  bg1: '#FFFFFF',   // screen surface
  bg2: '#FFFFFF',   // card
  bg3: '#F8FAFC',   // light card / input
  bg4: '#E8EDF4',   // active / pressed state

  // ── Brand — Royal Blue (logo circular field)
  blue:       '#1B4FBE',
  blueDark:   '#143A92',
  blueLight:  '#2D65D4',
  blueGlow:   'rgba(27,79,190,0.22)',
  blueBorder: 'rgba(27,79,190,0.40)',
  blueSubtle: 'rgba(27,79,190,0.10)',

  // ── Brand — Crimson (logo hexagon)
  red:        '#C8232C',
  redDark:    '#9E1B22',
  redLight:   '#E03039',
  redGlow:    'rgba(200,35,44,0.22)',
  redBorder:  'rgba(200,35,44,0.40)',
  redSubtle:  'rgba(200,35,44,0.10)',

  // ── Brand — Gold (laurel wreath)
  gold:       '#C9A84C',
  goldDark:   '#9E7E34',
  goldLight:  '#E2BC5C',
  goldGlow:   'rgba(201,168,76,0.22)',
  goldBorder: 'rgba(201,168,76,0.40)',
  goldSubtle: 'rgba(201,168,76,0.10)',

  // ── Status (used consistently everywhere)
  ok:         '#22C55E',   // green — safe / completed / okay
  okDark:     '#16A34A',
  okGlow:     'rgba(34,197,94,0.20)',
  okBorder:   'rgba(34,197,94,0.35)',
  okSubtle:   'rgba(34,197,94,0.10)',

  warn:       '#F59E0B',   // amber — warning / issue / late
  warnDark:   '#D97706',
  warnGlow:   'rgba(245,158,11,0.20)',
  warnBorder: 'rgba(245,158,11,0.35)',
  warnSubtle: 'rgba(245,158,11,0.10)',

  danger:     '#EF4444',   // red — critical / missed / SOS
  dangerDark: '#DC2626',
  dangerGlow: 'rgba(239,68,68,0.25)',
  dangerBorder:'rgba(239,68,68,0.40)',
  dangerSubtle:'rgba(239,68,68,0.12)',

  info:       '#1B4FBE',   // logo blue — informational
  infoDark:   '#143A92',
  infoGlow:   'rgba(27,79,190,0.14)',
  infoBorder: 'rgba(27,79,190,0.20)',
  infoSubtle: 'rgba(27,79,190,0.08)',

  // ── Text scale
  t1: '#142033',   // primary — deep blue-black
  t2: '#46546A',   // secondary
  t3: '#68768B',   // muted
  t4: '#8A96A8',   // disabled / placeholder

  // ── Borders
  b1: '#E9EDF3',   // hairline
  b2: '#DCE3EC',   // subtle border
  b3: '#C5CFDC',   // visible border

  // ── Utility
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
  overlay:     'rgba(15,23,42,0.50)',
  overlayLight:'rgba(15,23,42,0.30)',
};

// ─── 2. SPACING (8px grid) ───────────────────────────────────────────────────

export const SP = {
  px2:  2,
  px4:  4,
  px8:  8,
  px12: 12,
  px16: 16,
  px20: 20,
  px24: 24,
  px32: 32,
  px40: 40,
  px48: 48,
  px64: 64,
};

// ─── 3. BORDER RADIUS ────────────────────────────────────────────────────────

export const BR = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   22,
  xxl:  28,
  full: 9999,
};

// ─── 4. TYPE SCALE ───────────────────────────────────────────────────────────
// Geometric sans — system font stack closest to Inter/Manrope on each platform

export const FONT = {
  // Display numerals (clock, big stats)
  display: {
    fontSize: 48,
    fontWeight: '800',
    color: P.t1,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  // Hero headings
  h1: { fontSize: 28, fontWeight: '800', color: P.t1, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800', color: P.t1, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700', color: P.t1 },
  h4: { fontSize: 15, fontWeight: '700', color: P.t1 },
  // Body
  body1: { fontSize: 14, fontWeight: '400', color: P.t2, lineHeight: 20 },
  body2: { fontSize: 13, fontWeight: '400', color: P.t2, lineHeight: 19 },
  // UI labels
  label: { fontSize: 11, fontWeight: '700', color: P.t3, textTransform: 'uppercase', letterSpacing: 0.8 },
  caption: { fontSize: 11, fontWeight: '500', color: P.t3 },
  // Badge / pill text
  badge: { fontSize: 9,  fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  // Mono (times, IDs)
  mono: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: P.t2,
    fontVariant: ['tabular-nums'],
  },
  monoLg: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: P.t1,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
};

// ─── 5. SHADOWS ──────────────────────────────────────────────────────────────

export const SH_TOKENS = {
  none: {},
  xs: {
    shadowColor: '#0B192C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.035,
    shadowRadius: 3,
    elevation: 0,
  },
  sm: {
    shadowColor: '#0B192C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 0,
  },
  md: {
    shadowColor: '#0B192C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.045,
    shadowRadius: 6,
    elevation: 0,
  },
  lg: {
    shadowColor: '#0B192C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 0,
  },
  // Colored glows
  blue: {
    shadowColor: P.blue,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.035,
    shadowRadius: 2,
    elevation: 0,
  },
  gold: {
    shadowColor: P.gold,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.035,
    shadowRadius: 2,
    elevation: 0,
  },
  ok: {
    shadowColor: P.ok,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.035,
    shadowRadius: 2,
    elevation: 0,
  },
  danger: {
    shadowColor: P.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 1,
  },
  warn: {
    shadowColor: P.warn,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.035,
    shadowRadius: 2,
    elevation: 0,
  },
};

// ─── 6. GRADIENTS (for LinearGradient / inline style references) ─────────────

export const GR = {
  // Screen background (subtle top-of-screen blue tint fading to pure dark)
  screenBg:   ['#FFFFFF', '#F4F6FA'],

  // Card base
  card:       ['#FFFFFF', '#F8FAFC'],
  cardHover:  ['#FFFFFF', '#F1F4F8'],

  // Blue brand
  blue:       [P.blueLight, P.blueDark],
  blueSubtle: ['rgba(27,79,190,0.10)', 'rgba(27,79,190,0.02)'],

  // Gold
  gold:       [P.goldLight, P.goldDark],
  goldSubtle: ['rgba(201,168,76,0.18)', 'rgba(201,168,76,0.04)'],

  // Crimson
  red:        [P.redLight,  P.redDark],
  redSubtle:  ['rgba(200,35,44,0.18)',  'rgba(200,35,44,0.04)'],

  // Status
  ok:         ['#22C55E', '#16A34A'],
  warn:       ['#F59E0B', '#D97706'],
  danger:     ['#EF4444', '#DC2626'],
  dangerFull: ['#FF2D55', '#C8232C'],   // SOS — more vivid

  // Live shift clock glow overlay
  clockGlow:  ['rgba(27,79,190,0.0)', 'rgba(27,79,190,0.28)', 'rgba(27,79,190,0.0)'],

  // Header bar
  header:     ['#FFFFFF', '#F7F9FC'],
};

// ─── 7. ANIMATION CONFIGS ────────────────────────────────────────────────────

export const ANIM = {
  fast:    { duration: 150, useNativeDriver: true },
  normal:  { duration: 280, useNativeDriver: true },
  slow:    { duration: 500, useNativeDriver: true },
  spring:  { friction: 8, tension: 40, useNativeDriver: true },
  springFast: { friction: 10, tension: 80, useNativeDriver: true },
  // Pulse loop config
  pulse: { toValue: 1.08, duration: 900, useNativeDriver: true },
  // Shake sequence offsets
  shakeOffsets: [10, -10, 8, -8, 5, -5, 0],
};

// ─── 8. COMPONENT TOKENS ─────────────────────────────────────────────────────

// Standard card
export const card = {
  backgroundColor: P.bg2,
  borderRadius: BR.lg,
  borderWidth: 1,
  borderColor: P.b2,
  ...SH_TOKENS.sm,
};

// Elevated card (modals, overlays)
export const cardElevated = {
  backgroundColor: P.bg3,
  borderRadius: BR.xl,
  borderWidth: 1,
  borderColor: P.b3,
  ...SH_TOKENS.md,
};

// Input field
export const input = {
  backgroundColor: P.bg3,
  borderWidth: 1,
  borderColor: P.b2,
  borderRadius: BR.sm,
  paddingHorizontal: SP.px16,
  paddingVertical: SP.px12,
  color: P.t1,
  fontSize: 15,
};

// Primary CTA button
export const btnPrimary = {
  backgroundColor: P.blue,
  borderRadius: BR.md,
  paddingVertical: 15,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
  ...SH_TOKENS.blue,
};

export const btnPrimaryText = {
  color: P.white,
  fontSize: 15,
  fontWeight: '700',
  letterSpacing: 0.3,
};

// Gold accent button (publish, confirm important actions)
export const btnGold = {
  backgroundColor: P.gold,
  borderRadius: BR.md,
  paddingVertical: 15,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
  ...SH_TOKENS.gold,
};

// Danger button
export const btnDanger = {
  backgroundColor: P.danger,
  borderRadius: BR.md,
  paddingVertical: 15,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
  ...SH_TOKENS.danger,
};

// Ghost button
export const btnGhost = {
  backgroundColor: P.bg3,
  borderWidth: 1,
  borderColor: P.b3,
  borderRadius: BR.md,
  paddingVertical: 13,
  alignItems: 'center',
};

// Status pill config
export const STATUS = {
  ok:       { color: P.ok,     bg: P.okSubtle,     border: P.okBorder,     label: 'OKAY',    dot: P.ok     },
  warn:     { color: P.warn,   bg: P.warnSubtle,   border: P.warnBorder,   label: 'WARNING', dot: P.warn   },
  danger:   { color: P.danger, bg: P.dangerSubtle, border: P.dangerBorder, label: 'MISSED',  dot: P.danger },
  sos:      { color: P.red,    bg: P.redSubtle,    border: P.redBorder,    label: 'SOS',     dot: P.red    },
  info:     { color: P.info,   bg: P.infoSubtle,   border: P.infoBorder,   label: 'INFO',    dot: P.info   },
  gold:     { color: P.gold,   bg: P.goldSubtle,   border: P.goldBorder,   label: 'ACTIVE',  dot: P.gold   },
  upcoming: { color: P.t3,     bg: '#F1F4F8', border: P.b2,    label: 'UPCOMING',dot: P.t4     },
};

// Screen dimensions helper
export const SCREEN = { W: SW, H: SH };

// Header safe area
export const HEADER_PT = Platform.OS === 'ios' ? 54 : 48;

// Tab bar height
export const TAB_H = Platform.OS === 'ios' ? 82 : 64;

// ─── 9. LOGO & ASSETS ────────────────────────────────────────────────────────

export const LOGO = require('../assets/logo.png');
export const LOGO_SIZES = {
  sm:     { width: 44,  height: 44  },
  header: { width: 44,  height: 44  },   // badge-style square in header
  login:  { width: 120, height: 120 },   // large badge on login
  splash: { width: 160, height: 160 },
};

// ─── 10. STATUS HELPERS ──────────────────────────────────────────────────────

export function statusToken(response) {
  switch (response) {
    case 'yes':      return STATUS.ok;
    case 'no':       return STATUS.warn;
    case 'missed':   return STATUS.danger;
    case 'sos':      return STATUS.sos;
    case 'upcoming': return STATUS.upcoming;
    default:         return STATUS.info;
  }
}

export function guardStatusToken(active, hasIssue) {
  if (!active) return STATUS.upcoming;
  if (hasIssue) return STATUS.warn;
  return STATUS.ok;
}
