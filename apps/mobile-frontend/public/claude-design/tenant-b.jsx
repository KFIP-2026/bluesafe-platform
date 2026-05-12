// BlueSafe — Tenant flow part B (13-20)
// Deps: same window globals

// ════════════════════════════════════════════════════════════════
// 13 · 공과금 자동 대조
// ════════════════════════════════════════════════════════════════
function T13_Bills({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <PageTitle sub={TX(lang, '평년 데이터와 자동으로 비교해요', 'Auto-compared with neighborhood average')}>
        {TX(lang, '8월 공과금', 'Aug. utilities')}
      </PageTitle>

      {/* Total */}
      <div style={{ padding: '0 24px' }}>
        <div style={{ ...ts('cap1'), color: TOKENS.c.grey600 }}>{TX(lang, '청구 총액', 'Total billed')}</div>
        <div style={{ ...ts('h1'), fontSize: 32, color: TOKENS.c.grey900, marginTop: 4 }}>{krw(127400)}</div>
        <div style={{ ...ts('label2'), color: '#946100', marginTop: 4 }}>
          {TX(lang, '평소 대비 +14,200원 (12.5%↑)', '+14,200 (+12.5%) vs avg')}
        </div>
      </div>

      <SectionHeader>{TX(lang, '항목별', 'Itemized')}</SectionHeader>
      {[
        { t: TX(lang, '전기', 'Electricity'), v: krw(48200), bench: '+3.1%', ok: true },
        { t: TX(lang, '가스', 'Gas'), v: krw(31000), bench: '+12.5%', ok: false },
        { t: TX(lang, '수도', 'Water'), v: krw(18200), bench: '−2.0%', ok: true },
        { t: TX(lang, '인터넷', 'Internet'), v: krw(30000), bench: '0%', ok: true },
      ].map((r, i) => (
        <ListRow key={i} divider
          leading={<Squircle size={36} bg={r.ok ? TOKENS.c.grey100 : '#FFF6D9'} color={r.ok ? TOKENS.c.grey700 : '#946100'}>
            {r.ok ? <IconCheck size={16} stroke={3}/> : '!'}
          </Squircle>}
          title={r.t}
          sub={TX(lang, '8월 청구', 'Aug. billed')}
          tail={r.v}
          tailSub={<span style={{ color: r.ok ? TOKENS.c.grey500 : '#946100' }}>{r.bench}</span>}
        />
      ))}

      <Card mt={16} pad={16} radius={14} bg="#FFF8E0">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <IconAlert color="#946100" size={20}/>
          <div>
            <div style={{ ...ts('label1'), color: '#946100' }}>{TX(lang, '가스비가 평소보다 12% 높아요', 'Gas bill 12% above normal')}</div>
            <div style={{ ...ts('cap1'), color: '#946100', marginTop: 4, opacity: 0.9 }}>
              {TX(lang, '근거 자료를 첨부해 이의제기 할 수 있어요.', 'Attach evidence and dispute.')}
            </div>
          </div>
        </div>
      </Card>

      <BottomCTA brand={brand} secondary={TX(lang, '나중에', 'Later')}>{TX(lang, '이의 제기하기', 'Dispute now')}</BottomCTA>
    </Frame>
  );
}

