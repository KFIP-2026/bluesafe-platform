// BlueSafe — Landlord flow (집주인 시점)
// L01 - L14 screens
// Deps: same window globals

// ════════════════════════════════════════════════════════════════
// L01 · 초대 받기 (랜딩)
// ════════════════════════════════════════════════════════════════
function L01_Invited({ lang, brand }) {
  return (
    <Frame bg={TOKENS.brand.canvas}>
      <TopBar onBack={false} right={<Badge color="ink">BlueSafe</Badge>}/>
      <div style={{ padding: '8px 24px 0' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: TOKENS.c.white, borderRadius: 16, border: `1px solid ${TOKENS.c.grey150}` }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: TOKENS.brand.primaryLt, color: TOKENS.brand.primaryDk, display: 'flex', alignItems: 'center', justifyContent: 'center', ...ts('cap2'), fontWeight: 700 }}>S</div>
          <span style={{ ...ts('label2'), color: TOKENS.c.grey700 }}>{TX(lang, 'Sarah Kim님이 초대했어요', 'Sarah Kim invited you')}</span>
        </div>
      </div>
      <PageTitle sub={TX(lang, '망원동 12-3, 302호 보증금 1,500만원', 'Mangwon 12-3, #302 · 15M KRW deposit')}>
        {TX(lang, '안심 임대로\n시작해 볼래요?', 'Try a trusted\nlease?')}
      </PageTitle>

      {/* Benefit cards */}
      <Card mt={4} pad={20} radius={16} bg={TOKENS.c.white}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Squircle size={44} bg={TOKENS.brand.primaryLt} color={TOKENS.brand.primaryDk}><IconShield size={22} color={TOKENS.brand.primaryDk}/></Squircle>
          <div style={{ flex: 1 }}>
            <div style={{ ...ts('title2'), color: TOKENS.c.grey900 }}>
              {TX(lang, '먹튀 걱정 없는 임차인', 'No-flake tenants')}
            </div>
            <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, marginTop: 4, lineHeight: 1.5 }}>
              {TX(lang,
                '월세 미납 시 BlueSafe가 잠긴 보증금에서 우선 차감해서 송금해요.',
                'On rent default, BlueSafe deducts from locked deposit and pays you first.')}
            </div>
          </div>
        </div>
      </Card>
      <Card mt={10} pad={20} radius={16} bg={TOKENS.c.white}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Squircle size={44} bg="#FFF6D9" color="#946100"><IconCoin size={22} color="#946100"/></Squircle>
          <div style={{ flex: 1 }}>
            <div style={{ ...ts('title2'), color: TOKENS.c.grey900 }}>
              {TX(lang, '월세 자동 정산', 'Auto rent settlement')}
            </div>
            <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, marginTop: 4, lineHeight: 1.5 }}>
              {TX(lang,
                '매달 1일 자동으로 토스 계좌에 들어와요. 챙길 필요 없어요.',
                'Lands in your Toss account on the 1st. No follow-up.')}
            </div>
          </div>
        </div>
      </Card>
      <Card mt={10} pad={20} radius={16} bg={TOKENS.c.white}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Squircle size={44} bg={TOKENS.c.grey100} color={TOKENS.c.grey700}><IconChart size={22} color={TOKENS.c.grey700}/></Squircle>
          <div style={{ flex: 1 }}>
            <div style={{ ...ts('title2'), color: TOKENS.c.grey900 }}>
              {TX(lang, '깨끗한 거래 기록', 'Clean paper trail')}
            </div>
            <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, marginTop: 4, lineHeight: 1.5 }}>
              {TX(lang,
                '입출금·계약·정산이 한 화면. 종소세 신고 자료까지.',
                'All payments, lease, settlements in one view. Tax-ready.')}
            </div>
          </div>
        </div>
      </Card>

      <BottomCTA brand={brand} secondary={TX(lang, '나중에', 'Later')}>{TX(lang, '계약서 보기', 'View lease')}</BottomCTA>
    </Frame>
  );
}

