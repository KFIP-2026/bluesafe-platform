// BlueSafe — UI Kit (TDS-spec components)
// Deps (window globals): React, TOKENS, ts, tr

const { useState, useMemo } = React;

// ════════════════════════════════════════════════════════════════
// Phone frame — iOS, 375×812
// ════════════════════════════════════════════════════════════════
function Phone({ children, bg = TOKENS.c.white, statusBarTone = 'dark', hideStatusBar = false, hideHomeIndicator = false }) {
  return (
    <div style={{
      position: 'relative',
      width: TOKENS.W,
      height: TOKENS.H,
      background: bg,
      overflow: 'hidden',
      fontFamily: TOKENS.t.family,
      color: TOKENS.c.grey900,
    }}>
      {!hideStatusBar && <StatusBar tone={statusBarTone} bg={bg} />}
      <div style={{
        position: 'absolute',
        left: 0, right: 0,
        top: hideStatusBar ? 0 : TOKENS.STATUS_BAR,
        bottom: hideHomeIndicator ? 0 : TOKENS.HOME_INDICATOR,
        overflow: 'hidden',
      }}>
        {children}
      </div>
      {!hideHomeIndicator && <HomeIndicator tone={statusBarTone} />}
    </div>
  );
}

function StatusBar({ tone = 'dark', bg = TOKENS.c.white }) {
  const fg = tone === 'light' ? TOKENS.c.white : TOKENS.c.grey900;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: TOKENS.STATUS_BAR,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px 0 28px', paddingTop: 14,
      color: fg, background: bg, zIndex: 10,
    }}>
      <span style={{ ...ts('label1'), fontWeight: 600 }}>9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
          {[3, 5, 7, 9].map((h, i) => (
            <rect key={i} x={i * 4} y={11 - h} width="3" height={h} rx="0.5" fill={fg} />
          ))}
        </svg>
        {/* wifi */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path d="M7.5 10.5L7.5 10.5M1 4C1 4 4 1 7.5 1S14 4 14 4M3.5 6.5C3.5 6.5 5 5 7.5 5S11.5 6.5 11.5 6.5M6 9C6 9 6.5 8.5 7.5 8.5S9 9 9 9" stroke={fg} strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {/* battery */}
        <div style={{
          width: 24, height: 11, border: `1px solid ${fg}`, borderRadius: 3, opacity: 0.95,
          padding: 1, position: 'relative',
        }}>
          <div style={{ width: '85%', height: '100%', background: fg, borderRadius: 1.5 }}/>
          <div style={{ position: 'absolute', right: -3, top: 3, width: 1.5, height: 4, background: fg, borderRadius: 1 }}/>
        </div>
      </div>
    </div>
  );
}

function HomeIndicator({ tone = 'dark' }) {
  const c = tone === 'light' ? 'rgba(255,255,255,0.85)' : TOKENS.c.grey900;
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: TOKENS.HOME_INDICATOR, display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8,
    }}>
      <div style={{ width: 134, height: 5, background: c, borderRadius: 3 }}/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Top — TDS top header (back chevron + title or H1 below)
// ════════════════════════════════════════════════════════════════
function TopBar({ onBack = true, title = '', right, dense = false, tone = 'dark', bg = 'transparent' }) {
  const fg = tone === 'light' ? TOKENS.c.white : TOKENS.c.grey900;
  return (
    <div style={{
      height: TOKENS.TOP_BAR, display: 'flex', alignItems: 'center',
      padding: '0 8px 0 4px', background: bg, color: fg,
      position: 'relative', zIndex: 5,
    }}>
      <button style={iconBtn} aria-label="back">
        {onBack ? <ChevronLeft color={fg} /> : <span style={{width: 24}}/>}
      </button>
      {dense && title && (
        <span style={{ ...ts('title2'), color: fg, flex: 1, textAlign: 'center', marginRight: 40 }}>{title}</span>
      )}
      <span style={{ flex: 1 }}/>
      <div style={{ display: 'flex', gap: 4, paddingRight: 8 }}>{right}</div>
    </div>
  );
}

const iconBtn = {
  width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
};

