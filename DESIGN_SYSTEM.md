# Observant Security — Tactical Command Center

This is the visual contract for Guard, Manager, and Super Admin. Keep the native app (`src/ds.js`), browser console (`src/index.css`), and native admin views (`src/theme.js`) aligned with these shared decisions.

## Color tokens

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | Graphite | `#0B0E14` | App and page background |
| Surface | Slate 950 | `#0F1520` | Screen sections and navigation |
| Card | Slate 900 | `#131C2E` | Standard cards, 16–20px radius |
| Elevated | Slate 850 | `#1A2540` | Menus, inputs, modal sheets |
| Primary | Royal blue | `#1B4FBE` | Neutral actions, focus, information |
| Authority | Crimson | `#C8232C` | Brand detail and high urgency |
| Premium | Laurel gold | `#C9A84C` | Brand detail and important milestones |
| Safe | Green | `#22C55E` | Completed, on duty, healthy |
| Attention | Amber | `#F59E0B` | Warning, issue, approaching deadline |
| Critical | Red | `#EF4444` | Missed SLA and critical status |
| Information | Blue | `#3B82F6` | Informational status and neutral action |
| Primary text | Ice | `#F0F4FF` | Titles, key values |
| Secondary text | Steel | `#8FA3C8` | Supporting content |
| Muted text | Slate | `#56617A` | Timestamps, metadata |
| Hairline | Border | `rgba(255,255,255,.08)` | Card and divider edges |

Status semantics never vary by screen: green = safe/completed; amber = attention; red = critical/missed; blue = informational. SOS uses crimson/red as the urgent brand exception.

## Type scale

Use Manrope on web and the platform geometric sans on native, with tabular numerals for clocks and metrics. Sizes: **48** display timer, **32** page hero, **24** section title, **18** card heading, **14** body, **12** supporting label, **10–11** metadata. Headings use 650–800 weight; body uses 400–500. Keep secondary labels muted and never use them for essential instructions.

## Spacing and shape

Use a 4px base aligned to an 8px rhythm: **4, 8, 12, 16, 24, 32, 40, 48, 64px**. Standard screen gutters are 16–24px. Card radius is **16px**, prominent hero and modal radius **20px**, compact controls **10–12px**, pill **999px**. Cards use a one-pixel hairline and restrained black elevation; reserve blue/gold radial glows for hero emphasis and red glow for SOS.

## Components

- **Primary button:** royal-blue fill, 48px minimum height, 12–14px radius, clear verb label. Green/red are reserved for explicit Book On/Book Off and critical actions.
- **Card:** slate surface, 1px hairline, 16px radius, 16–24px padding; use a left status rail for operational tiles.
- **Status chip:** semantic tint at low opacity, semantic text and border; pair color with a word or icon.
- **Routine modal:** elevated dark surface, calm blue/neutral accent, concise action, fade/slide transition.
- **Critical modal / SOS:** crimson or red border and glow, prominent alert icon and clear consequence; require an explicit dismissal or action.
- **Empty state:** shield/radar/patrol icon, one short helpful sentence, and a relevant action when one exists.
- **Motion:** 150–300ms transitions, gentle active-state pulse, animated check completion and SOS feedback. Respect reduced motion on web.

## Screen application

- Guard home: live clock is the focal point; active shift gets a quiet blue glow, followed by shift state, progress, book action, and the next operational event.
- Call path: preserve the winding SVG route; draw it in on entry, pulse the current/next stop, and keep completed stops visibly green.
- Manager: compact status tiles use a green/amber/red left rail with status text; urgent events outrank metrics.
- SOS: full-screen crimson/red alert state with a pulsing signal and direct reassurance after dispatch.
- Super Admin: use the same canvas, surfaces, type, semantic statuses, modal weight, and empty-state language as the operations console.

When tokens change, update `src/ds.js`, `src/theme.js`, and `src/index.css` together. Do not add a new status color meaning locally.
