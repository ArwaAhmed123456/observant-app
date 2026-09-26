/**
 * Observant Design System — single source of truth for all visual tokens.
 * Import: import { T, LOGO, S, shadows } from '../../theme';
 */

export const LOGO = require('../assets/logo.png');

// ─── Palette ─────────────────────────────────────────────────────────────────
export const COLORS = {
  // Brand
  brand:        '#10b981',
  brandDark:    '#059669',
  brandLight:   '#34d399',
  brandGlow:    'rgba(16,185,129,0.18)',
  brandBorder:  'rgba(16,185,129,0.35)',
  brandSubtle:  'rgba(16,185,129,0.08)',

  // Backgrounds
  bgRoot:     '#090d16',
  bgCard:     '#0f172a',
  bgElevated: '#111827',
  bgInput:    '#1e293b',
  bgOverlay:  'rgba(0,0,0,0.72)',
  bgSheet:    '#13203a',

  // Status
  ok:         '#10b981',
  okBg:       'rgba(16,185,129,0.12)',
  okBorder:   'rgba(16,185,129,0.30)',

  missed:     '#ef4444',
  missedBg:   'rgba(239,68,68,0.12)',
  missedBorder:'rgba(239,68,68,0.30)',

  issue:      '#f59e0b',
  issueBg:    'rgba(245,158,11,0.12)',
  issueBorder:'rgba(245,158,11,0.30)',

  sos:        '#ff2d55',
  sosBg:      'rgba(255,45,85,0.15)',
  sosBorder:  'rgba(255,45,85,0.40)',

  upcoming:   '#334155',
  upcomingBg: 'rgba(51,65,85,0.20)',

  info:       '#38bdf8',
  infoBg:     'rgba(56,189,248,0.12)',

  purple:     '#a855f7',
  purpleBg:   'rgba(168,85,247,0.12)',

  amber:      '#f59e0b',

  // Text
  textPrimary:   '#ffffff',
  textSecondary: '#94a3b8',
  textMuted:     '#64748b',
  textDisabled:  '#475569',
  textInverse:   '#090d16',

  // Borders
  borderSubtle: '#1e293b',
  borderMid:    '#334155',
  borderStrong: '#475569',

  // Utility
  white:  '#ffffff',
  black:  '#000000',
  transparent: 'transparent',
};

// ─── Spacing scale ────────────────────────────────────────────────────────────
export const S = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  huge: 48,
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

// ─── Typography ───────────────────────────────────────────────────────────────
export const TYPE = {
  hero:     { fontSize: 32, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  title:    { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  heading:  { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  body:     { fontSize: 14, fontWeight: '400', color: COLORS.textSecondary, lineHeight: 20 },
  small:    { fontSize: 12, fontWeight: '400', color: COLORS.textMuted },
  caption:  { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.4 },
  label:    { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  mono:     { fontSize: 13, fontFamily: 'monospace', color: COLORS.textSecondary },
  badge:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  brand: {
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  sos: {
    shadowColor: COLORS.sos,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
};

// ─── Shared component tokens (backward compat with old T.*) ──────────────────
export const T = {
  ...COLORS,
  // Logo
  logoHeader: { width: 130, height: 40 },
  logoLogin:  { width: 200, height: 66 },
  logoSmall:  { width: 80,  height: 26 },
  // Radius aliases
  radiusSm: R.sm,
  radiusMd: R.md,
  radiusLg: R.lg,
  radiusXl: R.xl,
  radiusFull: R.full,
  // Font aliases
  fontHero:    TYPE.hero,
  fontTitle:   TYPE.title,
  fontSubtitle:TYPE.subtitle,
  fontBody:    TYPE.body,
  fontCaption: TYPE.caption,
  fontLabel:   TYPE.label,
  fontMono:    TYPE.mono,
};

// ─── Common reusable style helpers ───────────────────────────────────────────
export const cardStyle = {
  backgroundColor: COLORS.bgCard,
  borderRadius: R.lg,
  borderWidth: 1,
  borderColor: COLORS.borderSubtle,
  padding: S.lg,
  ...shadows.sm,
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
  backgroundColor: COLORS.brand,
  borderRadius: R.md,
  paddingVertical: 14,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
  ...shadows.brand,
};

export const primaryBtnText = {
  color: COLORS.white,
  fontSize: 16,
  fontWeight: '800',
};

export const headerStyle = {
  backgroundColor: COLORS.bgRoot,
  paddingTop: 52,
};

// ─── Status helpers ───────────────────────────────────────────────────────────
export function statusColor(status) {
  switch (status) {
    case 'yes':      return COLORS.ok;
    case 'no':       return COLORS.issue;
    case 'missed':   return COLORS.missed;
    case 'sos':      return COLORS.sos;
    case 'upcoming': return COLORS.upcoming;
    default:         return COLORS.textMuted;
  }
}

export function statusBg(status) {
  switch (status) {
    case 'yes':      return COLORS.okBg;
    case 'no':       return COLORS.issueBg;
    case 'missed':   return COLORS.missedBg;
    case 'sos':      return COLORS.sosBg;
    default:         return COLORS.upcomingBg;
  }
}