// L02 · 임대인 KYC + 사업자 (사업자 선택)
function L02_KYC({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <div style={{ padding: '0 24px' }}>
        <Stepper steps={[1,2,3]} current={0} color={brand}/>
      </div>
      <PageTitle mt={20} sub={TX(lang, '월세 받을 명의를 선택해요', 'Choose how rent is received')}>
        {TX(lang, '임대인\n인증 종류', 'Verify\nas a landlord')}
      </PageTitle>

      {[
        { i: <IconUser/>, t: TX(lang, '개인', 'Individual'), s: TX(lang, '주민등록증 본인 명의', 'Resident ID, own name'), sel: true },
        { i: <IconDoc/>, t: TX(lang, '개인사업자', 'Sole proprietor'), s: TX(lang, '사업자등록증 + 본인 명의', 'Business reg. + ID') },
        { i: <IconDoc/>, t: TX(lang, '법인', 'Corporation'), s: TX(lang, '법인 인감 + 대표자 인증', 'Corp seal + rep. KYC') },
      ].map((r, i) => (
        <div key={i} style={{ padding: '0 24px', marginBottom: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 16px',
            background: r.sel ? TOKENS.brand.primaryLt : TOKENS.c.grey50,
            border: r.sel ? `1.5px solid ${brand}` : `1px solid transparent`,
            borderRadius: 14,
          }}>
            <Squircle size={40} bg={r.sel ? TOKENS.c.white : TOKENS.c.white} color={r.sel ? brand : TOKENS.c.grey700}>{r.i}</Squircle>
            <div style={{ flex: 1 }}>
              <div style={{ ...ts('title2'), color: r.sel ? TOKENS.brand.primaryDk : TOKENS.c.grey900 }}>{r.t}</div>
              <div style={{ ...ts('cap1'), color: r.sel ? TOKENS.brand.primaryDk : TOKENS.c.grey600, marginTop: 2, opacity: r.sel ? 0.85 : 1 }}>{r.s}</div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: 11,
              border: `2px solid ${r.sel ? brand : TOKENS.c.grey300}`,
              background: r.sel ? brand : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {r.sel && <IconCheck color={TOKENS.c.white} size={12} stroke={3}/>}
            </div>
          </div>
        </div>
      ))}

      <Card mt={16} pad={16} radius={14} bg={TOKENS.c.grey50}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <IconAlert color={TOKENS.c.grey500} size={18}/>
          <div style={{ ...ts('cap1'), color: TOKENS.c.grey600 }}>
            {TX(lang,
              '월세 수령 계좌는 본인 명의여야 해요. BlueSafe가 자동으로 검증해요.',
              'Rent account must be in your own name. BlueSafe verifies automatically.')}
          </div>
        </div>
      </Card>

      <BottomCTA brand={brand}>{TX(lang, '토스로 인증하기', 'Verify with Toss')}</BottomCTA>
    </Frame>
  );
}

// L03 · 매물 등록
function L03_PropertyReg({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <PageTitle sub={TX(lang, '계약서가 자동으로 채워져요', 'The lease will auto-fill')}>
        {TX(lang, '매물 정보', 'Property')}
      </PageTitle>

      {/* Photos placeholder */}
      <div style={{ padding: '0 24px' }}>
        <div style={{
          height: 140, borderRadius: 14, position: 'relative', overflow: 'hidden',
          background: `repeating-linear-gradient(45deg, ${TOKENS.c.grey100} 0 12px, ${TOKENS.c.grey150} 12px 24px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ ...ts('label2'), color: TOKENS.c.grey600, fontFamily: TOKENS.t.mono }}>
            {TX(lang, '[ 매물 사진 4장 ]', '[ 4 unit photos ]')}
          </div>
          <div style={{ position: 'absolute', bottom: 10, right: 10, padding: '4px 10px', background: 'rgba(0,0,0,0.6)', color: TOKENS.c.white, borderRadius: 12, ...ts('cap1') }}>1/4</div>
        </div>
      </div>

      {/* Form rows */}
      {[
        { l: TX(lang, '주소', 'Address'), v: TX(lang, '서울시 마포구 망원동 12-3, 302호', 'Mangwon 12-3, #302') },
        { l: TX(lang, '면적', 'Area'), v: '32㎡ (9.7평)' },
        { l: TX(lang, '구조', 'Type'), v: TX(lang, '원룸 · 풀옵션', 'Studio · furnished') },
        { l: TX(lang, '월세', 'Rent'), v: krw(680000) + ' / ' + TX(lang, '월', 'mo') },
        { l: TX(lang, '보증금', 'Deposit'), v: krw(15000000) },
        { l: TX(lang, '관리비', 'Maintenance'), v: krw(70000) + ' / ' + TX(lang, '월', 'mo') },
        { l: TX(lang, '입주 가능일', 'Move-in'), v: '2026.06.01' },
      ].map((r, i, arr) => (
        <div key={i} style={{
          padding: '14px 24px',
          borderBottom: i === arr.length - 1 ? 0 : `1px solid ${TOKENS.c.grey150}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ ...ts('label1'), color: TOKENS.c.grey600 }}>{r.l}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...ts('label1'), color: TOKENS.c.grey900, fontWeight: 600 }}>{r.v}</span>
            <ChevronRight color={TOKENS.c.grey400} size={20}/>
          </div>
        </div>
      ))}

      <BottomCTA brand={brand}>{TX(lang, '계약서 자동 작성', 'Generate lease')}</BottomCTA>
    </Frame>
  );
}

