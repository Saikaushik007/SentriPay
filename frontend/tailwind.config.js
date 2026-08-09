/** @type {import('tailwindcss').Config} */

/**
 * ──────────────────────────────────────────────────────────────────────
 *  SENTRIPAY DESIGN SYSTEM TOKENS
 *  Single source of truth — every component references these.
 * ──────────────────────────────────────────────────────────────────────
 *
 *  Colors
 *   Primary  Indigo   #4F46E5
 *   Violet            #7C3AED
 *   Success           #10B981
 *   Danger            #F43F5E
 *   Warning           #F59E0B
 *   Info     Sky      #38BDF8
 *   Background Base   #FAFAFA  (never pure white)
 *   Card White        #FFFFFF
 *   Text Primary      #18181B
 *   Text Secondary    #71717A
 *
 *  Typography
 *   font-display  → Outfit Bold         (all headlines / h1–h3)
 *   font-accent   → Fraunces Italic     (ONE accent tagline per page)
 *   font-serif    → Playfair Display    (editorial accent, italic only)
 *   font-sans     → Inter               (body / labels / UI copy)
 *   font-mono     → JetBrains Mono      (all numbers, code, data)
 * ──────────────────────────────────────────────────────────────────────
 */

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {

      // ── Typography ──────────────────────────────────────────────────
      fontFamily: {
        // Headlines — Outfit Bold
        display: ['Outfit', 'system-ui', 'sans-serif'],
        // ONE accent tagline per page — Fraunces Italic
        accent:  ['Fraunces', 'Georgia', 'serif'],
        // Editorial accent — Playfair Display Italic
        serif:   ['Playfair Display', 'Georgia', 'serif'],
        // Body / labels / UI copy — Inter
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        // All numbers, data, code — JetBrains Mono
        mono:    ['JetBrains Mono', 'Menlo', 'monospace'],
      },

      // ── Color Tokens ────────────────────────────────────────────────
      colors: {
        // ─ Base surfaces
        background:    '#FAFAFA',   // page background — never pure white
        surface:       '#FFFFFF',   // card / panel white

        // ─ Text
        textMain:      '#18181B',   // primary text
        textMuted:     '#71717A',   // secondary / label text

        // ─ Border
        border:        '#E4E4E7',

        // ─ Brand palette
        primary:       '#4F46E5',   // Indigo
        primaryLight:  '#EEF2FF',   // Indigo tint (chip backgrounds)
        violet:        '#7C3AED',
        violetLight:   '#F5F3FF',

        // ─ Semantic
        success:       '#10B981',
        successLight:  '#D1FAE5',
        danger:        '#F43F5E',
        dangerLight:   '#FFE4E6',
        warning:       '#F59E0B',
        warningLight:  '#FEF3C7',
        info:          '#38BDF8',   // sky / info
        infoLight:     '#E0F2FE',

        // ─ Neutral grays (explicit, for components that need them)
        zinc: {
          50:  '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
        },
      },

      // ── Box Shadows ─────────────────────────────────────────────────
      boxShadow: {
        // Card elevation
        'card':          '0 2px 16px -2px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)',
        'card-hover':    '0 8px 32px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-deep':     '0 12px 40px -8px rgba(0,0,0,0.14)',

        // Brand glows
        'glow-primary':  '0 4px 24px -4px rgba(79,70,229,0.35)',
        'glow-violet':   '0 4px 24px -4px rgba(124,58,237,0.35)',
        'glow-success':  '0 4px 24px -4px rgba(16,185,129,0.30)',
        'glow-danger':   '0 4px 24px -4px rgba(244,63,94,0.30)',
        'glow-warning':  '0 4px 24px -4px rgba(245,158,11,0.30)',
        'glow-info':     '0 4px 24px -4px rgba(56,189,248,0.30)',
      },

      // ── Background Images / Gradients ────────────────────────────────
      backgroundImage: {
        // Mesh hero — 3 colour blobs bleeding from top
        'mesh-hero':
          'radial-gradient(ellipse 80% 50% at 10% -10%, rgba(129,140,248,0.18) 0%, transparent 60%),' +
          'radial-gradient(ellipse 60% 40% at 55% -5%, rgba(244,114,182,0.14) 0%, transparent 55%),' +
          'radial-gradient(ellipse 70% 45% at 95% -5%, rgba(56,189,248,0.16) 0%, transparent 55%)',

        // Solid directional gradients
        'gradient-primary':  'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        'gradient-violet':   'linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)',
        'gradient-success':  'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
        'gradient-danger':   'linear-gradient(135deg, #F43F5E 0%, #F472B6 100%)',
        'gradient-warning':  'linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)',
        'gradient-info':     'linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)',
        'gradient-curve':    'linear-gradient(90deg,   #818CF8 0%, #38BDF8 100%)',
      },

      // ── Animations ──────────────────────────────────────────────────
      keyframes: {
        'ping-slow': {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'ping-slow': 'ping-slow 2s cubic-bezier(0,0,0.2,1) infinite',
        'slide-in':  'slide-in 0.3s ease-out both',
        'fade-up':   'fade-up 0.5s ease-out both',
      },

      // ── Border Radius ───────────────────────────────────────────────
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
