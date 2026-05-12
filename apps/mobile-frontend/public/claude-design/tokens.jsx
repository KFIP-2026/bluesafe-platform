// BlueSafe — Design tokens (TDS-spec aligned)
// 375px viewport, Pretendard primary, BlueSafe Cyan accent

const TOKENS = {
  // ── Color (TDS palette + BlueSafe accent overlay) ──
  c: {
    // Greys (TDS scale)
    grey900: '#191F28',
    grey800: '#333D4B',
    grey700: '#4E5968',
    grey600: '#6B7684',
    grey500: '#8B95A1',
    grey400: '#B0B8C1',
    grey300: '#D1D6DB',
    grey200: '#E5E8EB',
    grey150: '#EEF0F2',
    grey100: '#F2F4F6',
    grey50:  '#F9FAFB',
    white:   '#FFFFFF',
    black:   '#000000',
    // Status (TDS)
    red:    '#F04452',
    orange: '#FF9000',
    yellow: '#FFCC4D',
    green:  '#1AC267',
    // Dim
    dim:    'rgba(0,0,0,0.45)',
    dim20:  'rgba(0,0,0,0.20)',
  },

  // ── BlueSafe brand (Deep Navy + White) ──
  brand: {
    primary:    '#1E3A8A',   // signature deep navy
    primaryDk:  '#142A66',   // deeper navy for emphasis
    primaryLt:  '#E8EEFB',   // soft blue-tint for surfaces
    ink:        '#0A1A3F',   // near-black navy for headlines
    inkSoft:    '#1A2B57',
    canvas:     '#FFFFFF',   // pure white canvas behind iPhones
  },

  // ── Type scale (TDS) ──
  // Pretendard substitutes SF Pro / Toss Product Sans on web
  // Numbers in px / unitless line-height
  t: {
    family: "'Pretendard', -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif",
    mono:   "'JetBrains Mono', ui-monospace, monospace",
    // TDS sizes in real spec
    h1:     { fs: 24, lh: 32, fw: 700, ls: -0.4 },
    h2:     { fs: 20, lh: 28, fw: 700, ls: -0.3 },
    h3:     { fs: 18, lh: 26, fw: 700, ls: -0.2 },
    title1: { fs: 22, lh: 30, fw: 600, ls: -0.3 },
    title2: { fs: 17, lh: 24, fw: 600, ls: -0.2 },
    body1:  { fs: 15, lh: 22, fw: 500, ls: -0.1 },
    body2:  { fs: 15, lh: 22, fw: 400, ls: -0.1 },
    label1: { fs: 13, lh: 18, fw: 600, ls: -0.05 },
    label2: { fs: 13, lh: 18, fw: 500, ls: -0.05 },
    cap1:   { fs: 12, lh: 16, fw: 500, ls: 0    },
    cap2:   { fs: 11, lh: 14, fw: 500, ls: 0    },
  },

  // ── Spacing ──
  s: { 4:4, 6:6, 8:8, 10:10, 12:12, 14:14, 16:16, 20:20, 24:24, 28:28, 32:32, 40:40, 48:48, 56:56, 64:64 },

  // ── Radius ──
  r: { 4:4, 8:8, 12:12, 14:14, 16:16, 20:20, 24:24, full:9999, squircle: 14 },

  // ── Shadow (TDS subtle) ──
  shadow: {
    card: '0 1px 0 rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.04)',
    sheet:'0 -1px 0 rgba(0,0,0,0.04), 0 -8px 24px rgba(0,0,0,0.06)',
    fab:  '0 8px 24px rgba(0,0,0,0.12)',
  },

  // ── Frame ──
  W: 375,
  H: 812,
  STATUS_BAR: 47,
  TOP_BAR: 56,
  TAB_BAR: 56,
  HOME_INDICATOR: 34,
};

// helper: turn a TDS type token into CSS
const ts = (key, override = {}) => {
  const t = TOKENS.t[key] || TOKENS.t.body1;
  return {
    fontFamily: TOKENS.t.family,
    fontSize: t.fs,
    lineHeight: `${t.lh}px`,
    fontWeight: t.fw,
    letterSpacing: t.ls,
    margin: 0,
    ...override,
  };
};

// ── i18n + persona toggle ──
// Each string: { ko, en } — tenant 시점 기본; 임대인은 별도 키
const tr = (s, lang = 'ko') => {
  if (typeof s === 'string') return s;
  return s[lang] ?? s.ko ?? '';
};

// 통화 / 숫자 포맷
const krw = (n) => '₩' + n.toLocaleString('ko-KR');
const usd = (n) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });

Object.assign(window, { TOKENS, ts, tr, krw, usd });