// 14 · 이의제기 작성
function T14_Dispute({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <PageTitle>{TX(lang, '어떤 부분이\n이상한가요?', 'What seems\nwrong?')}</PageTitle>

      <SectionHeader>{TX(lang, '대상', 'Item')}</SectionHeader>
      <ListRow
        leading={<Squircle size={36} bg="#FFF6D9" color="#946100"><IconAlert size={20} color="#946100"/></Squircle>}
        title={TX(lang, '8월 가스비', 'Aug. gas bill')}
        sub={krw(31000) + ' · +12.5%'}
        tail={<Badge color="yellow">{TX(lang, '대상', 'Target')}</Badge>}
      />

      <SectionHeader>{TX(lang, '이유', 'Reason')}</SectionHeader>
      <div style={{ padding: '0 24px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[
          TX(lang, '평년보다 너무 높아요', 'Higher than average'),
          TX(lang, '계량기 수치가 달라요', 'Meter mismatch'),
          TX(lang, '공용부 누수 의심', 'Possible leak'),
          TX(lang, '직접 입력', 'Custom'),
        ].map((c, i) => (
          <Chip key={i} size="m" variant="weak" selected={i === 0} brand={brand}>{c}</Chip>
        ))}
      </div>

      <SectionHeader>{TX(lang, '근거 사진', 'Evidence')}</SectionHeader>
      <div style={{ padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            aspectRatio: '1', borderRadius: 12,
            background: i < 2 ? `repeating-linear-gradient(135deg, ${TOKENS.c.grey100}, ${TOKENS.c.grey100} 8px, ${TOKENS.c.grey150} 8px, ${TOKENS.c.grey150} 16px)` : TOKENS.c.grey100,
            border: i === 2 ? `1px dashed ${TOKENS.c.grey300}` : 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: TOKENS.c.grey500,
          }}>
            {i === 2 ? <IconPlus size={24}/> : null}
          </div>
        ))}
      </div>

      <SectionHeader>{TX(lang, '한 줄 설명', 'Note')}</SectionHeader>
      <div style={{ padding: '0 24px' }}>
        <div style={{
          padding: 14, background: TOKENS.c.grey100, borderRadius: 12, minHeight: 88,
          ...ts('body1'), color: TOKENS.c.grey700,
        }}>{TX(lang,
          '평소엔 25,000원 정도 나오는데\n이번에 31,000원 나왔어요. 누수 가능성이 있어요.',
          'It\'s usually around 25,000. This time 31,000. May be a leak.')}
        </div>
      </div>

      <BottomCTA brand={brand}>{TX(lang, '이의 제기 보내기', 'Submit dispute')}</BottomCTA>
    </Frame>
  );
}

// 15 · 분쟁 진행 (3-step)
function T15_DisputeStatus({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<Badge color="yellow">{TX(lang, '진행 중', 'In review')}</Badge>}/>
      <PageTitle sub={TX(lang, '평균 4.2일 안에 결과가 나와요', 'Avg. resolution in 4.2 days')}>
        {TX(lang, '분쟁이\n진행 중이에요', 'Your dispute\nis being reviewed')}
      </PageTitle>

      <div style={{ padding: '0 24px' }}>
        <Stepper steps={[1,2,3]} current={1} color={brand}/>
      </div>

      {/* Timeline */}
      <Card mt={20} pad={20} radius={16} bg={TOKENS.c.grey50}>
        {[
          { t: TX(lang, '이의 제기 접수', 'Filed'), s: '09.04 · 14:32', done: true },
          { t: TX(lang, '집주인에게 알림', 'Landlord notified'), s: '09.04 · 14:32', done: true },
          { t: TX(lang, 'BlueSafe 패널 검토 중', 'BlueSafe panel reviewing'), s: TX(lang, '진행 중', 'in progress'), active: true },
          { t: TX(lang, '판정 + 환불', 'Verdict + refund'), s: TX(lang, '예상 09.08', 'expected 09.08'), done: false },
        ].map((r, i, arr) => (
          <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: i === arr.length - 1 ? 0 : 18, position: 'relative' }}>
            {i !== arr.length - 1 && (
              <div style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, background: r.done ? brand : TOKENS.c.grey200 }}/>
            )}
            <div style={{
              width: 28, height: 28, borderRadius: 14, flexShrink: 0,
              background: r.done ? brand : (r.active ? TOKENS.c.white : TOKENS.c.grey200),
              border: r.active ? `2px solid ${brand}` : 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: r.done ? TOKENS.c.white : (r.active ? brand : TOKENS.c.grey500),
              fontWeight: 700, fontSize: 12,
            }}>{r.done ? <IconCheck size={14} stroke={3}/> : (r.active ? <IconDots size={12}/> : null)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ ...ts('label1'), color: r.done || r.active ? TOKENS.c.grey900 : TOKENS.c.grey600 }}>{r.t}</div>
              <div style={{ ...ts('cap1'), color: TOKENS.c.grey500, marginTop: 2 }}>{r.s}</div>
            </div>
          </div>
        ))}
      </Card>

      <Card mt={12} pad={16} radius={14} bg={TOKENS.brand.primaryLt}>
        <div style={{ ...ts('label1'), color: TOKENS.brand.primaryDk }}>
          {TX(lang, '걱정하지 마세요', 'Don\'t worry')}
        </div>
        <div style={{ ...ts('cap1'), color: TOKENS.brand.primaryDk, marginTop: 4 }}>
          {TX(lang,
            '결과가 나올 때까지 차액(6,000원)이 자동으로 보류돼요. 부담 없이 기다려요.',
            'The disputed amount (6,000) is held until the verdict.')}
        </div>
      </Card>
    </Frame>
  );
}