// H1 page title (under top bar). spec: 24/700, -0.4 ls, 24px side margin, 4-12 below
function PageTitle({ children, sub, color = TOKENS.c.grey900, pad = 24, mt = 4 }) {
  return (
    <div style={{ padding: `${mt}px ${pad}px 16px` }}>
      <h1 style={{ ...ts('h1'), color, whiteSpace: 'pre-line' }}>{children}</h1>
      {sub && <p style={{ ...ts('body2'), color: TOKENS.c.grey600, marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Buttons — TDS Button (xl/l/m/s × brand/neutral × fill/weak)
// ════════════════════════════════════════════════════════════════
function Button({ children, size = 'xl', variant = 'fill', color = 'brand', block = true, onClick, disabled, brand }) {
  const sizes = {
    xl: { h: 56, fs: 17, fw: 700, r: 14, px: 24 },
    l:  { h: 48, fs: 16, fw: 600, r: 12, px: 20 },
    m:  { h: 40, fs: 14, fw: 600, r: 10, px: 16 },
    s:  { h: 32, fs: 13, fw: 600, r: 8,  px: 14 },
  };
  const s = sizes[size];
  const accent = brand || TOKENS.brand.primary;
  let bg, fg;
  if (color === 'brand') {
    bg = variant === 'fill' ? accent : TOKENS.brand.primaryLt;
    fg = variant === 'fill' ? TOKENS.c.white : TOKENS.brand.primaryDk;
  } else if (color === 'neutral') {
    bg = variant === 'fill' ? TOKENS.c.grey900 : TOKENS.c.grey100;
    fg = variant === 'fill' ? TOKENS.c.white : TOKENS.c.grey900;
  } else if (color === 'red') {
    bg = variant === 'fill' ? TOKENS.c.red : '#FFE5E7';
    fg = variant === 'fill' ? TOKENS.c.white : TOKENS.c.red;
  }
  if (disabled) { bg = TOKENS.c.grey150; fg = TOKENS.c.grey400; }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      height: s.h, padding: `0 ${s.px}px`, borderRadius: s.r,
      background: bg, color: fg, border: 0,
      width: block ? '100%' : 'auto',
      fontFamily: TOKENS.t.family, fontSize: s.fs, fontWeight: s.fw, letterSpacing: -0.2,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>{children}</button>
  );
}

// Bottom-CTA — fixed at bottom of phone, 36px white-fade gradient on top
function BottomCTA({ children, secondary, checkbox, lower, brand }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
    }}>
      <div style={{
        height: 36, background: 'linear-gradient(rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)',
      }}/>
      <div style={{
        background: TOKENS.c.white, padding: '0 24px 20px', pointerEvents: 'auto',
      }}>
        {checkbox && <div style={{ height: 50, display: 'flex', alignItems: 'center' }}>{checkbox}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          {secondary && <div style={{ flex: 1 }}><Button size="xl" variant="weak" color="neutral" brand={brand}>{secondary}</Button></div>}
          <div style={{ flex: secondary ? 1 : 'auto', width: secondary ? 'auto' : '100%' }}>
            <Button size="xl" variant="fill" color="brand" brand={brand}>{children}</Button>
          </div>
        </div>
        {lower && <div style={{ marginTop: 12, textAlign: 'center' }}>{lower}</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// List Row — TDS spec: vertical M padding (16), 24 side margin
// 56-72-88 heights for 1-2-3 lines, optional left asset (squircle)
// ════════════════════════════════════════════════════════════════
function ListRow({ leading, title, sub, sub2, tail, tailSub, accent, onClick, divider = false }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 24px', minHeight: 56, cursor: onClick ? 'pointer' : 'default',
      borderBottom: divider ? `1px solid ${TOKENS.c.grey150}` : 0,
    }}>
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...ts('title2'), color: accent || TOKENS.c.grey900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div style={{ ...ts('body2'), color: TOKENS.c.grey600, marginTop: 2 }}>{sub}</div>}
        {sub2 && <div style={{ ...ts('cap1'), color: TOKENS.c.grey500, marginTop: 2 }}>{sub2}</div>}
      </div>
      {tail && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...ts('title2'), color: accent || TOKENS.c.grey900 }}>{tail}</div>
          {tailSub && <div style={{ ...ts('cap1'), color: TOKENS.c.grey500, marginTop: 2 }}>{tailSub}</div>}
        </div>
      )}
    </div>
  );
}

// Squircle resource icon
function Squircle({ size = 40, bg = TOKENS.brand.primaryLt, color = TOKENS.brand.primaryDk, children }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: bg, color: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      fontSize: size * 0.5, fontWeight: 700,
    }}>{children}</div>
  );
}

