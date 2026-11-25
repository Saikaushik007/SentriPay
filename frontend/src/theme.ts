/**
 * SENTRIPAY DESIGN SYSTEM TOKENS
 * Unified design system for colors, 3-step shadows, border radii,
 * 8px spacing grid, and motion timings.
 */

export const colors = {
  // Brand & Accent Gradients
  primary: '#4F46E5', // Indigo 600
  primaryHover: '#4338CA',
  primaryLight: '#EEF2FF',
  violet: '#7C3AED',
  violetLight: '#F5F3FF',

  // Soft Multi-hue Palette (Lavender, Sky, Mint, Peach, Rose)
  lavender: '#EDE9FE',
  lavenderSubtle: '#F5F3FF',
  sky: '#E0F2FE',
  skySubtle: '#F0F9FF',
  mint: '#DCFCE7',
  mintSubtle: '#F0FDF4',
  peach: '#FFEDD5',
  peachSubtle: '#FFF7ED',
  rose: '#FFE4E6',
  roseSubtle: '#FFF1F2',

  // Status & Enforcement Categories
  approved: {
    base: '#10B981', // Emerald 500
    hover: '#059669',
    light: '#ECFDF5',
    border: '#A7F3D0',
    text: '#047857',
    glow: 'rgba(16, 185, 129, 0.22)',
  },
  blocked: {
    base: '#F43F5E', // Rose 500
    hover: '#E11D48',
    light: '#FFF1F2',
    border: '#FECDD3',
    text: '#BE123C',
    glow: 'rgba(244, 63, 94, 0.22)',
  },
  flagged: {
    base: '#F59E0B', // Amber 500
    hover: '#D97706',
    light: '#FFFBEB',
    border: '#FDE68A',
    text: '#B45309',
    glow: 'rgba(245, 158, 11, 0.22)',
  },
  simulated: {
    base: '#6366F1', // Indigo
    hover: '#4F46E5',
    light: '#EEF2FF',
    border: '#C7D2FE',
    text: '#4338CA',
    glow: 'rgba(99, 102, 241, 0.22)',
  },

  // Surfaces & Text
  surface: '#FFFFFF',
  surfaceTranslucent: 'rgba(255, 255, 255, 0.82)',
  surfaceMuted: '#F8FAFC',
  border: '#E2E8F0',
  borderMuted: '#F1F5F9',
  borderStrong: '#CBD5E1',

  textMain: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textInverse: '#FFFFFF',

  // Multi-hue Page Background
  pageGradient: 'linear-gradient(135deg, #F5F3FF 0%, #F0F9FF 33%, #F0FDF4 66%, #FFF7ED 100%)',
  heroGradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #6D28D9 100%)',
} as const;

// 3-Step Shadow Scale + Category Glows
export const shadows = {
  sm: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
  md: '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
  lg: '0 10px 18px -3px rgba(15, 23, 42, 0.09), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
  xl: '0 20px 25px -5px rgba(15, 23, 42, 0.10), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',

  // Category glow highlights for cards and buttons
  glowPrimary: '0 8px 24px -4px rgba(79, 70, 229, 0.30)',
  glowSuccess: '0 8px 24px -4px rgba(16, 185, 129, 0.25)',
  glowDanger: '0 8px 24px -4px rgba(244, 63, 94, 0.25)',
  glowWarning: '0 8px 24px -4px rgba(245, 158, 11, 0.25)',
  glowViolet: '0 8px 24px -4px rgba(124, 58, 237, 0.28)',
} as const;

// Consistent Border Radius Scale
export const radii = {
  none: '0px',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  xxl: '24px',
  xxxl: '32px',
  full: '9999px',
} as const;

// 8px Spacing Grid
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

// Motion Timings & Spring Presets
export const motionTimings = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '400ms cubic-bezier(0.16, 1, 0.3, 1)',

  // Framer Motion spring presets
  springSnappy: { type: 'spring', stiffness: 400, damping: 30 },
  springGentle: { type: 'spring', stiffness: 220, damping: 22 },
  springBouncy: { type: 'spring', stiffness: 500, damping: 25 },

  // Lift on hover styles
  cardHover: {
    y: -3,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  buttonTap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
  buttonHover: {
    scale: 1.02,
    transition: { duration: 0.15 },
  },
} as const;

export default {
  colors,
  shadows,
  radii,
  spacing,
  motionTimings,
};