// 16 · 판정 + 환불
function T16_DisputeResult({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <PageTitle sub={TX(lang, '환불이 토스 계좌에 들어왔어요', 'Refund landed in your Toss account')}>
        {TX(lang, '이의 제기가\n인정됐어요', 'Your dispute\nwas accepted')}
      </PageTitle>

      <Card mt={4} pad={20} radius={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: brand, color: TOKENS.c.white,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconCheck color={TOKENS.c.white} size={26} stroke={3}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, fontWeight: 600 }}>{TX(lang, '환불 금액', 'Refund')}</div>
            <div style={{ ...ts('h2'), color: TOKENS.c.grey900, marginTop: 2, fontWeight: 700, letterSpacing: -0.3 }}>{krw(6000)}</div>
          </div>
        </div>
        <div style={{ height: 1, background: TOKENS.c.grey150, margin: '14px 0' }}/>
        {[
          [TX(lang, '판정', 'Verdict'), TX(lang, '임차인 인정', 'In favor of tenant')],
          [TX(lang, '근거', 'Basis'), TX(lang, '계량기 수치 + 평년 비교', 'Meter + neighborhood avg.')],
          [TX(lang, '입금 시점', 'Settled'), TX(lang, '오늘 16:18', 'Today 16:18')],
        ].map(([k, v], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginTop: 10 }}>
            <span style={{ ...ts('label2'), color: TOKENS.c.grey600, flexShrink: 0 }}>{k}</span>
            <span style={{ ...ts('label1'), color: TOKENS.c.grey900, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </Card>

      <Card mt={12} pad={16} radius={14} bg={TOKENS.c.grey50}>
        <div style={{ ...ts('cap1'), color: TOKENS.c.grey600, lineHeight: 1.5 }}>
          {TX(lang,
            '“계량기 수치를 비교한 결과 평년 대비 12% 초과 사용이 확인되지 않았어요. 차액 6,000원을 임차인에게 돌려드려요.” — BlueSafe Panel',
            '“Meter readings did not show usage exceeding 12% over neighborhood avg. Refund 6,000 to tenant.” — BlueSafe Panel')}
        </div>
      </Card>

      <BottomCTA brand={brand}>{TX(lang, '확인', 'OK')}</BottomCTA>
    </Frame>
  );
}

// 17 · 퇴실 체크리스트
function T17_Moveout({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true}/>
      <PageTitle sub={TX(lang, '4가지를 마치면 자동 반환이 시작돼요', 'Finish 4 steps to start auto-return')}>
        {TX(lang, '퇴실 체크리스트', 'Move-out check')}
      </PageTitle>

      {[
        { t: TX(lang, '집 상태 사진 찍기', 'Photograph the unit'), s: TX(lang, '거실·주방·욕실·방', 'Living, kitchen, bath, room'), n: '4/4', done: true },
        { t: TX(lang, '공과금 정산', 'Settle utilities'), s: TX(lang, '8월분까지 완료', 'Through Aug. paid'), n: '✓', done: true },
        { t: TX(lang, '열쇠 반납 확인', 'Confirm key return'), s: TX(lang, '카카오톡 답변 받음', 'Kakao confirmation'), n: '✓', done: true },
        { t: TX(lang, '집주인 최종 확인 요청', 'Request final OK'), s: TX(lang, '아직', 'Pending'), n: '!', done: false },
      ].map((r, i) => (
        <ListRow key={i} divider
          leading={<div style={{
            width: 36, height: 36, borderRadius: 10,
            background: r.done ? TOKENS.brand.primaryLt : TOKENS.c.grey100,
            color: r.done ? TOKENS.brand.primaryDk : TOKENS.c.grey600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>{r.done ? <IconCheck size={18} stroke={3}/> : (i + 1)}</div>}
          title={r.t}
          sub={r.s}
          tail={r.done
            ? <Badge color="green">{TX(lang, '완료', 'Done')}</Badge>
            : <Badge color="yellow">{TX(lang, '필요', 'Todo')}</Badge>}
        />
      ))}

      <Card mt={16} pad={16} radius={14} bg={TOKENS.brand.primaryLt}>
        <div style={{ ...ts('label1'), color: TOKENS.brand.primaryDk }}>
          {TX(lang, '체크 끝나면 어떻게 돼요?', 'What happens after?')}
        </div>
        <div style={{ ...ts('cap1'), color: TOKENS.brand.primaryDk, marginTop: 4, opacity: 0.9 }}>
          {TX(lang,
            '집주인이 7일 동안 이의제기를 안 하면 자동으로 보증금이 풀려요.',
            'If landlord doesn\'t object in 7 days, deposit auto-releases.')}
        </div>
      </Card>

      <BottomCTA brand={brand}>{TX(lang, '집주인 확인 요청', 'Request landlord OK')}</BottomCTA>
    </Frame>
  );
}

// 18 · 보증금 반환 완료
function T18_Returned({ lang, brand }) {
  return (
    <Frame bg={TOKENS.brand.canvas}>
      <TopBar onBack={false} right={<button style={iconBtnStyle}><IconClose color={TOKENS.c.grey700}/></button>}/>

      <div style={{ textAlign: 'center', padding: '12px 24px 0' }}>
        <div style={{
          width: 96, height: 96, margin: '0 auto', borderRadius: 48,
          background: brand, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 0 14px ${TOKENS.brand.primaryLt}`,
        }}>
          <IconArrowDown color={TOKENS.c.white} size={48}/>
        </div>
        <h1 style={{ ...ts('h1'), fontSize: 24, marginTop: 18, color: TOKENS.c.grey900 }}>
          {TX(lang, '보증금이 돌아왔어요', 'Deposit returned')}
        </h1>
        <div style={{ ...ts('h1'), fontSize: 38, color: brand, marginTop: 8, fontWeight: 800, letterSpacing: -1 }}>
          {krw(15000000)}
        </div>
        <p style={{ ...ts('body1'), color: TOKENS.c.grey600, marginTop: 8 }}>
          {TX(lang, '토스뱅크 ••• 8821로 입금됐어요', 'Sent to Toss Bank ••• 8821')}
        </p>
      </div>

      <Card mt={28} pad={20} radius={16} bg={TOKENS.c.white}>
        <div style={{ ...ts('cap1'), color: TOKENS.c.grey500, fontWeight: 700, letterSpacing: 1 }}>SETTLEMENT</div>
        {[
          [TX(lang, '원래 보증금', 'Original deposit'), krw(15000000)],
          [TX(lang, '이의제기 환불', 'Dispute refund'), '+' + krw(6000)],
          [TX(lang, '청소 차감', 'Cleaning'), '−' + krw(50000)],
          [TX(lang, '최종 입금', 'Net'), krw(14956000), true],
        ].map(([k, v, bold], i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: i === 0 ? 12 : 10, paddingTop: bold ? 12 : 0,
            borderTop: bold ? `1px solid ${TOKENS.c.grey150}` : 0,
          }}>
            <span style={{ ...ts(bold ? 'title2' : 'label2'), color: TOKENS.c.grey700 }}>{k}</span>
            <span style={{ ...ts(bold ? 'title2' : 'label1'), color: TOKENS.c.grey900, fontWeight: bold ? 700 : 600 }}>{v}</span>
          </div>
        ))}
      </Card>

      <BottomCTA brand={brand} secondary={TX(lang, '영수증', 'Receipt')}>{TX(lang, '본국으로 송금', 'Send home')}</BottomCTA>
    </Frame>
  );
}

// 19 · 본국 송금 (FX)
function T19_FX({ lang, brand }) {
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<Badge color="green">{TX(lang, '저렴한 환율', 'Best rate')}</Badge>}/>
      <PageTitle>{TX(lang, '본국으로\n송금하기', 'Send back\nhome')}</PageTitle>

      <Card mt={4} pad={20} radius={16} bg={TOKENS.c.grey50}>
        <div style={{ ...ts('label2'), color: TOKENS.c.grey600 }}>{TX(lang, '보낼 금액', 'Sending')}</div>
        <div style={{ ...ts('h1'), fontSize: 28, color: TOKENS.c.grey900, marginTop: 4 }}>{krw(14956000)}</div>
        <div style={{
          height: 1, background: TOKENS.c.grey200, margin: '16px -20px',
          backgroundImage: `linear-gradient(90deg, ${TOKENS.c.grey200} 50%, transparent 50%)`,
          backgroundSize: '8px 1px',
        }}/>
        <div style={{ ...ts('label2'), color: TOKENS.c.grey600 }}>{TX(lang, '받는 금액 (USD)', 'Receiving (USD)')}</div>
        <div style={{ ...ts('h1'), fontSize: 28, color: brand, marginTop: 4, fontWeight: 800 }}>{usd(11150.45)}</div>
        <div style={{ ...ts('cap1'), color: TOKENS.c.grey500, marginTop: 4 }}>
          1 USD = 1,341.30 KRW · {TX(lang, 'XRPL 브릿지 사용', 'via XRPL bridge')}
        </div>
      </Card>

      <SectionHeader>{TX(lang, '받는 사람', 'Recipient')}</SectionHeader>
      <ListRow
        leading={<Squircle size={40} bg={TOKENS.c.grey100} color={TOKENS.c.grey700}><IconUser size={20}/></Squircle>}
        title="John Park"
        sub="Bank of America · ••• 4421"
        tail={<Badge color="grey">USA</Badge>}
      />
      <Divider/>
      <ListRow
        leading={<Squircle size={40} bg={TOKENS.c.grey100} color={TOKENS.c.grey600}><IconPlus size={20}/></Squircle>}
        title={<span style={{ color: TOKENS.c.grey600 }}>{TX(lang, '다른 받는 사람 추가', 'Add another recipient')}</span>}
      />

      <Card mt={12} pad={16} radius={14} bg={TOKENS.brand.primaryLt}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...ts('label1'), color: TOKENS.brand.primaryDk }}>
          <span>{TX(lang, '시중 은행 대비 절약', 'Saved vs. bank')}</span>
          <span style={{ fontWeight: 700 }}>+ ₩42,300</span>
        </div>
      </Card>

      <BottomCTA brand={brand}>{TX(lang, '확인하고 송금', 'Confirm send')}</BottomCTA>
    </Frame>
  );
}

// 20 · 활동 내역
function T20_Activity({ lang, brand }) {
  const items = [
    { d: '06.07', t: TX(lang, '본국 송금 완료', 'Sent abroad'), s: 'John Park · USA', v: '−' + krw(14956000), c: TOKENS.c.grey900 },
    { d: '06.07', t: TX(lang, '보증금 반환', 'Deposit returned'), s: TX(lang, '망원동 12-3', 'Mangwon 12-3'), v: '+' + krw(15000000), c: brand },
    { d: '09.08', t: TX(lang, '이의제기 환불', 'Dispute refund'), s: TX(lang, '8월 가스비', 'Aug. gas'), v: '+' + krw(6000), c: brand },
    { d: '09.04', t: TX(lang, '이의제기 접수', 'Dispute filed'), s: TX(lang, '진행 중 → 인정', 'Filed → won'), v: '', c: TOKENS.c.grey700 },
    { d: '06.01', t: TX(lang, '월세 납부', 'Rent paid'), s: 'June', v: '−' + krw(680000), c: TOKENS.c.grey900 },
    { d: '06.01', t: TX(lang, '보증금 안전 송금', 'Deposit locked'), s: 'XRPL F2A8…91D3', v: '−' + krw(15000000), c: TOKENS.c.grey900 },
  ];
  // group by month
  return (
    <Frame bg={TOKENS.c.white}>
      <TopBar onBack={true} right={<button style={iconBtnStyle}><IconSearch color={TOKENS.c.grey700}/></button>}/>
      <PageTitle>{TX(lang, '활동 내역', 'Activity')}</PageTitle>

      <div style={{ padding: '0 24px', display: 'flex', gap: 6 }}>
        {[
          TX(lang, '전체', 'All'),
          TX(lang, '안전송금', 'Trust'),
          TX(lang, '월세', 'Rent'),
          TX(lang, '분쟁', 'Dispute'),
        ].map((c, i) => <Chip key={i} size="s" variant="weak" selected={i === 0} brand={brand}>{c}</Chip>)}
      </div>

      <SectionHeader mt={20}>2027 · {TX(lang, '6월', 'June')}</SectionHeader>
      {items.slice(0, 2).map((r, i) => (
        <ListRow key={i} divider
          leading={<div style={{ width: 44, textAlign: 'center', ...ts('cap1'), color: TOKENS.c.grey500 }}>{r.d}</div>}
          title={r.t} sub={r.s}
          tail={<span style={{ color: r.c, fontWeight: 700, ...ts('title2') }}>{r.v}</span>}
        />
      ))}

      <SectionHeader>2026 · {TX(lang, '9월', 'Sept.')}</SectionHeader>
      {items.slice(2, 4).map((r, i) => (
        <ListRow key={i} divider
          leading={<div style={{ width: 44, textAlign: 'center', ...ts('cap1'), color: TOKENS.c.grey500 }}>{r.d}</div>}
          title={r.t} sub={r.s}
          tail={<span style={{ color: r.c, fontWeight: 700, ...ts('title2') }}>{r.v}</span>}
        />
      ))}

      <SectionHeader>2026 · {TX(lang, '6월', 'June')}</SectionHeader>
      {items.slice(4).map((r, i) => (
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
  T13_Bills, T14_Dispute, T15_DisputeStatus, T16_DisputeResult,
  T17_Moveout, T18_Returned, T19_FX, T20_Activity,
});