// Section header (TDS H3 left, optional 'all' link right)
function SectionHeader({ children, right, mt = 24 }) {
  return (
    <div style={{
      padding: '0 24px', marginTop: mt, marginBottom: 8,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    }}>
      <h3 style={{ ...ts('h3'), color: TOKENS.c.grey900 }}>{children}</h3>
      {right && <span style={{ ...ts('label2'), color: TOKENS.c.grey600 }}>{right}</span>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Chip — TDS chip (size S/M, fill/weak)
// ════════════════════════════════════════════════════════════════
function Chip({ children, size = 'm', variant = 'weak', selected = false, color, leading, brand }) {
  const sizes = { s: { h: 28, px: 10, fs: 12 }, m: { h: 32, px: 12, fs: 13 }, l: { h: 40, px: 14, fs: 14 } };
  const s = sizes[size];
  const accent = brand || TOKENS.brand.primary;
  let bg, fg, border = 'transparent';
  if (variant === 'fill') {
    bg = selected ? accent : TOKENS.c.grey100;
    fg = selected ? TOKENS.c.white : TOKENS.c.grey700;
  } else {
    bg = selected ? TOKENS.brand.primaryLt : TOKENS.c.grey100;
    fg = selected ? TOKENS.brand.primaryDk : TOKENS.c.grey700;
  }
  if (color === 'red') { bg = '#FFE5E7'; fg = TOKENS.c.red; }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: s.h, padding: `0 ${s.px}px`, borderRadius: s.h / 2,
      background: bg, color: fg, border: `1px solid ${border}`,
      fontSize: s.fs, fontWeight: 600, letterSpacing: -0.1,
    }}>{leading}{children}</span>
  );
}

// Badge — small label
function Badge({ children, color = 'grey' }) {
  const cm = {
    grey: { bg: TOKENS.c.grey100, fg: TOKENS.c.grey700 },
    red: { bg: '#FFEAEC', fg: TOKENS.c.red },
    green: { bg: '#E6F7EE', fg: '#0A8D44' },
    yellow: { bg: '#FFF6D9', fg: '#946100' },
    blue: { bg: TOKENS.brand.primaryLt, fg: TOKENS.brand.primaryDk },
    ink: { bg: TOKENS.brand.ink, fg: TOKENS.c.white },
  };
  const c = cm[color] || cm.grey;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px',
      borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0,
      background: c.bg, color: c.fg, lineHeight: 1,
    }}>{children}</span>
  );
}

