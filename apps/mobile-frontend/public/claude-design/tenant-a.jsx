// BlueSafe — Tenant flow screens (외국인 임차인 시점)
// 20 screens, all pixel-precise to TDS spec
// Deps: React, TOKENS, ts, tr, krw, all UI Kit components on window

const { Fragment } = React;

// ── Copy table (ko/en) ──
const T = {
  brand: { ko: 'BlueSafe', en: 'BlueSafe' },
  tagline: {
    ko: { ko: '한국 보증금이\n안전하게 잠겨요', en: 'Your Korea deposit,\nlocked & insured' },
    en: '',
  },
};

// Helpers
const TX = (lang, ko, en) => lang === 'en' ? en : ko;

// Common chrome wrapper (default white BG, top bar, optional CTA)
function Frame({ bg = TOKENS.c.white, statusTone = 'dark', children, hideStatus, hideHome, brand }) {
  return (
    <Phone bg={bg} statusBarTone={statusTone} hideStatusBar={hideStatus} hideHomeIndicator={hideHome}>
      {children}
    </Phone>
  );
}

// ════════════════════════════════════════════════════════════════
// 01 · 진입 (앱인토스 미니앱 카드 → 시작)
// ════════════════════════════════════════════════════════════════
function T01_Entry({ lang, brand }) {
  return (
    <Frame bg={TOKENS.brand.ink} statusTone="light">
      <div style={{ position: 'absolute', inset: 0, padding: '80px 24px 0' }}>
        {/* Hero text */}
        <div style={{ ...ts('cap1'), color: brand, letterSpacing: 1.2, fontWeight: 700 }}>
          {TX(lang, '앱인토스 · 보증금 안심', 'IN-TOSS · DEPOSIT TRUST')}
        </div>
        <h1 style={{
          ...ts('h1'), fontSize: 30, lineHeight: '38px', color: TOKENS.c.white, marginTop: 12,
          whiteSpace: 'pre-line',
        }}>
          {TX(lang,
            '한국 보증금,\n돌려받지 못할까\n걱정되지 않아요',
            'No more worry\nabout getting your\nKorea deposit back')}
        </h1>
        <p style={{ ...ts('body1'), color: 'rgba(255,255,255,0.65)', marginTop: 16, whiteSpace: 'pre-line' }}>
          {TX(lang,
            '계약·보증금·반환을 한 번에.\n토스 안에서 30초만에 시작해요.',
            'Contract, lockup, return — all in one.\nStart inside Toss in 30 seconds.')}
        </p>
      </div>

      {/* Vault visual */}
      <div style={{
        position: 'absolute', left: 24, right: 24, bottom: 220,
        height: 220, borderRadius: 24, padding: 24,
        background: `linear-gradient(135deg, ${brand} 0%, ${TOKENS.brand.primaryDk} 100%)`,
        boxShadow: '0 30px 60px rgba(30,58,138,0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ ...ts('cap1'), color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>VAULT</div>
            <div style={{ ...ts('h2'), color: TOKENS.c.white, marginTop: 6 }}>BlueSafe Trust</div>
          </div>
          <IconShield color="rgba(255,255,255,0.9)" size={28}/>
        </div>
        <div style={{ marginTop: 32, ...ts('cap1'), color: 'rgba(255,255,255,0.65)' }}>LOCKED ON-CHAIN</div>
        <div style={{ ...ts('h1'), fontSize: 28, color: TOKENS.c.white, marginTop: 4 }}>
          {krw(15000000)}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          <Badge color="ink">XRPL</Badge>
          <Badge color="ink">{TX(lang, '에스크로 보증', 'ESCROW')}</Badge>
        </div>
      </div>

      {/* CTA on dark */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <div style={{ background: TOKENS.brand.ink, padding: '0 24px 32px' }}>
          <button style={{
            width: '100%', height: 56, borderRadius: 14, border: 0,
            background: TOKENS.c.white, color: TOKENS.brand.ink,
            ...ts('title2'), fontWeight: 700, cursor: 'pointer',
          }}>{TX(lang, '시작하기', 'Get started')}</button>
          <div style={{ textAlign: 'center', marginTop: 14, ...ts('label2'), color: 'rgba(255,255,255,0.5)' }}>
            {TX(lang, '토스 인증으로 30초 만에 가입', 'Sign up via Toss in 30s')}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 02 · 온보딩 캐러셀
// ════════════════════════════════════════════════════════════════
function T02_Onboarding({ lang, brand }) {
  const slides = [
    { i: 0, kicker: TX(lang, '01 · LOCKUP', '01 · LOCKUP'),
      h: TX(lang, '보증금이\n에스크로에 잠겨요', 'Your deposit is\nlocked in escrow'),
      p: TX(lang,
        '계약 기간 동안 임대인도, 임차인도\n중간에 꺼낼 수 없어요.',
        'Neither side can withdraw\nduring the lease term.') },
  ];
  const slide = slides[0];
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<button style={iconBtnStyle}><span style={{ ...ts('label1'), color: TOKENS.c.grey600 }}>{TX(lang, '건너뛰기', 'Skip')}</span></button>}/>
      <div style={{ padding: '0 24px' }}>
        <div style={{ ...ts('cap1'), color: brand, fontWeight: 700, letterSpacing: 1 }}>{slide.kicker}</div>
        <h1 style={{ ...ts('h1'), fontSize: 26, lineHeight: '34px', color: TOKENS.c.grey900, marginTop: 10, whiteSpace: 'pre-line' }}>{slide.h}</h1>
        <p style={{ ...ts('body1'), color: TOKENS.c.grey600, marginTop: 14, whiteSpace: 'pre-line' }}>{slide.p}</p>
      </div>

      {/* Illustration: vault diagram */}
      <div style={{
        margin: '32px 24px 0', height: 280, borderRadius: 20,
        background: TOKENS.c.grey50, border: `1px solid ${TOKENS.c.grey150}`,
        position: 'relative', padding: 24,
      }}>
        {/* Tenant box */}
        <div style={{ position: 'absolute', left: 24, top: 36, width: 88, padding: 12, borderRadius: 12, background: TOKENS.c.white, border: `1px solid ${TOKENS.c.grey200}`, textAlign: 'center' }}>
          <Squircle size={36} bg={TOKENS.brand.primaryLt} color={TOKENS.brand.primaryDk}><IconUser size={20}/></Squircle>
          <div style={{ ...ts('cap1'), fontWeight: 700, marginTop: 6 }}>{TX(lang, '임차인', 'Tenant')}</div>
        </div>
        {/* Landlord box */}
        <div style={{ position: 'absolute', right: 24, top: 36, width: 88, padding: 12, borderRadius: 12, background: TOKENS.c.white, border: `1px solid ${TOKENS.c.grey200}`, textAlign: 'center' }}>
          <Squircle size={36} bg={TOKENS.c.grey100} color={TOKENS.c.grey700}><IconKey size={20}/></Squircle>
          <div style={{ ...ts('cap1'), fontWeight: 700, marginTop: 6 }}>{TX(lang, '임대인', 'Landlord')}</div>
        </div>
        {/* Vault center */}
        <div style={{
          position: 'absolute', left: '50%', top: 130, transform: 'translateX(-50%)',
          width: 110, padding: 12, borderRadius: 14,
          background: brand, color: TOKENS.c.white, textAlign: 'center',
          boxShadow: `0 8px 24px ${brand}55`,
        }}>
          <IconLock color={TOKENS.c.white} size={26}/>
          <div style={{ ...ts('cap1'), fontWeight: 700, marginTop: 6 }}>VAULT</div>
          <div style={{ ...ts('cap2'), opacity: 0.8 }}>XRPL Escrow</div>
        </div>
        {/* Lines — smooth S-curves connecting cards into the vault */}
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', width: '100%', height: '100%' }} viewBox="0 0 327 232" preserveAspectRatio="none">
          <defs>
            <linearGradient id="vaultLineL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={TOKENS.c.grey300} stopOpacity="0.2"/>
              <stop offset="55%" stopColor={brand} stopOpacity="0.55"/>
              <stop offset="100%" stopColor={brand} stopOpacity="0.9"/>
            </linearGradient>
            <linearGradient id="vaultLineR" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TOKENS.c.grey300} stopOpacity="0.2"/>
              <stop offset="55%" stopColor={brand} stopOpacity="0.55"/>
              <stop offset="100%" stopColor={brand} stopOpacity="0.9"/>
            </linearGradient>
          </defs>
          <path d="M 68 92 C 68 132, 110 150, 140 158" stroke="url(#vaultLineL)" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M 259 92 C 259 132, 217 150, 187 158" stroke="url(#vaultLineR)" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
      </div>

      <div style={{ padding: '24px 24px 0', display: 'flex', gap: 6, justifyContent: 'center' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: i === 0 ? 20 : 6, height: 6, borderRadius: 3,
            background: i === 0 ? brand : TOKENS.c.grey200,
          }}/>
        ))}
      </div>

      <BottomCTA brand={brand}>{TX(lang, '다음', 'Next')}</BottomCTA>
    </Frame>
  );
}