// L04 · 계약서 검토 (집주인 시점)
function L04_Review({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<Badge color="yellow">{TX(lang, '검토 중', 'Reviewing')}</Badge>}/>
      <PageTitle sub={TX(lang, '필요하면 임차인에게 수정 요청을 보낼 수 있어요', 'Request edits before you sign')}>
        {TX(lang, '계약서 확인', 'Review lease')}
      </PageTitle>

      <Card mt={4} pad={20} radius={16} bg={TOKENS.c.grey50}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...ts('cap1'), color: TOKENS.c.grey600, fontWeight: 700, letterSpacing: 1 }}>BLUESAFE TRUST LEASE</span>
          <Badge color="grey">v1</Badge>
        </div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px' }}>
          {[
            { l: TX(lang, '임차인', 'Tenant'), v: 'Sarah Kim' },
            { l: TX(lang, '국적', 'Nationality'), v: 'USA · F-2' },
            { l: TX(lang, '계약 기간', 'Term'), v: '12 mo' },
            { l: TX(lang, '월세', 'Rent'), v: krw(680000) },
            { l: TX(lang, '보증금', 'Deposit'), v: krw(15000000), strong: true },
            { l: TX(lang, '입주', 'Move-in'), v: '2026.06.01' },
          ].map((c, i) => (
            <div key={i}>
              <div style={{ ...ts('cap1'), color: TOKENS.c.grey500 }}>{c.l}</div>
              <div style={{ ...ts(c.strong ? 'title2' : 'label1'), color: TOKENS.c.grey900, marginTop: 2, fontWeight: c.strong ? 700 : 600 }}>{c.v}</div>
            </div>
          ))}
        </div>
      </Card>

      <SectionHeader>{TX(lang, '집주인 보호 조항', 'Landlord protections')}</SectionHeader>
      {[
        { t: TX(lang, '월세 미납 시 자동 차감', 'Auto-deduct on default'), s: TX(lang, '잠긴 보증금에서 월세분 우선 송금', 'Rent paid first from locked deposit') },
        { t: TX(lang, '원상복구 청구', 'Restoration claim'), s: TX(lang, '퇴실 시 손상분 차감 가능', 'Deductible at move-out') },
        { t: TX(lang, '조기 해지 페널티', 'Early-exit penalty'), s: TX(lang, '6개월 미만 — 1개월분', 'Under 6 mo — 1 mo rent') },
      ].map((r, i) => (
        <ListRow key={i} divider
          leading={<Squircle size={36} bg={TOKENS.brand.primaryLt} color={TOKENS.brand.primaryDk}><IconShield size={18} color={TOKENS.brand.primaryDk}/></Squircle>}
          title={r.t} sub={r.s}
        />
      ))}

      <BottomCTA brand={brand} secondary={TX(lang, '수정 요청', 'Request edits')}>{TX(lang, '동의하고 서명', 'Agree and sign')}</BottomCTA>
    </Frame>
  );
}