// ════════════════════════════════════════════════════════════════
// Progress Bar / Stepper
// ════════════════════════════════════════════════════════════════
function ProgressBar({ value = 0, color, height = 8, track = TOKENS.c.grey150 }) {
  return (
    <div style={{ height, background: track, borderRadius: height/2, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, Math.max(0, value))}%`,
        background: color || TOKENS.brand.primary, borderRadius: height/2,
        transition: 'width .3s ease',
      }}/>
    </div>
  );
}

function Stepper({ steps, current = 0, color }) {
  const accent = color || TOKENS.brand.primary;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{
            width: 22, height: 22, borderRadius: 11,
            background: i <= current ? accent : TOKENS.c.grey200,
            color: i <= current ? TOKENS.c.white : TOKENS.c.grey500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>{i + 1}</div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? accent : TOKENS.c.grey200 }}/>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab Bar (bottom)
// ════════════════════════════════════════════════════════════════
function TabBar({ items, active = 0, brand }) {
  const accent = brand || TOKENS.brand.primary;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: TOKENS.HOME_INDICATOR,
      height: TOKENS.TAB_BAR, background: TOKENS.c.white,
      borderTop: `1px solid ${TOKENS.c.grey150}`,
      display: 'flex', alignItems: 'stretch',
    }}>
      {items.map((it, i) => {
        const isActive = i === active;
        const fg = isActive ? accent : TOKENS.c.grey400;
        return (
          <div key={i} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2, color: fg,
          }}>
            <div style={{ width: 24, height: 24, color: fg }}>{it.icon}</div>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Card / Cell
// ════════════════════════════════════════════════════════════════
function Card({ children, pad = 20, bg = TOKENS.c.white, mx = 24, mt = 0, radius = 16, border, shadow }) {
  return (
    <div style={{
      margin: `${mt}px ${mx}px`, background: bg, borderRadius: radius, padding: pad,
      border: border ? `1px solid ${TOKENS.c.grey150}` : 0,
      boxShadow: shadow ? TOKENS.shadow.card : 'none',
    }}>{children}</div>
  );
}

// Divider
const Divider = ({ mx = 24, color = TOKENS.c.grey150 }) => (
  <div style={{ height: 1, background: color, margin: `0 ${mx}px` }}/>
);

const Spacer = ({ h = 16 }) => <div style={{ height: h }}/>;

// ════════════════════════════════════════════════════════════════
// Iconography (mono, 24px) — hand-drawn keep-simple
// ════════════════════════════════════════════════════════════════
const Icon = ({ d, size = 24, color = 'currentColor', stroke = 1.8, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {typeof d === 'string' ? <path d={d}/> : d}
  </svg>
);

const ChevronLeft = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d="M15 6l-6 6 6 6"/>
);
const ChevronRight = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d="M9 6l6 6-6 6"/>
);
const IconClose = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d="M6 6l12 12M18 6L6 18"/>
);
const IconCheck = ({ color = 'currentColor', size = 24, stroke = 2.2 }) => (
  <Icon size={size} color={color} stroke={stroke} d="M5 12.5L9.5 17 19 7"/>
);
const IconShield = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>
);
const IconLock = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M7.5 10V7.5a4.5 4.5 0 019 0V10"/></>}/>
);
const IconBell = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><path d="M6 16V11a6 6 0 0112 0v5l1.5 2.5h-15L6 16z"/><path d="M10 20a2 2 0 004 0"/></>}/>
);
const IconHome = ({ color = 'currentColor', size = 24, fill = 'none' }) => (
  <Icon size={size} color={color} fill={fill} d="M4 11.5L12 4l8 7.5V20a1 1 0 01-1 1h-4v-7h-6v7H5a1 1 0 01-1-1v-8.5z"/>
);
const IconWallet = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2"/><path d="M3 9h13c.5 0 1-.4 1-1V6"/></>}/>
);
const IconClock = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}/>
);
const IconChart = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><path d="M4 19V5"/><path d="M9 19v-7"/><path d="M14 19V9"/><path d="M19 19v-4"/><path d="M3 19h18"/></>}/>
);
const IconUser = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></>}/>
);
const IconDoc = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></>}/>
);
const IconKey = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3M14 8l3 3"/></>}/>
);
const IconCoin = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><circle cx="12" cy="12" r="9"/><path d="M9 9h4.5a2 2 0 010 4H9m0 0h5a2 2 0 010 4H9m3 0v2m0-14v2"/></>}/>
);
const IconAlert = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><circle cx="12" cy="16.5" r="0.7" fill={color} stroke="none"/></>}/>
);
const IconGlobe = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>}/>
);
const IconArrowDown = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d="M12 5v14M6 13l6 6 6-6"/>
);
const IconArrowUp = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d="M12 19V5M6 11l6-6 6 6"/>
);
const IconPlus = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d="M12 5v14M5 12h14"/>
);
const IconSearch = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></>}/>
);
const IconMore = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} stroke={3} d={<><circle cx="5" cy="12" r="0.6" fill={color}/><circle cx="12" cy="12" r="0.6" fill={color}/><circle cx="19" cy="12" r="0.6" fill={color}/></>}/>
);
const IconStar = ({ color = 'currentColor', size = 24, fill = 'none' }) => (
  <Icon size={size} color={color} fill={fill} d="M12 4l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 4z"/>
);
const IconBolt = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d="M13 3l-7 11h5l-1 7 7-11h-5l1-7z"/>
);
const IconDots = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} stroke={3} d={<><circle cx="6" cy="12" r="0.8" fill={color}/><circle cx="12" cy="12" r="0.8" fill={color}/><circle cx="18" cy="12" r="0.8" fill={color}/></>}/>
);
const IconSettings = ({ color = 'currentColor', size = 24 }) => (
  <Icon size={size} color={color} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a7.97 7.97 0 000-6l2-1.5-2-3.5-2.4 1a8 8 0 00-5-3l-.6-2.5h-3l-.6 2.5a8 8 0 00-5 3l-2.4-1-2 3.5L.4 9a7.97 7.97 0 000 6L-1.6 16.5l2 3.5 2.4-1a8 8 0 005 3l.6 2.5h3l.6-2.5a8 8 0 005-3l2.4 1 2-3.5L19.4 15z"/></>}/>
);

Object.assign(window, {
  Phone, StatusBar, HomeIndicator, TopBar, PageTitle,
  Button, BottomCTA,
  ListRow, Squircle, SectionHeader,
  Chip, Badge,
  ProgressBar, Stepper,
  TabBar, Card, Divider, Spacer,
  Icon, ChevronLeft, ChevronRight, IconClose, IconCheck, IconShield, IconLock,
  IconBell, IconHome, IconWallet, IconClock, IconChart, IconUser, IconDoc, IconKey,
  IconCoin, IconAlert, IconGlobe, IconArrowDown, IconArrowUp, IconPlus, IconSearch,
  IconMore, IconSettings, IconStar, IconBolt, IconDots,
});
