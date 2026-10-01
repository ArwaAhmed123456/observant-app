/**
 * Observant Security — Tactical Command Center Design System
 * Single source of truth for all visual tokens.
 *
 * Brand colors extracted from logo:
 *   Deep Royal Blue:  #1B4FBE  (logo ring background)
 *   Crimson Red:      #C0272D  (logo hexagon)
 *   Champagne Gold:   #C9A84C  (laurel wreath)
 *
 * Usage:
 *   import { T, COLORS, S, R, TYPE, shadows, BRAND } from '../../theme';
 */

export const LOGO = require('../assets/logo.png');

// ─── Brand Palette (logo-derived) ────────────────────────────────────────────
export const BRAND = {
  // Royal Blue — primary brand identity
  blue:          '#1B4FBE',
  blueDark:      '#143A92',
  blueLight:     '#2D65D4',
  blueSubtle:    'rgba(27, 79, 190, 0.15)',
  blueBorder:    'rgba(27, 79, 190, 0.40)',
  blueGlow:      'rgba(27, 79, 190, 0.30)',

  // Crimson — authority / critical moments
  crimson:       '#C0272D',
  crimsonDark:   '#991F24',
  crimsonLight:  '#E03038',
  crimsonSubtle: 'rgba(192, 39, 45, 0.15)',
  crimsonBorder: 'rgba(192, 39, 45, 0.40)',
  crimsonGlow:   'rgba(192, 39, 45, 0.35)',

  // Champagne Gold — premium / achievements
  gold:          '#C9A84C',
  goldDark:      '#A88A38',
  goldLight:     '#E2C36A',
  goldSubtle:    'rgba(201, 168, 76, 0.15)',
  goldBorder:    'rgba(201, 168, 76, 0.35)',
  goldGlow:      'rgba(201, 168, 76, 0.25)',
};

// ─── Full Color System ────────────────────────────────────────────────────────
export const COLORS = {
  // Brand primaries (compat)
  brand:        '#1B4FBE',
  brandDark:    '#143A92',
  brandLight:   '#2D65D4',
  brandGlow:    'rgba(27,79,190,0.18)',
  brandBorder:  'rgba(27,79,190,0.35)',
  brandSubtle:  'rgba(27,79,190,0.08)',

  // Backgrounds (porcelain canvas and clean white surfaces)
  bgRoot:       '#FFFFFF',
  bgCard:       '#FFFFFF',
  bgCardHover:  '#F7F9FC',
  bgElevated:   '#FFFFFF',
  bgInput:      '#F3F6FA',
  bgSheet:      '#FFFFFF',
  bgOverlay:    'rgba(15, 23, 42, 0.48)',
  bgSurface:    '#FFFFFF',

  // Glass morphism
  glass:        'rgba(255, 255, 255, 0.78)',
  glassBorder:  'rgba(20, 32, 51, 0.10)',
  glassStrong:  'rgba(255, 255, 255, 0.92)',

  // Status semantic — Green = safe/completed/okay
  ok:           '#22C55E',
  okDark:       '#16A34A',
  okBg:         'rgba(34, 197, 94, 0.12)',
  okBorder:     'rgba(34, 197, 94, 0.30)',
  okGlow:       'rgba(34, 197, 94, 0.25)',

  // Amber = warning/issue
  warn:         '#F59E0B',
  warnDark:     '#D97706',
  warnBg:       'rgba(245, 158, 11, 0.12)',
  warnBorder:   'rgba(245, 158, 11, 0.35)',
  warnGlow:     'rgba(245, 158, 11, 0.20)',

  // Red = critical/missed
  danger:       '#EF4444',
  dangerDark:   '#DC2626',
  dangerBg:     'rgba(239, 68, 68, 0.12)',
  dangerBorder: 'rgba(239, 68, 68, 0.35)',
  dangerGlow:   'rgba(239, 68, 68, 0.30)',

  // SOS — maximum urgency
  sos:          '#FF2D55',
  sosBg:        'rgba(255, 45, 85, 0.15)',
  sosBorder:    'rgba(255, 45, 85, 0.45)',
  sosGlow:      'rgba(255, 45, 85, 0.40)',

  // Blue = informational/neutral action
  info:         '#1B4FBE',
  infoBg:       'rgba(27, 79, 190, 0.10)',
  infoBorder:   'rgba(27, 79, 190, 0.24)',

  // Cyan = patrol/technical
  cyan:         '#06B6D4',
  cyanBg:       'rgba(6, 182, 212, 0.12)',
  cyanBorder:   'rgba(6, 182, 212, 0.30)',
  cyanGlow:     'rgba(6, 182, 212, 0.20)',

  // Text hierarchy
  textPrimary:   '#142033',
  textSecondary: '#46546A',
  textMuted:     '#68768B',
  textDisabled:  '#8A96A8',
  textInverse:   '#FFFFFF',

  // Borders
  borderSubtle:  '#E9EDF3',
  borderMid:     '#DCE3EC',
  borderStrong:  '#C5CFDC',

  // compat aliases
  missed:        '#EF4444',
  missedBg:      'rgba(239, 68, 68, 0.12)',
  missedBorder:  'rgba(239, 68, 68, 0.30)',
  issue:         '#F59E0B',
  issueBg:       'rgba(245, 158, 11, 0.12)',
  issueBorder:   'rgba(245, 158, 11, 0.30)',
  upcoming:      '#68768B',
  upcomingBg:    '#F1F4F8',
  purple:        '#A855F7',
  purpleBg:      'rgba(168, 85, 247, 0.12)',
  amber:         '#F59E0B',

  white:         '#FFFFFF',
  black:         '#000000',
  transparent:   'transparent',
};