// L05 · 서명 완료 + 보증금 잠금 알림
function L05_Signed({ lang, brand }) {
  return (
    <Frame bg={TOKENS.brand.canvas}>
      <TopBar onBack={false} right={<button style={iconBtnStyle}><IconClose color={TOKENS.c.grey700}/></button>}/>
      <div style={{ textAlign: 'center', padding: '12px 24px 0' }}>
        <div style={{
          width: 88, height: 88, margin: '8px auto', borderRadius: 44,
          background: brand, color: TOKENS.c.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 0 12px ${TOKENS.brand.primaryLt}`,
        }}>
          <IconLock color={TOKENS.c.white} size={42}/>
        </div>
        <h1 style={{ ...ts('h1'), fontSize: 24, marginTop: 16 }}>
          {TX(lang, '계약 체결 완료', 'Lease signed')}
        </h1>
        <p style={{ ...ts('body1'), color: TOKENS.c.grey600, marginTop: 6 }}>
          {TX(lang, '보증금 1,500만원이 안전하게 잠겼어요', '15M KRW deposit safely locked')}
        </p>
      </div>

      <Card mt={20} pad={0} radius={16} bg={TOKENS.c.white}>
        <div style={{ padding: 20 }}>
          <div style={{ ...ts('cap1'), color: TOKENS.c.grey500, fontWeight: 700, letterSpacing: 1 }}>NEXT STEPS</div>
          {[
            { d: '06.01', t: TX(lang, '첫 월세 자동 정산', 'First auto rent') , s: krw(680000), done: false },
            { d: '12.01', t: TX(lang, '6개월차 평판 리포트', '6-month report'), s: TX(lang, '자동 발송', 'Auto-sent') },
            { d: '2027.06.07', t: TX(lang, '보증금 정산', 'Deposit settle'), s: TX(lang, '자동 또는 협의', 'Auto or by agreement') },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginTop: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 56, ...ts('cap1'), color: TOKENS.c.grey500, fontFamily: TOKENS.t.mono, fontWeight: 700 }}>{r.d}</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...ts('label1'), color: TOKENS.c.grey900 }}>{r.t}</div>
                <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, marginTop: 2 }}>{r.s}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <BottomCTA brand={brand} secondary={TX(lang, '계약서', 'Lease')}>{TX(lang, '대시보드로', 'Dashboard')}</BottomCTA>
    </Frame>
  );
}

// L06 · 임대인 HOME ★
function L06_Home({ lang, brand }) {
  return (
    <Frame bg={TOKENS.brand.canvas}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 16px 0 24px' }}>
        <div>
          <div style={{ ...ts('h2'), color: TOKENS.c.grey900 }}>{TX(lang, '안녕하세요, 김선생님', 'Hello, Mr. Kim')}</div>
        </div>
        <span style={{ flex: 1 }}/>
        <button style={iconBtn}><IconBell color={TOKENS.c.grey800}/></button>
      </div>

      {/* Earnings hero */}
      <div style={{
        margin: '4px 24px 0', borderRadius: 20, padding: '22px 22px 18px',
        background: `linear-gradient(135deg, ${TOKENS.brand.ink} 0%, ${TOKENS.brand.inkSoft} 100%)`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ ...ts('cap1'), color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: 1 }}>
          {TX(lang, '이번 달 수익', 'THIS MONTH')}
        </div>
        <div style={{ ...ts('h1'), fontSize: 30, color: TOKENS.c.white, marginTop: 12, fontWeight: 700, letterSpacing: -0.5 }}>
          {krw(2040000)}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, ...ts('cap1'), color: 'rgba(255,255,255,0.7)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: brand, display: 'inline-block' }}/>{TX(lang, '받음', 'Received')} ₩2.04M</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: '#FFB957', display: 'inline-block' }}/>{TX(lang, '예정', 'Pending')} ₩680K</span>
        </div>
        {/* mini bars */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 18, height: 40 }}>
          {[40, 65, 80, 60, 90, 75, 85, 100].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 7 ? brand : 'rgba(255,255,255,0.3)', borderRadius: 3 }}/>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '20px 24px 0' }}>
        {[
          { i: <IconHome size={22}/>, t: TX(lang, '매물', 'Units') },
          { i: <IconCoin size={22}/>, t: TX(lang, '월세', 'Rent') },
          { i: <IconAlert size={22}/>, t: TX(lang, '분쟁', 'Disputes') },
          { i: <IconChart size={22}/>, t: TX(lang, '리포트', 'Report') },
        ].map((a, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Squircle size={48} bg={TOKENS.c.white} color={TOKENS.brand.ink}>{a.i}</Squircle>
            <span style={{ ...ts('cap1'), color: TOKENS.c.grey700, fontWeight: 600 }}>{a.t}</span>
          </div>
        ))}
      </div>

      <SectionHeader mt={20} right={TX(lang, '전체', 'All')}>{TX(lang, '내 매물 (3)', 'My units (3)')}</SectionHeader>
      <Card mx={24} pad={0} radius={14}>
        {[
          { a: '망원', t: TX(lang, '망원동 12-3 #302', 'Mangwon 12-3 #302'), s: 'Sarah K · ' + TX(lang, '잠김', 'Locked'), v: krw(680000), c: brand, ok: true },
          { a: '연남', t: TX(lang, '연남동 56 #501', 'Yeonnam 56 #501'), s: TX(lang, '공실', 'Vacant'), v: TX(lang, '모집중', 'Listing'), c: TOKENS.c.grey500 },
          { a: '망원', t: TX(lang, '망원동 12-3 #201', 'Mangwon 12-3 #201'), s: 'Diego R · ' + TX(lang, '미납 1일', '1d late'), v: krw(680000), c: TOKENS.c.red, ok: false },
        ].map((u, i, arr) => (
          <ListRow key={i} divider={i < arr.length - 1}
            leading={<Squircle size={40} bg={u.ok === false ? '#FFE5E7' : TOKENS.brand.primaryLt} color={u.ok === false ? TOKENS.c.red : TOKENS.brand.primaryDk}>{u.a}</Squircle>}
            title={u.t}
            sub={u.s}
            tail={<span style={{ color: u.c, fontWeight: 700, ...ts('label1') }}>{u.v}</span>}
          />
        ))}
      </Card>

      <Spacer h={24}/>

      <TabBar items={[
        { icon: <IconHome/>, label: TX(lang, '홈', 'Home') },
        { icon: <IconCoin/>, label: TX(lang, '수익', 'Income') },
        { icon: <IconShield/>, label: TX(lang, '계약', 'Lease') },
        { icon: <IconUser/>, label: TX(lang, '내정보', 'Me') },
      ]} active={0} brand={brand}/>
    </Frame>
  );
}

// L07 · 매물 상세
function L07_PropertyDetail({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<button style={iconBtnStyle}><IconMore color={TOKENS.c.grey700}/></button>}/>
      <PageTitle sub="Sarah Kim · 2026.06.01–2027.05.31">
        {TX(lang, '망원동 12-3 #302', 'Mangwon 12-3 #302')}
      </PageTitle>

      <Card mt={4} pad={20} radius={16} bg={TOKENS.brand.primaryLt}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ ...ts('cap1'), color: TOKENS.brand.primaryDk, fontWeight: 700, letterSpacing: 1 }}>LOCKED DEPOSIT</div>
            <div style={{ ...ts('h2'), color: TOKENS.brand.primaryDk, marginTop: 4 }}>{krw(15000000)}</div>
          </div>
          <Squircle size={48} bg={TOKENS.c.white} color={brand}><IconLock size={24} color={brand}/></Squircle>
        </div>
        <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, marginTop: 14, overflow: 'hidden' }}>
          <div style={{ width: '23%', height: '100%', background: brand }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, ...ts('cap1'), color: TOKENS.brand.primaryDk, opacity: 0.85 }}>
          <span>{TX(lang, '83일 거주', 'Day 83')}</span>
          <span>{TX(lang, '2027.05.31 만료', 'Ends 2027.05.31')}</span>
        </div>
      </Card>

      <SectionHeader>{TX(lang, '월세 내역', 'Rent ledger')}</SectionHeader>
      <Card mx={24} pad={0} radius={14} bg={TOKENS.c.grey50}>
        {[
          { d: 'Aug', s: '2026.08.01', v: krw(680000), ok: true },
          { d: 'Jul', s: '2026.07.01', v: krw(680000), ok: true },
          { d: 'Jun', s: '2026.06.01', v: krw(680000), ok: true },
        ].map((p, i, arr) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
            borderBottom: i === arr.length - 1 ? 0 : `1px solid ${TOKENS.c.grey150}`,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: TOKENS.brand.primaryLt, color: TOKENS.brand.primaryDk, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              <span>{p.d}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...ts('label1'), color: TOKENS.c.grey900 }}>{TX(lang, '월세 정산', 'Rent settled')}</div>
              <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, marginTop: 2 }}>{p.s}</div>
            </div>
            <span style={{ ...ts('title2'), color: brand, fontWeight: 700 }}>+{p.v}</span>
          </div>
        ))}
      </Card>

      <SectionHeader>{TX(lang, '임차인', 'Tenant')}</SectionHeader>
      <ListRow
        leading={<div style={{ width: 44, height: 44, borderRadius: 22, background: TOKENS.brand.ink, color: TOKENS.c.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>SK</div>}
        title="Sarah Kim"
        sub={TX(lang, 'USA · F-2 · 평판 SBT 인증', 'USA · F-2 · SBT verified')}
        tail={<Badge color="green">{TX(lang, '안전', 'Safe')}</Badge>}
      />
    </Frame>
  );
}

// L08 · 미납 알림 → 자동 차감
function L08_LateRent({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <PageTitle sub={TX(lang, '먼저 보증금에서 우선 차감해 송금했어요', 'Auto-deducted from locked deposit. Already sent.')}>
        {TX(lang, '미납이지만\n돈은 들어왔어요', 'Tenant missed\nbut you got paid')}
      </PageTitle>

      <Card mt={4} pad={20} radius={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Squircle size={48} bg="#FFE5E7" color={TOKENS.c.red}><IconAlert size={24} color={TOKENS.c.red}/></Squircle>
          <div>
            <div style={{ ...ts('label2'), color: TOKENS.c.grey600 }}>{TX(lang, '미납 임차인', 'Late tenant')}</div>
            <div style={{ ...ts('title2'), color: TOKENS.c.grey900 }}>Diego Ramirez</div>
            <div style={{ ...ts('cap1'), color: TOKENS.c.grey600 }}>{TX(lang, '망원동 12-3 #201', 'Mangwon 12-3 #201')} · {TX(lang, '1일 지연', '1d late')}</div>
          </div>
        </div>
      </Card>

      <Card mt={10} pad={20} radius={16} bg={TOKENS.brand.primaryLt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconCheck color={TOKENS.brand.primaryDk} size={26} stroke={3}/>
          <div style={{ flex: 1 }}>
            <div style={{ ...ts('title2'), color: TOKENS.brand.primaryDk }}>
              {TX(lang, '월세 자동 차감 완료', 'Auto-deduct done')}
            </div>
            <div style={{ ...ts('cap1'), color: TOKENS.brand.primaryDk, marginTop: 2, opacity: 0.9 }}>
              {TX(lang, '잠긴 보증금에서 680,000원이 송금됐어요', '680,000 KRW sent from locked deposit')}
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(0,0,0,0.1)', margin: '14px 0' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...ts('label1'), color: TOKENS.brand.primaryDk }}>
          <span>{TX(lang, '잠금 잔액', 'Locked balance')}</span>
          <span style={{ fontWeight: 700 }}>{krw(15000000 - 680000)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...ts('cap1'), color: TOKENS.brand.primaryDk, marginTop: 4, opacity: 0.85 }}>
          <span>{TX(lang, '입금 시각', 'Settled')}</span>
          <span>{TX(lang, '오늘 09:01', 'Today 09:01')}</span>
        </div>
      </Card>

      <Card mt={10} pad={16} radius={14} bg={TOKENS.c.grey50}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <IconAlert color={TOKENS.c.grey600} size={20}/>
          <div style={{ ...ts('cap1'), color: TOKENS.c.grey700, lineHeight: 1.5 }}>
            {TX(lang,
              '임차인이 7일 안에 갚으면 잠금 잔액이 원복돼요. 그동안 BlueSafe가 알림과 추심을 진행해요.',
              'If tenant repays in 7 days, lock is restored. BlueSafe handles reminders meanwhile.')}
          </div>
        </div>
      </Card>

      <BottomCTA brand={brand} secondary={TX(lang, '연락하기', 'Contact')}>{TX(lang, '확인', 'OK')}</BottomCTA>
    </Frame>
  );
}

// L09 · 임대인 시점 분쟁 (반대편)
function L09_DisputeIncoming({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<Badge color="yellow">{TX(lang, '응답 필요', 'Action needed')}</Badge>}/>
      <PageTitle sub={TX(lang, '4일 안에 답하지 않으면 BlueSafe 패널이 판정해요', 'If no reply in 4 days, BlueSafe panel decides')}>
        {TX(lang, '임차인이\n이의 제기를 했어요', 'Your tenant\nfiled a dispute')}
      </PageTitle>

      <Card mt={4} pad={20} radius={16} bg={TOKENS.c.grey50}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...ts('cap1'), color: TOKENS.c.grey600 }}>{TX(lang, '대상 청구', 'Item')}</div>
            <div style={{ ...ts('title2'), color: TOKENS.c.grey900, marginTop: 2 }}>{TX(lang, '8월 가스비', 'Aug. gas bill')}</div>
            <div style={{ ...ts('cap1'), color: TOKENS.c.grey500, marginTop: 2 }}>{krw(31000)} · +12.5% vs avg</div>
          </div>
          <Squircle size={44} bg="#FFF6D9" color="#946100"><IconAlert size={22} color="#946100"/></Squircle>
        </div>
        <div style={{ height: 1, background: TOKENS.c.grey200, margin: '14px 0' }}/>
        <div style={{ ...ts('label2'), color: TOKENS.c.grey600 }}>{TX(lang, '임차인 주장', 'Tenant claim')}</div>
        <div style={{ ...ts('body2'), color: TOKENS.c.grey800, marginTop: 6, lineHeight: 1.55 }}>
          {TX(lang,
            '“평소엔 25,000원 정도 나오는데 이번에 31,000원 나왔어요. 누수 가능성이 있어요.”',
            '“It\'s usually around 25,000. This time 31,000. Possible leak.”')}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {[1,2].map(i => (
            <div key={i} style={{
              width: 60, height: 60, borderRadius: 8,
              background: `repeating-linear-gradient(135deg, ${TOKENS.c.grey150}, ${TOKENS.c.grey150} 6px, ${TOKENS.c.grey200} 6px, ${TOKENS.c.grey200} 12px)`,
            }}/>
          ))}
        </div>
      </Card>

      <SectionHeader>{TX(lang, '어떻게 할까요?', 'Your options')}</SectionHeader>
      {[
        { t: TX(lang, '인정하고 차액 환불', 'Accept and refund'), s: TX(lang, '6,000원이 즉시 임차인에게', '6,000 to tenant now'), c: brand, sel: true },
        { t: TX(lang, '근거 제출하고 반박', 'Submit evidence'), s: TX(lang, '검침지·계약서 등 첨부', 'Meter, lease docs'), c: TOKENS.c.grey700 },
        { t: TX(lang, 'BlueSafe 패널에 위임', 'Defer to BlueSafe panel'), s: TX(lang, '평균 4.2일 소요', 'Avg 4.2 days'), c: TOKENS.c.grey700 },
      ].map((r, i) => (
        <div key={i} style={{ padding: '0 24px', marginBottom: 8 }}>
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: r.sel ? TOKENS.brand.primaryLt : TOKENS.c.grey50,
            border: r.sel ? `1.5px solid ${brand}` : `1px solid transparent`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 11,
              border: `2px solid ${r.sel ? brand : TOKENS.c.grey300}`,
              background: r.sel ? brand : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{r.sel && <IconCheck color={TOKENS.c.white} size={12} stroke={3}/>}</div>
            <div>
              <div style={{ ...ts('label1'), color: r.sel ? TOKENS.brand.primaryDk : TOKENS.c.grey900, fontWeight: 700 }}>{r.t}</div>
              <div style={{ ...ts('cap1'), color: r.sel ? TOKENS.brand.primaryDk : TOKENS.c.grey600, marginTop: 2, opacity: 0.85 }}>{r.s}</div>
            </div>
          </div>
        </div>
      ))}

      <BottomCTA brand={brand}>{TX(lang, '인정하고 환불', 'Accept and refund')}</BottomCTA>
    </Frame>
  );
}

// L10 · 종합 수익 리포트
function L10_Earnings({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<button style={iconBtnStyle}><IconMore color={TOKENS.c.grey700}/></button>}/>
      <PageTitle sub="2026 · YTD">
        {TX(lang, '수익 리포트', 'Income report')}
      </PageTitle>

      <Card mt={4} pad={20} radius={16} bg={TOKENS.brand.ink}>
        <div style={{ ...ts('cap1'), color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: 1 }}>YTD INCOME</div>
        <div style={{ ...ts('h1'), fontSize: 32, color: TOKENS.c.white, marginTop: 6, fontWeight: 700, letterSpacing: -1 }}>
          {krw(16320000)}
        </div>
        <div style={{ ...ts('cap1'), color: brand, marginTop: 4, fontWeight: 700 }}>+8.2% YoY</div>

        {/* 12mo bars */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', marginTop: 20, height: 60 }}>
          {[55, 60, 60, 65, 70, 75, 80, 85, 100, 0, 0, 0].map((h, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', height: `${h}%`, background: h ? brand : 'rgba(255,255,255,0.12)', borderRadius: 2 }}/>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', ...ts('cap2'), color: 'rgba(255,255,255,0.5)' }}>{m}</div>
          ))}
        </div>
      </Card>

      <SectionHeader>{TX(lang, '매물별', 'By unit')}</SectionHeader>
      {[
        { t: TX(lang, '망원동 12-3 #302', 'Mangwon 12-3 #302'), s: 'Sarah Kim · 8mo', v: krw(5440000), pct: 33 },
        { t: TX(lang, '망원동 12-3 #201', 'Mangwon 12-3 #201'), s: 'Diego Ramirez · 8mo', v: krw(5440000), pct: 33 },
        { t: TX(lang, '연남동 56 #501', 'Yeonnam 56 #501'), s: TX(lang, '비어있음 4개월', '4mo vacant'), v: krw(5440000), pct: 33 },
      ].map((u, i) => (
        <div key={i} style={{ padding: '0 24px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...ts('label1') }}>
            <span style={{ color: TOKENS.c.grey900 }}>{u.t}</span>
            <span style={{ color: TOKENS.c.grey900, fontWeight: 700 }}>{u.v}</span>
          </div>
          <div style={{ ...ts('cap1'), color: TOKENS.c.grey500, marginTop: 2 }}>{u.s}</div>
          <div style={{ marginTop: 8 }}><ProgressBar value={u.pct} color={brand}/></div>
        </div>
      ))}

      <Card mt={8} pad={16} radius={14} bg={TOKENS.c.grey50}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...ts('label1'), color: TOKENS.c.grey800 }}>
          <span>{TX(lang, '종합소득세 신고용 자료', 'Tax filing pack')}</span>
          <span style={{ color: brand, fontWeight: 700 }}>{TX(lang, '내려받기 →', 'Download →')}</span>
        </div>
      </Card>
    </Frame>
  );
}

// L11 · 보증금 반환 결정 (퇴실 후)
function L11_DepositRelease({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<Badge color="yellow">{TX(lang, '응답 필요', 'Action')}</Badge>}/>
      <PageTitle sub={TX(lang, '응답 없으면 7일 후 자동 반환돼요', 'No reply = auto-release in 7 days')}>
        {TX(lang, '퇴실 확인 +\n보증금 정산', 'Move-out OK +\nsettle deposit')}
      </PageTitle>

      <Card mt={4} pad={20} radius={16} bg={TOKENS.c.grey50}>
        <div style={{ ...ts('label2'), color: TOKENS.c.grey600 }}>{TX(lang, '잠긴 보증금', 'Locked deposit')}</div>
        <div style={{ ...ts('h2'), color: TOKENS.c.grey900, marginTop: 4 }}>{krw(15000000)}</div>
      </Card>

      <SectionHeader>{TX(lang, '차감 항목', 'Deductions')}</SectionHeader>
      {[
        { t: TX(lang, '청소 (전문 업체)', 'Cleaning (pro)'), s: TX(lang, '영수증 첨부', 'Receipt attached'), v: krw(50000), on: true },
        { t: TX(lang, '벽지 손상', 'Wallpaper damage'), s: TX(lang, '사진 2장', '2 photos'), v: krw(0), on: false },
        { t: TX(lang, '가전 분실', 'Lost appliance'), s: TX(lang, '없음', 'None'), v: krw(0), on: false },
      ].map((r, i) => (
        <ListRow key={i} divider
          leading={<div style={{
            width: 22, height: 22, borderRadius: 11,
            border: `2px solid ${r.on ? brand : TOKENS.c.grey300}`,
            background: r.on ? brand : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{r.on && <IconCheck color={TOKENS.c.white} size={12} stroke={3}/>}</div>}
          title={r.t}
          sub={r.s}
          tail={<span style={{ color: r.on ? TOKENS.c.grey900 : TOKENS.c.grey400, fontWeight: 700 }}>−{r.v}</span>}
        />
      ))}

      <Card mt={16} pad={20} radius={16} bg={TOKENS.brand.primaryLt}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ ...ts('title2'), color: TOKENS.brand.primaryDk }}>{TX(lang, '임차인 환불액', 'Tenant gets back')}</span>
          <span style={{ ...ts('h2'), color: TOKENS.brand.primaryDk, fontWeight: 700 }}>{krw(14950000)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, ...ts('cap1'), color: TOKENS.brand.primaryDk, opacity: 0.85 }}>
          <span>{TX(lang, '내가 받는 차감금', 'You receive')}</span>
          <span>{krw(50000)}</span>
        </div>
      </Card>

      <BottomCTA brand={brand} secondary={TX(lang, '거부', 'Object')}>{TX(lang, '동의하고 정산', 'Approve settle')}</BottomCTA>
    </Frame>
  );
}

// L12 · 임대인 활동 내역
function L12_Activity({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<button style={iconBtnStyle}><IconSearch color={TOKENS.c.grey700}/></button>}/>
      <PageTitle>{TX(lang, '거래 내역', 'Activity')}</PageTitle>

      <div style={{ padding: '0 24px', display: 'flex', gap: 6 }}>
        {[
          TX(lang, '전체', 'All'),
          TX(lang, '월세', 'Rent'),
          TX(lang, '보증금', 'Deposit'),
          TX(lang, '차감', 'Deduct'),
        ].map((c, i) => <Chip key={i} size="s" variant="weak" selected={i === 0} brand={brand}>{c}</Chip>)}
      </div>

      <SectionHeader mt={20}>2026 · {TX(lang, '8월', 'Aug.')}</SectionHeader>
      {[
        { d: '08.01', t: TX(lang, '월세 정산 — Sarah K', 'Rent — Sarah K'), s: '#302', v: '+' + krw(680000), c: brand },
        { d: '08.02', t: TX(lang, '월세 자동 차감 — Diego R', 'Auto-deduct — Diego R'), s: TX(lang, '보증금에서', 'from deposit'), v: '+' + krw(680000), c: brand },
        { d: '08.04', t: TX(lang, '이의 환불 — Sarah K', 'Refund — Sarah K'), s: TX(lang, '8월 가스', 'Aug gas'), v: '−' + krw(6000), c: TOKENS.c.red },
      ].map((r, i) => (
        <ListRow key={i} divider
          leading={<div style={{ width: 44, textAlign: 'center', ...ts('cap1'), color: TOKENS.c.grey500 }}>{r.d}</div>}
          title={r.t} sub={r.s}
          tail={<span style={{ color: r.c, fontWeight: 700, ...ts('title2') }}>{r.v}</span>}
        />
      ))}

      <SectionHeader>2026 · {TX(lang, '7월', 'July')}</SectionHeader>
      {[
        { d: '07.01', t: TX(lang, '월세 정산 — Sarah K', 'Rent — Sarah K'), s: '#302', v: '+' + krw(680000), c: brand },
        { d: '07.01', t: TX(lang, '월세 정산 — Diego R', 'Rent — Diego R'), s: '#201', v: '+' + krw(680000), c: brand },
      ].map((r, i) => (
        <ListRow key={i} divider
          leading={<div style={{ width: 44, textAlign: 'center', ...ts('cap1'), color: TOKENS.c.grey500 }}>{r.d}</div>}
          title={r.t} sub={r.s}
          tail={<span style={{ color: r.c, fontWeight: 700, ...ts('title2') }}>{r.v}</span>}
        />
      ))}
    </Frame>
  );
}

Object.assign(window, {
  L01_Invited, L02_KYC, L03_PropertyReg, L04_Review, L05_Signed,
  L06_Home, L07_PropertyDetail, L08_LateRent, L09_DisputeIncoming,
  L10_Earnings, L11_DepositRelease, L12_Activity,
});