const iconBtnStyle = { width: 'auto', height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 0, cursor: 'pointer' };

// ════════════════════════════════════════════════════════════════
// 03 · 토스 인증 (앱인토스 인증 진입)
// ════════════════════════════════════════════════════════════════
function T03_Auth({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <PageTitle sub={TX(lang, '본인 확인을 위해 한 번만 거치면 돼요', 'A one-time identity check.')}>
        {TX(lang, '토스로\n간편하게 인증하기', 'Verify quickly\nwith Toss')}
      </PageTitle>

      <Card mt={16} bg={TOKENS.c.grey50} pad={18}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Squircle size={48} bg={TOKENS.c.white} color={TOKENS.brand.ink}>
            <IconShield size={24} color={TOKENS.brand.ink}/>
          </Squircle>
          <div style={{ flex: 1 }}>
            <div style={{ ...ts('title2') }}>{TX(lang, '안전한 본인확인', 'Secure identity check')}</div>
            <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, marginTop: 2 }}>
              {TX(lang, '주민등록·외국인등록 정보를 사용해요', 'Uses national / ARC records')}
            </div>
          </div>
        </div>
      </Card>

      <SectionHeader>{TX(lang, 'BlueSafe가 받아오는 정보', 'What BlueSafe will receive')}</SectionHeader>
      {[
        { t: TX(lang, '이름·생년월일', 'Name · DOB'), s: TX(lang, '계약서 자동 채우기에 사용', 'Used to auto-fill the lease') },
        { t: TX(lang, '외국인등록번호', 'Alien registration #'), s: TX(lang, 'KYC 1단계 통과', 'Pass KYC tier 1') },
        { t: TX(lang, '본인 명의 계좌', 'Owned bank account'), s: TX(lang, '보증금 입출금 검증', 'Verify deposit in/out') },
      ].map((r, i) => (
        <ListRow key={i}
          leading={<Squircle size={36} bg={TOKENS.brand.primaryLt} color={TOKENS.brand.primaryDk}><IconCheck size={18} stroke={2.5}/></Squircle>}
          title={r.t} sub={r.s}
        />
      ))}

      <div style={{ padding: '12px 24px 0', ...ts('cap1'), color: TOKENS.c.grey500 }}>
        {TX(lang, '토스 약관에 따라 안전하게 처리돼요. BlueSafe 서버에는 암호화돼서 보관돼요.', 'Handled safely under Toss terms. Encrypted on BlueSafe servers.')}
      </div>

      <BottomCTA brand={brand}
        lower={<span style={{ ...ts('cap1'), color: TOKENS.c.grey500 }}>{TX(lang, '약관 전체 보기', 'View full terms')}</span>}
      >{TX(lang, '토스로 인증하기', 'Verify with Toss')}</BottomCTA>
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 04 · 외국인 KYC
// ════════════════════════════════════════════════════════════════
function T04_KYC({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <div style={{ padding: '0 24px' }}>
        <Stepper steps={[1,2,3]} current={1} color={brand}/>
      </div>
      <PageTitle mt={20}>
        {TX(lang, '외국인 등록증을\n업로드해요', 'Upload your\nARC card')}
      </PageTitle>

      {/* Camera preview placeholder */}
      <div style={{
        margin: '0 24px', height: 200, borderRadius: 16,
        background: TOKENS.brand.ink, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 24,
          border: `2px dashed rgba(255,255,255,0.5)`, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...ts('label1'), color: 'rgba(255,255,255,0.7)',
        }}>{TX(lang, '여기에 카드를 맞춰요', 'Align card inside frame')}</div>
        {/* corner brackets */}
        {[
          { top: 24, left: 24, br: 'tl' }, { top: 24, right: 24, br: 'tr' },
          { bottom: 24, left: 24, br: 'bl' }, { bottom: 24, right: 24, br: 'br' },
        ].map((c, i) => {
          const map = { tl: { borderTop: 1, borderLeft: 1 }, tr: { borderTop: 1, borderRight: 1 },
                        bl: { borderBottom: 1, borderLeft: 1 }, br: { borderBottom: 1, borderRight: 1 } };
          const sides = map[c.br];
          return (
            <div key={i} style={{ position: 'absolute', ...c, width: 22, height: 22,
              borderTopWidth: sides.borderTop ? 3 : 0, borderRightWidth: sides.borderRight ? 3 : 0,
              borderBottomWidth: sides.borderBottom ? 3 : 0, borderLeftWidth: sides.borderLeft ? 3 : 0,
              borderStyle: 'solid', borderColor: brand, borderRadius: 4 }}/>
          );
        })}
      </div>

      <SectionHeader mt={20}>{TX(lang, '확인 항목', 'Checklist')}</SectionHeader>
      {[
        TX(lang, '카드 전체가 프레임에 들어왔는지', 'Whole card inside frame'),
        TX(lang, '글자가 흐릿하지 않은지', 'Text not blurry'),
        TX(lang, '뒷면 칩이 보이지 않는지 (선택)', 'Chip side hidden (optional)'),
      ].map((t, i) => (
        <ListRow key={i}
          leading={<div style={{ width: 24, height: 24, borderRadius: 12, background: TOKENS.brand.primaryLt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconCheck color={TOKENS.brand.primaryDk} size={14} stroke={3}/>
          </div>}
          title={<span style={{ ...ts('body1') }}>{t}</span>}
        />
      ))}

      <BottomCTA brand={brand}>{TX(lang, '촬영하기', 'Take photo')}</BottomCTA>
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 05 · 임대인 초대 (계약 시작)
// ════════════════════════════════════════════════════════════════
function T05_Invite({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<button style={iconBtnStyle}><IconClose color={TOKENS.c.grey700}/></button>}/>
      <PageTitle sub={TX(lang, '카카오·문자 어디로든 보낼 수 있어요', 'Send via KakaoTalk or SMS')}>
        {TX(lang, '집주인을\n초대해요', 'Invite your\nlandlord')}
      </PageTitle>

      <Card mt={8} bg={TOKENS.c.grey50} pad={20} radius={16}>
        <div style={{ ...ts('label2'), color: TOKENS.c.grey600 }}>{TX(lang, '초대 링크', 'Invite link')}</div>
        <div style={{ ...ts('body1'), fontFamily: TOKENS.t.mono, color: TOKENS.c.grey800, marginTop: 6, wordBreak: 'break-all' }}>
          bluesafe.app/r/8KQ-91D-LM2
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <div style={{ flex: 1 }}><Button size="m" color="brand" variant="weak" brand={brand}>{TX(lang, '복사', 'Copy')}</Button></div>
          <div style={{ flex: 1 }}><Button size="m" color="brand" variant="weak" brand={brand}>{TX(lang, '카카오톡', 'KakaoTalk')}</Button></div>
          <div style={{ flex: 1 }}><Button size="m" color="brand" variant="weak" brand={brand}>{TX(lang, '문자', 'SMS')}</Button></div>
        </div>
      </Card>

      <SectionHeader>{TX(lang, '집주인이 할 일', 'What landlord will do')}</SectionHeader>
      {[
        { n: '1', t: TX(lang, '링크 클릭 → 토스 인증', 'Open link → Toss verify'), s: TX(lang, '같은 BlueSafe 미니앱이 열려요', 'Opens same BlueSafe mini-app') },
        { n: '2', t: TX(lang, '계약서 확인 + 서명', 'Review + sign lease'), s: TX(lang, '평균 4분', 'Avg. 4 minutes') },
        { n: '3', t: TX(lang, '보증금 받기 계좌 등록', 'Register payout account'), s: TX(lang, '본인 명의만 가능', 'Owner account only') },
      ].map((r, i) => (
        <ListRow key={i}
          leading={
            <div style={{
              width: 40, height: 40, borderRadius: 14, background: TOKENS.brand.primaryLt,
              color: TOKENS.brand.primaryDk, display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...ts('title2'), fontWeight: 700,
            }}>{r.n}</div>
          }
          title={r.t} sub={r.s}
        />
      ))}

      <BottomCTA brand={brand} secondary={TX(lang, '나중에', 'Later')}>{TX(lang, '카카오톡으로 보내기', 'Send via Kakao')}</BottomCTA>
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 06 · 3자 계약서 (스크롤뷰 + 서명)
// ════════════════════════════════════════════════════════════════
function T06_Contract({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<Badge color="green">{TX(lang, '검토 중', 'Reviewing')}</Badge>}/>
      <PageTitle sub={TX(lang, '집주인·BlueSafe·임차인 모두가 서명해요', 'Signed by landlord, BlueSafe, tenant')}>
        {TX(lang, '3자 안심 계약서', '3-party trust lease')}
      </PageTitle>

      {/* Document preview card */}
      <Card mt={4} pad={20} bg={TOKENS.c.grey50} radius={16}>
        <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, fontWeight: 700, letterSpacing: 1 }}>
          BLUESAFE TRUST LEASE · v1
        </div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '88px 1fr', gap: '10px 12px', ...ts('body2') }}>
          <span style={{ color: TOKENS.c.grey500 }}>{TX(lang, '주소', 'Address')}</span>
          <span style={{ color: TOKENS.c.grey900 }}>{TX(lang, '서울시 마포구 망원동 12-3, 302호', 'Seoul, Mapo, Mangwon 12-3, #302')}</span>
          <span style={{ color: TOKENS.c.grey500 }}>{TX(lang, '계약 기간', 'Term')}</span>
          <span style={{ color: TOKENS.c.grey900 }}>2026.06.01 — 2027.05.31</span>
          <span style={{ color: TOKENS.c.grey500 }}>{TX(lang, '월세', 'Monthly rent')}</span>
          <span style={{ color: TOKENS.c.grey900 }}>{krw(680000)}</span>
          <span style={{ color: TOKENS.c.grey500 }}>{TX(lang, '보증금', 'Deposit')}</span>
          <span style={{ color: TOKENS.c.grey900, fontWeight: 700 }}>{krw(15000000)}</span>
          <span style={{ color: TOKENS.c.grey500 }}>{TX(lang, '관리비', 'Maintenance')}</span>
          <span style={{ color: TOKENS.c.grey900 }}>{TX(lang, '월 70,000원 (수도·인터넷 포함)', `${krw(70000)} (water · internet incl.)`)}</span>
        </div>
      </Card>

      <SectionHeader>{TX(lang, '안심 조항 3가지', '3 trust clauses')}</SectionHeader>
      {[
        { i: '§1', t: TX(lang, '보증금은 XRPL 에스크로에 잠겨요', 'Deposit locked in XRPL escrow'), s: TX(lang, '계약 기간엔 양쪽 모두 못 꺼내요', 'Neither party can withdraw during term') },
        { i: '§2', t: TX(lang, '퇴실 후 7일 이내 자동 반환돼요', 'Auto-return within 7 days of move-out'), s: TX(lang, '집주인 응답이 없어도 풀려요', 'Releases even if landlord is silent') },
        { i: '§3', t: TX(lang, '분쟁 시 BlueSafe 패널이 판정해요', 'Disputes resolved by BlueSafe panel'), s: TX(lang, '평균 처리 4.2일', 'Avg. resolution 4.2d') },
      ].map((c, i) => (
        <ListRow key={i}
          leading={<div style={{ width: 36, height: 36, borderRadius: 10, background: TOKENS.brand.ink, color: TOKENS.c.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>{c.i}</div>}
          title={c.t} sub={c.s}
        />
      ))}

      <BottomCTA brand={brand}
        checkbox={<label style={{ display: 'flex', gap: 10, alignItems: 'center', ...ts('label1'), color: TOKENS.c.grey800 }}>
          <span style={{ width: 22, height: 22, borderRadius: 11, background: brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconCheck color={TOKENS.c.white} size={14} stroke={3}/>
          </span>
          {TX(lang, '전체 약관에 동의해요', 'I agree to all terms')}
        </label>}
      >{TX(lang, '서명하고 계속', 'Sign and continue')}</BottomCTA>
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 07 · 보증금 납부 (Keypad)
// ════════════════════════════════════════════════════════════════
function T07_Pay({ lang, brand }) {
  const amount = '15,000,000';
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<Badge color="ink">XRPL</Badge>}/>
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ ...ts('cap1'), color: TOKENS.c.grey600 }}>{TX(lang, '안전 송금 금액', 'Trust transfer amount')}</div>
        <div style={{ ...ts('h1'), fontSize: 36, lineHeight: '44px', color: TOKENS.c.grey900, marginTop: 4, fontWeight: 700, letterSpacing: -1 }}>
          {amount}<span style={{ ...ts('h2'), color: TOKENS.c.grey500, marginLeft: 6 }}>{TX(lang, '원', 'KRW')}</span>
        </div>
      </div>

      {/* Quote card */}
      <Card pad={16} bg={TOKENS.c.grey50} radius={12}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...ts('label1') }}>
          <span style={{ color: TOKENS.c.grey700 }}>{TX(lang, 'XRPL Escrow 시세', 'XRPL escrow rate')}</span>
          <span style={{ color: TOKENS.c.grey900, fontWeight: 700 }}>1 XRP ≈ 850원</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...ts('label1'), marginTop: 8 }}>
          <span style={{ color: TOKENS.c.grey700 }}>{TX(lang, '잠금 수량', 'Locked amount')}</span>
          <span style={{ color: brand, fontWeight: 700 }}>17,647 XRP</span>
        </div>
        <div style={{ height: 1, background: TOKENS.c.grey150, margin: '12px 0' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...ts('label1') }}>
          <span style={{ color: TOKENS.c.grey700 }}>{TX(lang, '수수료', 'Fee')}</span>
          <span style={{ color: TOKENS.c.grey900 }}>{TX(lang, '0원 (BlueSafe 부담)', '₩0 (covered by BlueSafe)')}</span>
        </div>
      </Card>

      <SectionHeader>{TX(lang, '결제 수단', 'Payment method')}</SectionHeader>
      <ListRow
        leading={<Squircle size={40} bg={TOKENS.brand.ink} color={TOKENS.c.white}><IconWallet size={20} color={TOKENS.c.white}/></Squircle>}
        title={TX(lang, '토스뱅크 입출금', 'Toss Bank account')}
        sub="••• 8821"
        tail={<Badge color="blue">{TX(lang, '기본', 'Default')}</Badge>}
      />
      <Divider/>
      <ListRow
        leading={<Squircle size={40} bg={TOKENS.c.grey100} color={TOKENS.c.grey600}><IconPlus size={20}/></Squircle>}
        title={<span style={{ color: TOKENS.c.grey600 }}>{TX(lang, '다른 계좌 추가', 'Add another account')}</span>}
      />

      <BottomCTA brand={brand}>{TX(lang, '15,000,000원 안전 송금', 'Send 15,000,000 safely')}</BottomCTA>
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 08 · 영수증 (LOCKED 성공)
// ════════════════════════════════════════════════════════════════
function T08_Receipt({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.grey50}>
      <TopBar onBack={false} right={<button style={iconBtnStyle}><IconClose color={TOKENS.c.grey700}/></button>}/>

      {/* Hero check */}
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{
          width: 88, height: 88, margin: '8px auto 0', borderRadius: 44,
          background: TOKENS.brand.primaryLt, color: brand,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 0 12px ${TOKENS.brand.primaryLt}55`,
        }}>
          <IconCheck size={44} stroke={3} color={brand}/>
        </div>
        <h1 style={{ ...ts('h1'), fontSize: 24, marginTop: 18, color: TOKENS.c.grey900 }}>
          {TX(lang, '보증금이 잠겼어요', 'Your deposit is locked')}
        </h1>
        <p style={{ ...ts('body1'), color: TOKENS.c.grey600, marginTop: 6 }}>
          {TX(lang, '2027년 5월 31일까지 안전하게 보관돼요', 'Held safely until May 31, 2027')}
        </p>
      </div>

      {/* Receipt card */}
      <Card mt={24} pad={0} radius={16}>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ ...ts('label2'), color: TOKENS.c.grey600 }}>{TX(lang, '안전 송금 금액', 'Trust amount')}</span>
            <span style={{ ...ts('title2'), color: TOKENS.c.grey900, fontWeight: 700 }}>{krw(15000000)}</span>
          </div>
          {[
            [TX(lang, '계약 기간', 'Term'), '2026.06.01–2027.05.31'],
            [TX(lang, '집', 'Property'), TX(lang, '망원동 12-3, 302호', 'Mangwon 12-3, #302')],
            [TX(lang, '집주인', 'Landlord'), TX(lang, '김 ○ ○', 'Kim ○○')],
            [TX(lang, 'XRPL TX', 'XRPL TX'), 'F2A8…91D3'],
          ].map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ ...ts('label2'), color: TOKENS.c.grey600 }}>{k}</span>
              <span style={{ ...ts('label1'), color: TOKENS.c.grey900, fontFamily: i === 3 ? TOKENS.t.mono : 'inherit' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px dashed ${TOKENS.c.grey200}`, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...ts('cap1'), color: TOKENS.c.grey500 }}>{TX(lang, '온체인 영수증', 'On-chain receipt')}</span>
          <button style={{ ...ts('label1'), color: brand, background: 'transparent', border: 0, cursor: 'pointer', fontWeight: 700 }}>
            {TX(lang, '익스플로러로 보기 →', 'View on explorer →')}
          </button>
        </div>
      </Card>

      <BottomCTA brand={brand} secondary={TX(lang, '공유', 'Share')}>{TX(lang, '홈으로', 'Go home')}</BottomCTA>
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 09 · HOME ★ (메인 대시보드)
// ════════════════════════════════════════════════════════════════
function T09_Home({ lang, brand }) {
  return (
    <Frame bg={TOKENS.brand.canvas}>
      {/* Top bar with profile + bell */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 16px 0 24px' }}>
        <div style={{ ...ts('h2'), color: TOKENS.c.grey900 }}>BlueSafe</div>
        <span style={{ flex: 1 }}/>
        <button style={iconBtn}><IconBell color={TOKENS.c.grey800}/></button>
        <button style={iconBtn}><div style={{ width: 28, height: 28, borderRadius: 14, background: TOKENS.brand.ink, color: TOKENS.c.white, display: 'flex', alignItems: 'center', justifyContent: 'center', ...ts('cap1'), fontWeight: 700 }}>S</div></button>
      </div>

      {/* Vault hero */}
      <div style={{
        margin: '4px 24px 0', borderRadius: 20,
        background: `linear-gradient(135deg, ${TOKENS.brand.ink} 0%, ${TOKENS.brand.inkSoft} 100%)`,
        padding: '22px 22px 18px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, background: brand, opacity: 0.18 }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...ts('cap1'), color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: 1 }}>VAULT · LOCKED</span>
          <Badge color="ink"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: brand, display: 'inline-block' }}/>XRPL</span></Badge>
        </div>
        <div style={{ ...ts('h1'), fontSize: 30, color: TOKENS.c.white, marginTop: 12, fontWeight: 700, letterSpacing: -0.5 }}>
          {krw(15000000)}
        </div>
        <div style={{ ...ts('cap1'), color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
          ≈ 17,647 XRP
        </div>
        <div style={{ marginTop: 18, height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: '23%', height: '100%', background: brand, borderRadius: 3 }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, ...ts('cap1'), color: 'rgba(255,255,255,0.65)' }}>
          <span>{TX(lang, '83일 거주중', 'Day 83 of stay')}</span>
          <span>{TX(lang, '282일 남음', '282 days left')}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '20px 24px 0' }}>
        {[
          { i: <IconChart size={22}/>, t: TX(lang, '리포트', 'Report') },
          { i: <IconCoin size={22}/>, t: TX(lang, '공과금', 'Bills') },
          { i: <IconAlert size={22}/>, t: TX(lang, '이의제기', 'Dispute') },
          { i: <IconDoc size={22}/>, t: TX(lang, '계약서', 'Lease') },
        ].map((a, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Squircle size={48} bg={TOKENS.c.white} color={TOKENS.brand.ink}>{a.i}</Squircle>
            <span style={{ ...ts('cap1'), color: TOKENS.c.grey700, fontWeight: 600 }}>{a.t}</span>
          </div>
        ))}
      </div>

      <SectionHeader mt={20} right={TX(lang, '전체', 'All')}>{TX(lang, '오늘 할 일', 'For you today')}</SectionHeader>
      <Card mx={24} pad={0} radius={14} bg={TOKENS.c.white}>
        <ListRow
          leading={<Squircle size={36} bg="#FFF6D9" color="#946100"><IconAlert size={20} color="#946100"/></Squircle>}
          title={TX(lang, '8월 가스비가 평소보다 12% 높아요', 'Aug. gas bill is 12% above normal')}
          sub={TX(lang, '이의제기 가능', 'Eligible to dispute')}
          tail={<ChevronRight color={TOKENS.c.grey400}/>}
          divider
        />
        <ListRow
          leading={<Squircle size={36} bg={TOKENS.brand.primaryLt} color={TOKENS.brand.primaryDk}><IconStar size={20} color={TOKENS.brand.primaryDk} fill={TOKENS.brand.primaryDk}/></Squircle>}
          title={TX(lang, '평판 기록이 시작됐어요', 'Reputation record started')}
          sub={TX(lang, '한 방울 → 시내, 거주 60일 달성', 'Drop → Stream, Day 60')}
          tail={<ChevronRight color={TOKENS.c.grey400}/>}
        />
      </Card>

      <Spacer h={24}/>

      <TabBar items={[
        { icon: <IconHome/>, label: TX(lang, '홈', 'Home') },
        { icon: <IconChart/>, label: TX(lang, '내역', 'Activity') },
        { icon: <IconShield/>, label: TX(lang, '보호', 'Protect') },
        { icon: <IconUser/>, label: TX(lang, '내정보', 'Me') },
      ]} active={0} brand={brand}/>
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 10 · 자동 반환 카운트다운
// ════════════════════════════════════════════════════════════════
function T10_Countdown({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <PageTitle sub={TX(lang, '집주인이 응답하지 않아도 자동으로 풀려요', 'Auto-releases even if landlord stays silent')}>
        {TX(lang, '자동 반환까지', 'Until auto-return')}
      </PageTitle>

      <div style={{ textAlign: 'center', padding: '24px 24px 8px' }}>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          {[
            { n: '06', l: TX(lang, '일', 'Days') },
            { n: '14', l: TX(lang, '시간', 'Hours') },
            { n: '32', l: TX(lang, '분', 'Min') },
          ].map((b, i) => (
            <div key={i} style={{ width: 88, padding: 14, background: TOKENS.brand.ink, color: TOKENS.c.white, borderRadius: 14 }}>
              <div style={{ ...ts('h1'), fontSize: 32, color: TOKENS.c.white, fontFamily: TOKENS.t.mono, fontWeight: 700 }}>{b.n}</div>
              <div style={{ ...ts('cap1'), color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{b.l}</div>
            </div>
          ))}
        </div>
      </div>

      <Card mt={24} pad={20} radius={16} bg={TOKENS.brand.primaryLt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconShield color={TOKENS.brand.primaryDk} size={24}/>
          <span style={{ ...ts('title2'), color: TOKENS.brand.primaryDk }}>
            {TX(lang, '아무것도 안 해도 돼요', 'You don\'t need to do anything')}
          </span>
        </div>
        <p style={{ ...ts('body2'), color: TOKENS.brand.primaryDk, marginTop: 8 }}>
          {TX(lang,
            '이 시간이 지나면 보증금 15,000,000원이 자동으로 토스 계좌로 들어와요.',
            'After this timer, 15,000,000 KRW auto-arrives in your Toss account.')}
        </p>
      </Card>

      <SectionHeader>{TX(lang, '진행 상황', 'Status')}</SectionHeader>
      {[
        { kind: 'done', t: TX(lang, '퇴실 체크리스트 완료', 'Move-out checklist done'), s: '2027.05.31 14:02' },
        { kind: 'done', t: TX(lang, '집주인 확인 요청 발송', 'Landlord notified'), s: '2027.05.31 14:03' },
        { kind: 'wait', t: TX(lang, '집주인 응답 대기', 'Awaiting landlord response'), s: TX(lang, '7일 안에 응답 없으면 자동 반환', 'Auto-release if no reply in 7d') },
        { kind: 'todo', t: TX(lang, '보증금 반환', 'Deposit returned'), s: '2027.06.07 (예상)' },
      ].map((r, i) => (
        <ListRow key={i}
          leading={<div style={{
            width: 28, height: 28, borderRadius: 14,
            background: r.kind === 'done' ? brand : (r.kind === 'wait' ? TOKENS.c.white : TOKENS.c.grey150),
            border: r.kind === 'wait' ? `2px solid ${brand}` : 0,
            color: r.kind === 'done' ? TOKENS.c.white : (r.kind === 'wait' ? brand : TOKENS.c.grey400),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{r.kind === 'done' ? <IconCheck size={16} stroke={3}/> : (r.kind === 'wait' ? <IconDots size={14}/> : null)}</div>}
          title={<span style={{ color: r.kind === 'todo' ? TOKENS.c.grey700 : TOKENS.c.grey900 }}>{r.t}</span>}
          sub={r.s}
        />
      ))}
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 11 · 월간 안전 리포트
// ════════════════════════════════════════════════════════════════
function T11_Report({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<button style={iconBtnStyle}><IconMore color={TOKENS.c.grey700}/></button>}/>
      <PageTitle sub="2026.08 · BlueSafe Trust">
        {TX(lang, '8월 안전 리포트', 'Aug. trust report')}
      </PageTitle>

      <Card mt={4} bg={TOKENS.brand.ink} pad={20} radius={16}>
        <div style={{ ...ts('cap1'), color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: 1 }}>SAFETY SCORE</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 48, lineHeight: 1, color: TOKENS.c.white, fontWeight: 700, letterSpacing: -1 }}>97</span>
          <span style={{ ...ts('label1'), color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>/ 100</span>
        </div>
        <div style={{ marginTop: 14, height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: '97%', height: '100%', background: brand }}/>
        </div>
        <div style={{ ...ts('cap1'), color: 'rgba(255,255,255,0.65)', marginTop: 8 }}>
          {TX(lang, '지난달보다 +3 ↑', '+3 vs. last month')}
        </div>
      </Card>

      <SectionHeader>{TX(lang, '항목별 점수', 'Breakdown')}</SectionHeader>
      {[
        { t: TX(lang, '월세 정시 납부', 'Rent paid on time'), v: 100, val: '6/6' },
        { t: TX(lang, '공과금 적정성', 'Bill normality'), v: 88, val: TX(lang, '평균 대비 +12%', '+12% vs avg') },
        { t: TX(lang, '집주인 응답성', 'Landlord responsiveness'), v: 95, val: TX(lang, '평균 4시간', 'avg 4h') },
        { t: TX(lang, '문서 보관', 'Document upkeep'), v: 100, val: TX(lang, '모두 완료', 'all done') },
      ].map((r, i) => (
        <div key={i} style={{ padding: '14px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...ts('label1'), color: TOKENS.c.grey800 }}>
            <span>{r.t}</span><span style={{ color: TOKENS.c.grey600 }}>{r.val}</span>
          </div>
          <div style={{ marginTop: 8 }}><ProgressBar value={r.v} color={brand}/></div>
        </div>
      ))}

      <Spacer h={24}/>
    </Frame>
  );
}

// ════════════════════════════════════════════════════════════════
// 12 · 평판 SBT — 식물 성장 등급 시스템
// ════════════════════════════════════════════════════════════════

// ── BlueSafe water drop 3D — glossy navy/cyan teardrops on a calm pool

// Teardrop profile (revolved via LatheGeometry)
const dropProfile = (T) => {
  const pts = [
    [0,    1.40],
    [0.10, 1.20],
    [0.22, 0.95],
    [0.38, 0.70],
    [0.52, 0.42],
    [0.58, 0.18],
    [0.50, 0.04],
    [0.30, 0.00],
    [0,    0.00],
  ];
  return pts.map(([x,y]) => new T.Vector2(x, y));
};

const Plant3D = ({ kind, size = 28, hero = false }) => {
  const mountRef = React.useRef(null);
  React.useEffect(() => {
    const T = window.THREE; if (!T || !mountRef.current) return;
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(2.8, 2.4, 4.0); camera.lookAt(0, 0.55, 0);

    // Lighting — bright key, cool fill, warm rim for highlight
    scene.add(new T.AmbientLight(0xffffff, 0.5));
    const key = new T.DirectionalLight(0xffffff, 1.7); key.position.set(3, 5, 4);
    key.castShadow = true; key.shadow.mapSize.set(512, 512);
    key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;
    scene.add(key);
    const fill = new T.DirectionalLight(0x9ED2FF, 0.7); fill.position.set(-4, 2, 2); scene.add(fill);
    const rim  = new T.PointLight(0xFFFFFF, 0.8, 8);    rim.position.set(2, 4, 3);    scene.add(rim);

    const floor = new T.Mesh(new T.CircleGeometry(3, 48), new T.ShadowMaterial({ opacity: 0.20 }));
    floor.rotation.x = -Math.PI/2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);

    // Material helpers
    const Glossy = (color) => new T.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.35, envMapIntensity: 1 });
    const Matte  = (color, r=0.6) => new T.MeshStandardMaterial({ color, roughness: r, metalness: 0.05 });

    // Geometry helpers
    const dropGeom = (T) => new T.LatheGeometry(dropProfile(T), 48);
    const makeDrop = (color, scl=1) => {
      const m = new T.Mesh(dropGeom(T), Glossy(color));
      m.scale.setScalar(scl); m.castShadow = true; return m;
    };
    const makeShine = (size, x, y, z) => {
      const s = new T.Mesh(new T.SphereGeometry(size, 12, 12), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
      s.position.set(x, y, z); return s;
    };
    const makePool = (radius, color, h=0.06) => {
      const g = new T.CylinderGeometry(radius, radius, h, 48);
      const m = new T.Mesh(g, Glossy(color));
      m.position.y = h/2; m.receiveShadow = true; return m;
    };
    const makeRipple = (radius, thickness, color) => {
      const g = new T.TorusGeometry(radius, thickness, 12, 48);
      const m = new T.Mesh(g, Glossy(color));
      m.rotation.x = Math.PI/2; return m;
    };

    const grp = new T.Group();

    // Stage colors — navy → cyan gradient on the way up; warm/grey for decline
    if (kind === 'mighty') {
      // Ocean — big drop sitting in a wide pool with two satellites + ripple
      grp.add(makePool(1.15, 0x1565C0));
      grp.add(makeRipple(0.95, 0.04, 0x42A5F5));
      const big = makeDrop(0x0D47A1, 0.95); big.position.y = 0.05; grp.add(big);
      grp.add(makeShine(0.10, -0.18, 1.05, 0.45));
      const s1 = makeDrop(0x1976D2, 0.4); s1.position.set(-0.95, 0.05, 0.55); grp.add(s1);
      const s2 = makeDrop(0x42A5F5, 0.32); s2.position.set(0.85, 0.05, 0.65); grp.add(s2);
    } else if (kind === 'tree') {
      // Spring — single tall drop on a calm pool
      grp.add(makePool(1.0, 0x1976D2));
      grp.add(makeRipple(0.78, 0.03, 0x64B5F6));
      const big = makeDrop(0x1565C0, 0.92); big.position.y = 0.05; grp.add(big);
      grp.add(makeShine(0.09, -0.16, 1.00, 0.42));
      grp.add(makeShine(0.04, 0.10, 0.55, 0.55));
    } else if (kind === 'sapling') {
      // Stream — medium drop, narrower pool
      grp.add(makePool(0.85, 0x1E88E5));
      grp.add(makeRipple(0.65, 0.025, 0x90CAF9));
      const d = makeDrop(0x1976D2, 0.78); d.position.y = 0.05; grp.add(d);
      grp.add(makeShine(0.075, -0.14, 0.85, 0.36));
    } else if (kind === 'sprout') {
      // Drop — small drop in a small pool
      grp.add(makePool(0.7, 0x29B6F6));
      grp.add(makeRipple(0.5, 0.02, 0xB3E5FC));
      const d = makeDrop(0x1E88E5, 0.62); d.position.y = 0.05; grp.add(d);
      grp.add(makeShine(0.06, -0.11, 0.72, 0.30));
    } else if (kind === 'seed') {
      // Dewdrop — tiny dew sitting on a dish
      grp.add(makePool(0.58, 0x4FC3F7, 0.04));
      const d = makeDrop(0x29B6F6, 0.42); d.position.y = 0.04; grp.add(d);
      grp.add(makeShine(0.045, -0.08, 0.50, 0.22));
    } else if (kind === 'withering') {
      // Drying — half-evaporated drop, warm tone
      grp.add(makePool(0.8, 0xFFB74D, 0.05));
      const halfG = new T.SphereGeometry(0.5, 32, 24, 0, Math.PI*2, 0, Math.PI/2);
      const half = new T.Mesh(halfG, Glossy(0xFB8C00));
      half.position.y = 0.05; half.scale.set(1.1, 0.7, 1.1); half.castShadow=true; grp.add(half);
      grp.add(makeShine(0.05, -0.12, 0.32, 0.38));
      // small evaporating speck
      const sp = makeDrop(0xFFA726, 0.18); sp.position.set(0.55, 0.05, -0.2); grp.add(sp);
    } else { /* dead — Cracked dry plate */
      const plate = new T.Mesh(new T.CylinderGeometry(0.95, 0.95, 0.08, 36), Matte(0x9E9E9E, 0.85));
      plate.position.y = 0.04; plate.receiveShadow=true; plate.castShadow=true; grp.add(plate);
      // crack lines as thin boxes
      [[0, 0.2, 0], [0.4, -0.5, 1.1], [-0.5, 0.3, 0.6]].forEach(([x,z,rot])=>{
        const c = new T.Mesh(new T.BoxGeometry(1.4, 0.012, 0.05), Matte(0x424242, 0.95));
        c.position.set(x, 0.085, z); c.rotation.y = rot; grp.add(c);
      });
      // dust speck
      const dust = new T.Mesh(new T.SphereGeometry(0.08, 12, 12), Matte(0xBDBDBD));
      dust.position.set(-0.3, 0.13, 0.2); dust.castShadow=true; grp.add(dust);
    }

    // wobble for cuteness
    grp.rotation.y = -0.18;
    grp.position.y = 0; scene.add(grp);

    renderer.render(scene, camera);
    return () => { renderer.dispose(); };
  }, [kind, size]);
  return <div ref={mountRef} style={{ width: size, height: size, display: 'inline-block' }}/>;
};

// Plant glyphs (inline SVG, font-independent)
const PlantGlyph = ({ kind, size = 28 }) => {
  const s = size;
  if (kind === 'mighty')   return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M16 4c-5 0-9 4-9 8 0 1 .3 2 .8 2.8C5.5 16 4 18 4 20.5 4 23.5 6.5 26 9.5 26h13c3 0 5.5-2.5 5.5-5.5 0-2.5-1.5-4.5-3.8-5.7.5-.8.8-1.8.8-2.8 0-4-4-8-9-8z" fill="#1B5E20"/>
      <path d="M14 26h4v3h-4z" fill="#5D4037"/>
    </svg>
  );
  if (kind === 'tree')     return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M16 4l-7 10h3l-5 7h4l-4 6h18l-4-6h4l-5-7h3z" fill="#2E7D32"/>
      <path d="M14 27h4v3h-4z" fill="#5D4037"/>
    </svg>
  );
  if (kind === 'sapling')  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <ellipse cx="9" cy="12" rx="5" ry="6" fill="#7CB342"/>
      <ellipse cx="22" cy="12" rx="5" ry="6" fill="#9CCC65"/>
      <ellipse cx="16" cy="8" rx="5" ry="6" fill="#8BC34A"/>
      <path d="M14 18h4v6h-4z" fill="#5D4037"/>
      <path d="M10 24h12l-1.5 4h-9z" fill="#A1887F"/>
    </svg>
  );
  if (kind === 'sprout')   return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M16 18C10 14 8 10 9 6c4 0 7 2 8 6 1-3 3-5 7-5-1 5-3 8-8 11z" fill="#9CCC65"/>
      <path d="M15 18h2v8h-2z" fill="#558B2F"/>
      <path d="M9 26h14l-1 3H10z" fill="#6D4C41"/>
    </svg>
  );
  if (kind === 'seed')     return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M5 22h22l-2 6H7z" fill="#5D4037"/>
      <ellipse cx="16" cy="20" rx="5" ry="4" fill="#3E2723"/>
      <path d="M16 16c0-2 1-4 3-4-1 3-2 4-3 4z" fill="#6D4C41"/>
    </svg>
  );
  if (kind === 'withering')return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M16 6v16" stroke="#8D6E63" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 10c-4 0-6-2-7-5 4 0 6 1 7 3M16 14c4-1 6-3 7-6-3 0-5 2-7 4" fill="#FFB74D"/>
      <path d="M14 22h4l-1 6h-2z" fill="#FB8C00"/>
      <path d="M9 26h14l-1 3H10z" fill="#6D4C41"/>
    </svg>
  );
  /* dead */               return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M16 8l-5 8 4-1-3 7 8-5-3-1 5-7z" fill="#C62828"/>
      <path d="M9 26h14l-1 3H10z" fill="#757575"/>
    </svg>
  );
};

const TIERS = [
  { k: 'mighty',    en: 'Ocean',   ko: '바다',       min: 99,   max: 100,  hex: '#0D47A1', bg: '#E3F2FD' },
  { k: 'tree',      en: 'Spring',  ko: '샘',         min: 80,   max: 98,   hex: '#1565C0', bg: '#E3F2FD' },
  { k: 'sapling',   en: 'Stream',  ko: '시내',       min: 60,   max: 79,   hex: '#1976D2', bg: '#E1F5FE' },
  { k: 'sprout',    en: 'Drop',    ko: '한 방울',    min: 36.5, max: 59,   hex: '#1E88E5', bg: '#E1F5FE' },
  { k: 'seed',      en: 'Dewdrop', ko: '이슬',       min: 20,   max: 36.4, hex: '#29B6F6', bg: '#F0F9FF' },
  { k: 'withering', en: 'Drying',  ko: '마르는',     min: 5,    max: 19,   hex: '#FB8C00', bg: '#FFF3E0' },
  { k: 'dead',      en: 'Cracked', ko: '갈라진',     min: 0,    max: 4,    hex: '#B71C1C', bg: '#FFEBEE' },
];

function T12_SBT({ lang, brand, glyph3D = true }) {
  const score = 97;
  const Glyph = glyph3D ? Plant3D : PlantGlyph;
  const current = TIERS.find(t => score >= t.min && score <= t.max) || TIERS[1];
  // next-up tier (the one immediately above current)
  const currentIdx = TIERS.indexOf(current);
  const next = TIERS[currentIdx - 1] || current;
  const distanceToNext = next === current ? 0 : (next.min - score);

  return (
    <Frame bg={TOKENS.brand.canvas}>
      <TopBar onBack={true}/>
      <PageTitle sub={TX(lang, '꾸준히 살수록 차올라요. 다음 집에서 써먹을 수 있어요.', 'Fills the longer you stay. Bring it to your next home.')}>
        {TX(lang, '평판이 차올라요', 'Your reputation, filling')}
      </PageTitle>

      {/* Hero — studio surface for 3D subject */}
      <div style={{
        margin: '8px 24px 0', borderRadius: 22, padding: '28px 22px 22px',
        background: glyph3D
          ? `radial-gradient(ellipse at 50% 35%, #FFFFFF 0%, ${current.bg} 75%, ${current.bg} 100%)`
          : current.bg,
        textAlign: 'center',
      }}>
        {/* one core graphic — side-popping 3D, ample stage */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 168, position: 'relative', perspective: '600px' }}>
          {/* studio floor disc */}
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%) rotateX(70deg)',
            width: 160, height: 28, borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 70%)',
          }}/>
          <Glyph kind={current.k} size={glyph3D ? 156 : 104} hero={glyph3D}/>
        </div>

        <div style={{ marginTop: 8, ...ts('cap1'), color: current.hex, fontWeight: 700, letterSpacing: 0.4 }}>
          {current.en.toUpperCase()}
        </div>
        <div style={{ ...ts('h1'), color: TOKENS.c.grey900, fontWeight: 700, letterSpacing: -0.4, marginTop: 2 }}>
          {TX(lang, `지금은 ${current.ko}`, `You're a ${current.en}`)}
        </div>
        <div style={{ ...ts('label2'), color: TOKENS.c.grey600, marginTop: 4 }}>
          {TX(lang, `${score}점 · 다음 ${next.ko}까지 +${distanceToNext}`, `${score} pts · +${distanceToNext} to ${next.en}`)}
        </div>

        {/* progress (solid, no gradient) */}
        {next !== current && (
          <div style={{ marginTop: 16, height: 6, background: TOKENS.c.white, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(score / next.min) * 100}%`, height: '100%', background: current.hex, borderRadius: 3 }}/>
          </div>
        )}
      </div>

      {/* Heading */}
      <div style={{ padding: '28px 24px 0' }}>
        <div style={{ ...ts('h3'), color: TOKENS.c.grey900 }}>
          {TX(lang, '차오르는 단계', 'Filling stages')}
        </div>
        <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, marginTop: 4 }}>
          {TX(lang, '정시 납부로 차오르고, 연체·분쟁으로 말라요', 'On-time → fill · Late or disputes → dry up')}
        </div>
      </div>

      {/* Tier list — flat, no borders, supporting icons only */}
      <div style={{ margin: '12px 24px 0', background: TOKENS.c.white, borderRadius: 14 }}>
        {TIERS.map((t, i) => {
          const isCurrent = t.k === current.k;
          const range = t.min === t.max ? `${t.min}` : `${t.min}–${t.max}`;
          return (
            <div key={t.k} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr auto',
              alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderTop: i === 0 ? 0 : `1px solid ${TOKENS.c.grey100}`,
            }}>
              {/* supporting icon (24px per Toss guide) */}
              <Glyph kind={t.k} size={28}/>
              <span style={{ minWidth: 0 }}>
                <span style={{ ...ts('label1'), color: TOKENS.c.grey900, fontWeight: isCurrent ? 700 : 500 }}>{t.ko}</span>
                <span style={{ ...ts('cap1'), color: TOKENS.c.grey500, marginLeft: 6 }}>{t.en}</span>
                {isCurrent && (
                  <span style={{ ...ts('cap2'), color: current.hex, marginLeft: 8, fontWeight: 700, padding: '2px 6px', background: current.bg, borderRadius: 4 }}>
                    {TX(lang, '지금', 'Now')}
                  </span>
                )}
              </span>
              <span style={{ ...ts('cap1'), color: TOKENS.c.grey500, fontFamily: TOKENS.t.mono }}>{range}</span>
            </div>
          );
        })}
      </div>

      <Spacer h={16}/>
      <BottomCTA brand={brand} secondary={TX(lang, '공유', 'Share')}>{TX(lang, '집 구하기 (오픈하우스)', 'Find next home')}</BottomCTA>
    </Frame>
  );
}

Object.assign(window, {
  T01_Entry, T02_Onboarding, T03_Auth, T04_KYC, T05_Invite, T06_Contract, T07_Pay, T08_Receipt,
  T09_Home, T10_Countdown, T11_Report, T12_SBT,
});