// ─── Spacing scale (8px grid) ────────────────────────────────────────────────
export const S = {
  xs:    4,
  sm:    8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  huge: 48,
  giant: 64,
};

// ─── Animation durations ──────────────────────────────────────────────────────
export const ANIM = {
  instant: 100,
  fast:    200,
  normal:  300,
  slow:    500,
};

// ─── Border radius ────────────────────────────────────────────────────────────
export const R = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  full: 9999,
};

// ─── Typography scale ─────────────────────────────────────────────────────────
export const TYPE = {
  // Large numerals for stats / timers
  display:  { fontSize: 40, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -1.5, lineHeight: 48 },
  stat:     { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5, fontFamily: 'monospace' },
  hero:     { fontSize: 32, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.8 },
  title:    { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  heading:  { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  body:     { fontSize: 14, fontWeight: '400', color: COLORS.textSecondary, lineHeight: 21 },
  small:    { fontSize: 12, fontWeight: '400', color: COLORS.textMuted, lineHeight: 18 },
  caption:  { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.3 },
  label:    { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 },
  mono:     { fontSize: 13, fontFamily: 'monospace', color: COLORS.textSecondary },
  badge:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#0B192C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.025,
    shadowRadius: 2,
    elevation: 0,
  },
  md: {
    shadowColor: '#0B192C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 0,
  },
  lg: {
    shadowColor: '#0B192C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 4,
    elevation: 0,
  },
  brand: {
    shadowColor: '#1B4FBE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 1,
  },
  blue: {
    shadowColor: '#1B4FBE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 1,
  },
  gold: {
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 1,
  },
  ok: {
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 1,
  },
  sos: {
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 2,
  },
};

// ─── Common reusable style helpers ───────────────────────────────────────────
export const cardStyle = {
  backgroundColor: COLORS.bgCard,
  borderRadius: R.lg,
  borderWidth: 0.5,
  borderColor: COLORS.borderSubtle,
  padding: S.lg,
  ...shadows.md,
};

export const inputStyle = {
  backgroundColor: COLORS.bgInput,
  borderWidth: 1,
  borderColor: COLORS.borderMid,
  borderRadius: R.md,
  paddingHorizontal: S.lg,
  paddingVertical: S.md,
  color: COLORS.textPrimary,
  fontSize: 15,
};

export const primaryBtn = {
  backgroundColor: '#1B4FBE',
  borderRadius: R.md,
  paddingVertical: 14,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
  ...shadows.blue,
};

export const primaryBtnText = {
  color: COLORS.white,
  fontSize: 16,
  fontWeight: '800',
};

export const headerStyle = {
  backgroundColor: COLORS.bgRoot,
  paddingTop: 12,
};

// ─── T — backward-compat flat namespace ──────────────────────────────────────
export const T = {
  ...COLORS,
  ...BRAND,
  // Logo
  logoHeader: { width: 130, height: 40 },
  logoLogin:  { width: 200, height: 66 },
  logoSmall:  { width: 80,  height: 26 },
  // Radius aliases
  radiusSm:    R.sm,
  radiusMd:    R.md,
  radiusLg:    R.lg,
  radiusXl:    R.xl,
  radiusFull:  R.full,
  // Font aliases
  fontDisplay:  TYPE.display,
  fontStat:     TYPE.stat,
  fontHero:     TYPE.hero,
  fontTitle:    TYPE.title,
  fontSubtitle: TYPE.subtitle,
  fontBody:     TYPE.body,
  fontCaption:  TYPE.caption,
  fontLabel:    TYPE.label,
  fontMono:     TYPE.mono,
};

// ─── Status helpers ───────────────────────────────────────────────────────────
export function statusColor(status) {
  switch (status) {
    case 'yes':      return COLORS.ok;
    case 'no':       return COLORS.warn;
    case 'missed':   return COLORS.danger;
    case 'sos':      return COLORS.sos;
    case 'upcoming': return COLORS.upcoming;
    case 'info':     return COLORS.info;
    default:         return COLORS.textMuted;
  }
}

export function statusBg(status) {
  switch (status) {
    case 'yes':      return COLORS.okBg;
    case 'no':       return COLORS.warnBg;
    case 'missed':   return COLORS.dangerBg;
    case 'sos':      return COLORS.sosBg;
    case 'info':     return COLORS.infoBg;
    default:         return COLORS.upcomingBg;
  }
}

export function statusBorder(status) {
  switch (status) {
    case 'yes':      return COLORS.okBorder;
    case 'no':       return COLORS.warnBorder;
    case 'missed':   return COLORS.dangerBorder;
    case 'sos':      return COLORS.sosBorder;
    default:         return COLORS.borderSubtle;
  }
}
