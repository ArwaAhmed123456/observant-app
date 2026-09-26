/**
 * Observant App — central theme / design tokens.
 * Import from any screen: import { T, LOGO } from '../../theme';
 */

export const LOGO = require('../assets/logo.png');

export const T = {
  // ── Backgrounds ─────────────────────────────────────────────────────
  bgRoot:    '#090d16',   // deepest bg — screen root
  bgCard:    '#0f172a',   // card / panel bg
  bgElevated:'#111827',   // slightly raised card
  bgInput:   '#1e293b',   // input field bg
  bgDivider: '#1e293b',   // hairline divider

  // ── Brand ────────────────────────────────────────────────────────────
  brand:      '#10b981',  // primary green (logo anchor color)
  brandDark:  '#059669',
  brandGlow:  'rgba(16,185,129,0.18)',
  brandBorder:'rgba(16,185,129,0.35)',

  // ── Accent ───────────────────────────────────────────────────────────
  accentBlue: '#38bdf8',
  accentPurple:'#a855f7',
  accentAmber:'#f59e0b',

  // ── Status ───────────────────────────────────────────────────────────
  ok:      '#10b981',   // check call okay / green node
  missed:  '#ef4444',   // missed / red node
  issue:   '#f59e0b',   // issue reported / amber node
  upcoming:'#334155',   // not yet due / hollow grey

  okBg:     'rgba(16,185,129,0.12)',
  missedBg: 'rgba(239,68,68,0.12)',
  issueBg:  'rgba(245,158,11,0.12)',

  // ── Text ─────────────────────────────────────────────────────────────
  textPrimary:  '#ffffff',
  textSecondary:'#94a3b8',
  textMuted:    '#64748b',
  textDisabled: '#475569',

  // ── Borders ──────────────────────────────────────────────────────────
  borderSubtle: '#1e293b',
  borderMid:    '#334155',

  // ── Radii ────────────────────────────────────────────────────────────
  radiusSm:  8,
  radiusMd:  12,
  radiusLg:  16,
  radiusXl:  20,
  radiusFull:999,

  // ── Typography ───────────────────────────────────────────────────────
  fontHero:   { fontSize: 28, fontWeight: '800', color: '#ffffff' },
  fontTitle:  { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  fontSubtitle:{ fontSize: 17, fontWeight: '700', color: '#ffffff' },
  fontBody:   { fontSize: 14, color: '#94a3b8' },
  fontCaption:{ fontSize: 11, color: '#64748b' },
  fontLabel:  { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  fontMono:   { fontFamily: 'monospace' },

  // ── Logo sizes ───────────────────────────────────────────────────────
  logoHeader: { width: 130, height: 40 },   // top-bar header
  logoLogin:  { width: 200, height: 66 },   // login splash
  logoSmall:  { width: 80,  height: 26 },   // inline small
};

// ── Shared component style helpers ───────────────────────────────────────────

export const headerStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingTop: 56,
  paddingBottom: 14,
  backgroundColor: '#090d16',
  borderBottomWidth: 1,
  borderBottomColor: '#1e293b',
};

export const screenPad = { flex: 1, backgroundColor: '#090d16', paddingHorizontal: 20 };

export const cardStyle = {
  backgroundColor: '#0f172a',
  borderRadius: 14,
  borderWidth: 1,
  borderColor: '#1e293b',
  padding: 16,
};

export const primaryBtn = {
  backgroundColor: '#10b981',
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
};

export const primaryBtnText = {
  color: '#fff',
  fontSize: 16,
  fontWeight: '800',
};
