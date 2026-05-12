import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import './App.css'
import { backendConfig, bluesafeApi, type BackendContract, type SettlementRecord } from './api/bluesafe'
import { connectInternalWallet } from './api/internalWallet'
import reputationMascot from './assets/reputation-mascot.png'

type ScreenId =
  | 't01' | 'role' | 'wallet' | 't02' | 't03' | 't04' | 't05' | 't06' | 't07' | 't08' | 't09' | 't10'
  | 't11' | 't12' | 't13' | 't17' | 't18' | 't19' | 't20'
  | 'l01' | 'l02' | 'l03' | 'l04' | 'l05' | 'l06' | 'l07' | 'l08' | 'l10'
  | 'l11' | 'l12'

type ScreenDef = {
  id: ScreenId
  label: string
  group: '임차인' | '임대인'
  tab?: 'tenant' | 'landlord'
  component: React.ComponentType<NavProps>
}

type NavProps = {
  next: () => void
  go: (id: ScreenId) => void
  app: AppModel
  actions: AppActions
  busy: boolean
  error: string
}

type UserRole = 'tenant' | 'landlord'

type AppModel = {
  selectedRole: UserRole
  walletConnected: boolean
  walletProvider: string
  walletName: string
  walletNetwork: string
  tenantId: string
  landlordId: string
  tenantAddress: string
  landlordAddress: string
  contract?: BackendContract
  xrplContract?: BackendContract
  settlements: SettlementRecord[]
  backendEvents: string[]
}

type AppActions = {
  selectRole: (role: UserRole) => void
  connectWallet: () => Promise<void>
  createDraftContract: () => Promise<BackendContract>
  lockDeposit: () => Promise<void>
  loadSettlements: () => Promise<void>
  landlordSignContract: () => Promise<void>
  landlordApproveSettlement: () => Promise<void>
}

const tenantScreens: ScreenDef[] = [
  { id: 't01', label: '시작', group: '임차인', component: T01Entry },
  { id: 'role', label: '역할 선택', group: '임차인', component: RoleSelect },
  { id: 't02', label: '온보딩', group: '임차인', component: T02Onboarding },
  { id: 't03', label: '토스 인증', group: '임차인', component: T03Auth },
  { id: 't04', label: 'ARC KYC', group: '임차인', component: T04Kyc },
  { id: 't05', label: '임대인 초대', group: '임차인', component: T05Invite },
  { id: 't06', label: '계약', group: '임차인', tab: 'tenant', component: T06Contract },
  { id: 't07', label: '보증금 송금', group: '임차인', component: T07Pay },
  { id: 't08', label: '영수증', group: '임차인', component: T08Receipt },
  { id: 't09', label: '홈', group: '임차인', tab: 'tenant', component: T09Home },
  { id: 't10', label: '자동 반환', group: '임차인', component: T10Countdown },
  { id: 't11', label: '안전 리포트', group: '임차인', component: T11Report },
  { id: 't12', label: '평판', group: '임차인', component: T12Reputation },
  { id: 't13', label: '공과금', group: '임차인', component: T13Bills },
  { id: 't17', label: '퇴실 체크', group: '임차인', component: T17Moveout },
  { id: 't18', label: '반환 완료', group: '임차인', component: T18Returned },
  { id: 't19', label: '본국 송금', group: '임차인', component: T19Fx },
  { id: 't20', label: '활동 내역', group: '임차인', tab: 'tenant', component: T20Activity },
]

const landlordScreens: ScreenDef[] = [
  { id: 'l01', label: '초대', group: '임대인', component: L01Invited },
  { id: 'l02', label: '임대인 인증', group: '임대인', component: L02Verify },
  { id: 'l03', label: '매물 정보', group: '임대인', component: L03Property },
  { id: 'l04', label: '계약 확인', group: '임대인', component: L04Review },
  { id: 'l05', label: '계약 완료', group: '임대인', component: L05Signed },
  { id: 'l06', label: '임대인 홈', group: '임대인', tab: 'landlord', component: L06Home },
  { id: 'l07', label: '매물 상세', group: '임대인', component: L07Detail },
  { id: 'l08', label: '미납 자동 차감', group: '임대인', component: L08LateRent },
  { id: 'l10', label: '수익 리포트', group: '임대인', tab: 'landlord', component: L10Earnings },
  { id: 'l11', label: '보증금 정산', group: '임대인', component: L11DepositRelease },
  { id: 'l12', label: '거래 내역', group: '임대인', tab: 'landlord', component: L12Activity },
]

const walletScreen: ScreenDef = { id: 'wallet', label: '지갑 연결', group: tenantScreens[0].group, component: WalletConnect }
const allScreens = [...tenantScreens.slice(0, 2), walletScreen, ...tenantScreens.slice(2), ...landlordScreens]

function getInitialScreen(): ScreenId {
  const screen = new URLSearchParams(window.location.search).get('screen') as ScreenId | null
  return screen && allScreens.some((item) => item.id === screen) ? screen : 't01'
}

function getInitialRole(screenId: ScreenId): UserRole {
  const role = new URLSearchParams(window.location.search).get('role')
  if (role === 'tenant' || role === 'landlord') return role
  return screenId.startsWith('l') ? 'landlord' : 'tenant'
}

function App() {
  const [screenId, setScreenId] = useState<ScreenId>(getInitialScreen)
  const [app, setApp] = useState<AppModel>({
    selectedRole: getInitialRole(getInitialScreen()),
    walletConnected: false,
    walletProvider: '',
    walletName: '',
    walletNetwork: '',
    tenantId: 'tenant_sarah_kim',
    landlordId: 'landlord_kim',
    tenantAddress: '',
    landlordAddress: '',
    settlements: [],
    backendEvents: [],
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currentIndex = allScreens.findIndex((screen) => screen.id === screenId)
  const current = allScreens[currentIndex]
  const CurrentScreen = current.component
  const showTopBar = screenId !== 't01' && !isChromeLessScreen(screenId)

  const go = (id: ScreenId) => setScreenId(id)
  const next = () => setScreenId(allScreens[Math.min(currentIndex + 1, allScreens.length - 1)].id)
  const back = () => setScreenId(allScreens[Math.max(currentIndex - 1, 0)].id)
  const pushEvent = (message: string) => {
    setApp((prev) => ({ ...prev, backendEvents: [message, ...prev.backendEvents].slice(0, 5) }))
  }
  const run = async <T,>(label: string, task: () => Promise<T>) => {
    setBusy(true)
    setError('')
    try {
      const result = await task()
      pushEvent(label)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : '요청 처리에 실패했어요'
      setError(message)
      pushEvent(`${label} 실패: ${message}`)
      throw err
    } finally {
      setBusy(false)
    }
  }
  const actions: AppActions = {
    selectRole: (role) => {
      setApp((prev) => ({ ...prev, selectedRole: role }))
    },
    connectWallet: async () => {
      await run('BlueSafe 내부 XRPL 지갑 연결', async () => {
        const session = await connectInternalWallet(app.selectedRole)
        setApp((prev) => {
          const nextState = {
            ...prev,
            walletConnected: true,
            walletProvider: session.provider,
            walletName: session.account,
            walletNetwork: session.network,
          }

          return prev.selectedRole === 'tenant'
            ? { ...nextState, tenantAddress: session.account }
            : { ...nextState, landlordAddress: session.account }
        })
      })
    },
    createDraftContract: async () => {
      if (app.contract) return app.contract
      return run('BE2 계약 draft 생성', async () => {
        if (!backendConfig.hasBe2) throw new Error('BE2 URL is not configured')
        const contract = await bluesafeApi.createOperationalContract({ tenantId: app.tenantId, landlordId: app.landlordId })
        setApp((prev) => ({ ...prev, contract }))
        return contract
      })
    },
    lockDeposit: async () => {
      await run('BE1 XRPL 에스크로 락업 + BE2 앵커 연결', async () => {
        const contract = app.contract ?? await actions.createDraftContract()
        if (backendConfig.hasBe2 && contract.status === 'draft') {
          await bluesafeApi.updateOperationalContractStatus(contract.id, 'escrow_pending')
        }

        if (!backendConfig.hasBe1) throw new Error('BE1 URL is not configured')
        if (!app.tenantAddress || !app.landlordAddress) throw new Error('Tenant and landlord wallet addresses are required')
        if (!contract.depositAmount || !contract.stakeAmount) throw new Error('Contract depositAmount and stakeAmount are required')
        if (!contract.startsAt || !contract.endsAt) throw new Error('Contract startsAt and endsAt are required')
        const endsAt = new Date(contract.endsAt)
        if (Number.isNaN(endsAt.getTime())) throw new Error('Contract endsAt is invalid')
        const finishAfter = addDays(endsAt, 7).toISOString()
        const cancelAfter = addDays(endsAt, 30).toISOString()

        const xrplContract = await bluesafeApi.createXrplContract({
          tenantAddress: app.tenantAddress,
          landlordAddress: app.landlordAddress,
          depositAmount: contract.depositAmount,
          stakeAmount: contract.stakeAmount,
          startsAt: contract.startsAt,
          endsAt: contract.endsAt,
          finishAfter,
          cancelAfter,
          tenantPii: 'tenant verified by BlueSafe',
          landlordPii: 'landlord verified by BlueSafe',
          tenantEmail: 'tenant@bluesafe.local',
        })

        const txHash = xrplContract.depositEscrowTxHash
        if (!txHash) throw new Error('BE1 did not return an escrow transaction hash')
        const anchored = await bluesafeApi.anchorEscrow(contract.id, txHash)

        await bluesafeApi.trackTx({
          txHash,
          txType: 'EscrowCreate',
          account: xrplContract.contractAccountAddress ?? app.tenantAddress,
        }).catch(() => undefined)

        setApp((prev) => ({ ...prev, contract: anchored, xrplContract }))
      })
    },
    loadSettlements: async () => {
      const contractId = app.contract?.id
      if (!contractId || !backendConfig.hasBe2) return
      await run('BE2 정산 상태 조회', async () => {
        const page = await bluesafeApi.listSettlements(contractId)
        setApp((prev) => ({ ...prev, settlements: page.items }))
      })
    },
    landlordSignContract: async () => {
      await run('BE2 임대인 계약 동의', async () => {
        const contract = app.contract ?? await actions.createDraftContract()
        if (!backendConfig.hasBe2) throw new Error('BE2 URL is not configured')
        const signed = await bluesafeApi.updateOperationalContractStatus(contract.id, contract.status === 'draft' ? 'escrow_pending' : contract.status)
        setApp((prev) => ({ ...prev, contract: signed }))
      })
    },
    landlordApproveSettlement: async () => {
      await run('BE2 보증금 정산 승인', async () => {
        const contract = app.contract ?? await actions.createDraftContract()
        const settlement = app.settlements[0]
        if (!backendConfig.hasBe2) throw new Error('BE2 URL is not configured')
        if (!settlement) throw new Error('No settlement exists in backend state')
        const updated = await bluesafeApi.updateSettlementStatus(settlement.id, {
          status: 'confirmed',
          amountMinor: settlement.amountMinor,
          currencyCode: settlement.currencyCode,
          batchId: `settlement-${contract.id}`,
        })
        setApp((prev) => ({ ...prev, settlements: [updated, ...prev.settlements.slice(1)] }))
      })
    },
  }

  return (
    <main className="app-shell">
      <section className="phone">
        <StatusBar light={screenId === 't01'} />
        <div className={screenId === 't01' ? 'viewport is-entry' : 'viewport'}>
          {showTopBar && <TopBar title={current.label} onBack={back} />}
          <CurrentScreen key={screenId} next={next} go={go} app={app} actions={actions} busy={busy} error={error} />
        </div>
        {current.tab === 'tenant' && <TenantNav active={screenId} go={go} />}
        {current.tab === 'landlord' && <LandlordNav active={screenId} go={go} />}
        <HomeIndicator light={screenId === 't01'} />
      </section>
    </main>
  )
}

function T01Entry({ next }: NavProps) {
  return (
    <div className="entry">
      <img src={reputationMascot} alt="" className="entry-watermark" />
      <div className="entry-copy">
        <h1>보증금 걱정<br />더이상 하지마세요</h1>
        <p>블루세이프가 지켜드릴게요.<br />토스 인증으로 30초만에 시작해요.</p>
      </div>
      <div className="entry-keywords" aria-label="BlueSafe 핵심 기능">
        <span>멀티시그</span>
        <span>자동반환</span>
        <span>국제송금</span>
      </div>
      <div className="entry-bottom"><button className="white-cta" onClick={next}>시작하기</button><span>토스 인증으로 30초 만에 가입</span></div>
    </div>
  )
}

function RoleSelect({ go, actions }: NavProps) {
  const [role, setRole] = useState<'tenant' | 'landlord'>('tenant')
  const start = () => {
    actions.selectRole(role)
    go('wallet')
  }

  return (
    <Page>
      <div className="role-page">
        <Hero title={'어떤 계약을\n시작할까요?'} desc="역할에 맞는 화면으로 안내할게요." />
        <div className="role-select-list" aria-label="역할 선택">
          <button className={role === 'tenant' ? 'active' : ''} onClick={() => setRole('tenant')}>
            <span>임차인</span>
            <strong>보증금을 안전하게 맡길래요</strong>
            <small>계약 확인, 보증금 락업, 자동 반환</small>
          </button>
          <button className={role === 'landlord' ? 'active' : ''} onClick={() => setRole('landlord')}>
            <span>임대인</span>
            <strong>계약과 정산을 관리할래요</strong>
            <small>계약 확인, 월세 정산, 반환 승인</small>
          </button>
        </div>
        <div className="entry-bottom role-bottom"><button className="white-cta" onClick={start}>시작하기</button><span>{role === 'tenant' ? '임차인 계약 플로우로 시작' : '임대인 계약 플로우로 시작'}</span></div>
      </div>
    </Page>
  )
}

function WalletConnect({ go, app, actions, error }: NavProps) {
  const [connecting, setConnecting] = useState(false)
  const isTenant = app.selectedRole === 'tenant'
  const address = isTenant ? app.tenantAddress : app.landlordAddress
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-6)}`
  const continueToRole = () => go(isTenant ? 't02' : 'l01')
  const connect = async () => {
    setConnecting(true)
    try {
      await actions.connectWallet()
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Page>
      <div className="wallet-page">
        <Hero
          title={'BlueSafe 지갑을\n준비해요'}
          desc={isTenant ? '보증금을 안전하게 보관할 내부 XRPL 지갑이에요.' : '계약과 정산을 확인할 내부 XRPL 지갑이에요.'}
        />
        <div className="wallet-visual" aria-hidden="true">
          <div className="wallet-orbit">
            <span />
            <span />
            <strong>XRPL</strong>
          </div>
        </div>
        <div className="wallet-card">
          <div>
            <span>{app.walletConnected ? '연결 완료' : '연결 대기'}</span>
            <strong>{app.walletConnected ? shortAddress : '내부 XRPL 지갑을 생성해주세요'}</strong>
            <p>{app.walletConnected ? `${app.walletProvider} · ${app.walletNetwork || 'XRPL'} · 서버 보관` : 'BlueSafe 서버가 지갑을 만들고 주소만 앱에 연결해요.'}</p>
          </div>
        </div>
        <div className="wallet-points">
          <span>멀티시그 보관</span>
          <span>온체인 영수증</span>
          <span>자동 반환 추적</span>
        </div>
        {error && <p className="wallet-error">{error}</p>}
        <div className="entry-bottom wallet-bottom">
          <button className="white-cta" onClick={app.walletConnected ? continueToRole : connect}>
            {app.walletConnected ? '계속하기' : connecting ? '준비 중' : '내 지갑 만들기'}
          </button>
          <span>{isTenant ? '임차인 플로우로 이어져요' : '임대인 플로우로 이어져요'}</span>
        </div>
      </div>
    </Page>
  )
}

function T02Onboarding({ next }: NavProps) {
  const [slide, setSlide] = useState(0)
  const slides = [
    {
      eyebrow: '01 · LOCKUP',
      title: '보증금이\n에스크로에 잠겨요',
      desc: '계약 기간 동안 임대인도, 임차인도\n중간에 꺼낼 수 없어요.',
      visual: <VaultDiagram />,
    },
    {
      eyebrow: '02 · RETURN',
      title: '퇴실 후\n자동으로 돌아와요',
      desc: '집주인이 응답하지 않아도\n7일 뒤 보증금이 자동 반환돼요.',
      visual: <ExamplePanel kind="return" />,
    },
    {
      eyebrow: '03 · BILLS',
      title: '공과금을\n자동으로 비교해요',
      desc: '평년보다 높은 청구는\n근거 자료로 기록해둘 수 있어요.',
      visual: <ExamplePanel kind="bills" />,
    },
    {
      eyebrow: '04 · PROOF',
      title: '모든 기록은\n직접 확인할 수 있어요',
      desc: '보증금 락업과 반환 기록은\nXRPL Explorer에서 확인돼요.',
      visual: <ExamplePanel kind="proof" />,
    },
  ]
  const current = slides[slide]
  const isLast = slide === slides.length - 1

  return (
    <Page>
      <div className="skip-row"><button>건너뛰기</button></div>
      <Hero title={current.title} desc={current.desc} />
      {current.visual}
      <Dots active={slide} count={slides.length} />
      <BottomCTA label={isLast ? '토스로 인증하기' : '다음'} onClick={() => isLast ? next() : setSlide(slide + 1)} />
    </Page>
  )
}

function T03Auth({ next }: NavProps) {
  const [open, setOpen] = useState(false)
  return (
    <Page>
      <Hero title={'토스로\n간편하게 인증하기'} desc="본인 확인을 위해 한 번만 거치면 돼요" />
      <Card tone="soft"><div className="auth-row"><IconBox><ShieldIcon /></IconBox><div><strong>안전한 본인확인</strong><span>주민등록·외국인등록 정보를 사용해요</span></div></div></Card>
      <SectionTitle>BlueSafe가 받아오는 정보</SectionTitle>
      <ListItem icon={<CheckIcon />} title="이름·생년월일" desc="계약서 자동 채우기에 사용" />
      <ListItem icon={<CheckIcon />} title="외국인등록번호" desc="KYC 1단계 통과" />
      <ListItem icon={<CheckIcon />} title="본인 명의 계좌" desc="보증금 입출금 검증" />
      <p className="notice">토스 약관에 따라 안전하게 처리돼요. BlueSafe 서버에는 암호화돼서 보관돼요.</p>
      <BottomCTA label="토스로 인증하기" secondary="약관 전체 보기" onClick={() => setOpen(true)} />
      <ActionModal open={open} title="토스 인증 완료" onClose={() => setOpen(false)} primaryLabel="다음" onPrimary={next}>
        <p>본인 확인 토큰을 받았다고 가정하고 다음 단계로 이동해요. 실제 연동 시에는 BE2 인증 헤더에 사용할 토큰을 저장하면 돼요.</p>
        <Info label="role" value="tenant" />
        <Info label="auth" value="ready" />
      </ActionModal>
    </Page>
  )
}

function T04Kyc({ next }: NavProps) {
  const [fileName, setFileName] = useState('')
  const [open, setOpen] = useState(false)
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setOpen(true)
  }
  return (
    <Page>
      <StepperHeader current={1} />
      <Hero title={'외국인 등록증을\n업로드해요'} />
      <div className="camera-card"><div>여기에 카드를 맞춰요</div></div>
      <input className="hidden-input" id="arc-file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={onFile} />
      <SectionTitle>확인 항목</SectionTitle>
      <Checklist items={['카드 전체가 프레임에 들어왔는지', '글자가 흐릿하지 않은지', '뒷면 칩이 보이지 않는지 (선택)']} />
      <BottomCTA label={fileName || '촬영하기'} onClick={() => document.getElementById('arc-file')?.click()} />
      <ActionModal open={open} title="등록증 파일 확인" onClose={() => setOpen(false)} primaryLabel="다음" onPrimary={next}>
        <p>{fileName} 파일을 확인했어요. 실제 OCR/KYC API가 생기면 여기서 업로드 후 검증 결과를 받아오면 됩니다.</p>
      </ActionModal>
    </Page>
  )
}

function T05Invite({ next }: NavProps) {
  const [open, setOpen] = useState(false)
  const inviteLink = 'bluesafe.app/r/8KQ-91D-LM2'
  const copyInvite = async () => {
    await navigator.clipboard?.writeText(inviteLink).catch(() => undefined)
    setOpen(true)
  }
  return (
    <Page>
      <Hero title={'집주인을\n초대해요'} desc="카카오·문자 어디로든 보낼 수 있어요" />
      <Card tone="soft"><div className="copy-link"><span>초대 링크</span><strong>{inviteLink}</strong><button onClick={copyInvite}>복사</button></div><div className="share-row"><button onClick={() => setOpen(true)}>카카오톡</button><button onClick={() => setOpen(true)}>문자</button></div></Card>
      <SectionTitle>집주인이 할 일</SectionTitle>
      <ListItem icon="1" title="링크 클릭 → 토스 인증" desc="같은 BlueSafe 미니앱이 열려요" />
      <ListItem icon="2" title="계약서 확인 + 서명" desc="평균 4분" />
      <ListItem icon="3" title="보증금 받기 계좌 등록" desc="본인 명의만 가능" />
      <BottomCTA label="카카오톡으로 보내기" secondary="나중에" onClick={next} />
      <ActionModal open={open} title="초대 링크 준비 완료" onClose={() => setOpen(false)} primaryLabel="계속" onPrimary={next}>
        <p>집주인이 이 링크로 들어오면 BE2 계약 draft에 landlord 인증 상태를 연결하는 흐름으로 이어지면 돼요.</p>
        <Info label="invite" value={inviteLink} mono />
      </ActionModal>
    </Page>
  )
}

function T06Contract({ next, actions, busy, error, app }: NavProps) {
  const [open, setOpen] = useState(false)
  const signContract = async () => {
    try {
      await actions.createDraftContract()
      setOpen(true)
    } catch {
      return
    }
  }
  return <Page><Hero title="Contract check" desc="Only BE2 contract response is shown. No fixed lease terms." /><Card tone="soft"><Info label="Contract ID" value={app.contract?.id ?? 'No response'} mono={Boolean(app.contract?.id)} /><Info label="Status" value={app.contract?.status ?? 'No response'} /><Info label="Deposit" value={app.contract?.depositAmount ?? 'No amount response'} /><Info label="Start" value={app.contract?.startsAt ? formatDate(new Date(app.contract.startsAt)) : 'No date response'} /><Info label="End" value={app.contract?.endsAt ? formatDate(new Date(app.contract.endsAt)) : 'No date response'} /></Card><SectionTitle>Required data</SectionTitle><ListItem icon={<ReceiptIcon />} title="Contract terms" desc={app.contract ? 'BE2 contract response exists' : 'No BE2 contract response'} action={app.contract ? 'OK' : 'Waiting'} /><ListItem icon={<WalletIcon />} title="Escrow inputs" desc={app.contract?.depositAmount && app.contract?.startsAt && app.contract?.endsAt ? 'Ready' : 'Amount and dates required'} action="BE1" /><BackendInline error={error} /><BottomCTA label={busy ? 'Creating contract' : 'Create contract'} onClick={signContract} /><ActionModal open={open} title="Contract created" onClose={() => setOpen(false)} primaryLabel="Continue" onPrimary={next}><p>BE2 contract response was saved. Amount and dates are required before creating XRPL escrow.</p></ActionModal></Page>
}
function T07Pay({ next, actions, busy, error, app }: NavProps) {
  const hasTenantWallet = Boolean(app.tenantAddress)
  const hasLandlordWallet = Boolean(app.landlordAddress)
  const canRunEscrow = hasTenantWallet && hasLandlordWallet
  return (
    <Page>
      <Hero title="XRPL 에스크로 확인" desc="실제 지갑 주소와 백엔드 응답이 준비됐을 때만 실행해요" />
      <div className="amount-panel">
        <strong>{app.contract ? '계약 생성됨' : '계약 생성 전'}</strong>
        <Info label="BE2 계약 ID" value={app.contract?.id ?? '아직 없음'} mono={Boolean(app.contract?.id)} />
        <Info label="임차인 지갑" value={app.tenantAddress ? shortHash(app.tenantAddress) : '연결 필요'} mono={hasTenantWallet} />
        <Info label="임대인 지갑" value={app.landlordAddress ? shortHash(app.landlordAddress) : '연결 필요'} mono={hasLandlordWallet} />
      </div>
      <SectionTitle>실행 조건</SectionTitle>
      <ListItem icon={<WalletIcon />} title="내부 XRPL 지갑" desc={canRunEscrow ? '양쪽 주소가 준비됐어요' : '임차인과 임대인 지갑 주소가 모두 필요해요'} />
      <ListItem icon={<LockIcon />} title="온체인 에스크로" desc="BE1 /contracts 응답이 있어야 완료 상태로 표시해요" />
      <BackendInline error={error} />
      <BottomCTA label={busy ? '에스크로 생성 중' : 'XRPL 에스크로 생성'} onClick={async () => { try { await actions.lockDeposit(); next() } catch { return } }} />
    </Page>
  )
}

function T08Receipt({ next, app }: NavProps) {
  const txHash = app.xrplContract?.depositEscrowTxHash ?? app.contract?.depositEscrowTxHash
  const account = app.xrplContract?.contractAccountAddress
  const [open, setOpen] = useState(false)
  return (
    <Page>
      <Hero title="에스크로 결과" desc="BE1이 반환한 온체인 값만 표시해요" />
      <Card>
        <Info label="BE1 계약 ID" value={app.xrplContract?.id ?? '응답 없음'} mono={Boolean(app.xrplContract?.id)} />
        <Info label="BE2 계약 ID" value={app.contract?.id ?? '응답 없음'} mono={Boolean(app.contract?.id)} />
        <Info label="XRPL TX" value={txHash ? shortHash(txHash) : '응답 없음'} mono={Boolean(txHash)} />
        <Info label="Escrow Account" value={account ?? '응답 없음'} mono={Boolean(account)} />
      </Card>
      <button className="card blue action-card" disabled={!txHash} onClick={() => setOpen(true)}><strong>온체인 영수증</strong><span>{txHash ? '실제 TX 확인' : '아직 생성되지 않음'}</span></button>
      <BottomCTA label="홈으로" secondary="공유" onClick={next} />
      <ActionModal open={open} title="XRPL 영수증" onClose={() => setOpen(false)} primaryLabel="확인" onPrimary={() => setOpen(false)}>
        <p>현재 백엔드에서 받은 실제 온체인 응답입니다.</p>
        <Info label="tx" value={txHash ?? '없음'} mono={Boolean(txHash)} />
        <Info label="account" value={account ?? '없음'} mono={Boolean(account)} />
      </ActionModal>
    </Page>
  )
}

function T09Home({ go, app, error }: NavProps) {
  const lease = getLeaseMetrics(app)
  const hasContract = Boolean(app.contract || app.xrplContract)
  const hasLeaseDates = Boolean(lease)
  const statusLabel = app.xrplContract?.status ?? app.contract?.status ?? '연동 대기'
  const txHash = app.xrplContract?.depositEscrowTxHash ?? app.contract?.depositEscrowTxHash
  const progress = lease?.progress ?? 0
  const daysLeft = lease?.daysLeft ?? 0
  const livedDays = lease?.livedDays ?? 0

  return (
    <Page bottomNav>
      <div className="home-head"><span>BlueSafe</span></div>
      <BackendStatus app={app} error={error} />
      <div className="home-summary">
        <div className="deposit-card">
          <span>현재 상태</span>
          <strong>{statusLabel}</strong>
          <p>{txHash ? 'XRPL 에스크로가 생성됐어요' : hasContract ? '계약은 생성됐고 에스크로 대기 중이에요' : '백엔드 계약 응답을 기다리고 있어요'}</p>
        </div>
        <div className="contract-card">
          <div className="progress-ring" style={{ '--progress': (hasLeaseDates ? String(progress) : '0') + '%' } as CSSProperties} aria-label="계약 진행률">
            <strong>{hasLeaseDates ? daysLeft : '-'}</strong>
            <span>일 남음</span>
          </div>
          <p>{hasLeaseDates ? '계약 만료까지' : '날짜 응답 없음'}</p>
        </div>
        <div className="living-card">
          <span>거주</span>
          <strong>{hasLeaseDates ? String(livedDays) + '일차' : '--'}</strong>
        </div>
        <div className="quick-grid"><button onClick={() => go('t11')}>리포트</button><button onClick={() => go('t06')}>계약</button><button onClick={() => go('t10')}>반환</button><button onClick={() => go('t12')}>내정보</button></div>
      </div>
      <div className="home-tasks">
        <SectionTitle right="전체">오늘 할 일</SectionTitle>
        {hasContract ? <>
          <ListItem icon={<AlertIcon />} title="계약 상태 확인" desc={statusLabel} />
          <ListItem icon={<img src={reputationMascot} alt="" className="mini-asset" />} title="XRPL 에스크로" desc={txHash ? shortHash(txHash) : '온체인 생성 전이에요'} />
        </> : <Card tone="soft"><strong>아직 계약 데이터가 없어요</strong><span>임차인/임대인 지갑 연결 후 실제 백엔드 계약을 생성해 주세요.</span></Card>}
      </div>
      <div className="screen-fill" />
    </Page>
  )
}

function T10Countdown({ app, actions }: NavProps) {
  const lease = getLeaseMetrics(app)
  const settlement = app.settlements[0]
  const hasContract = Boolean(app.contract || app.xrplContract)
  const hasLeaseDates = Boolean(lease)
  const didLoadSettlements = useRef(false)
  const returnLeft = lease?.returnLeft
  const progress = lease?.progress ?? 0
  const finishAfter = lease?.finishAfter

  useEffect(() => {
    if (didLoadSettlements.current) return
    didLoadSettlements.current = true
    void actions.loadSettlements()
  }, [actions])

  return (
    <Page>
      <Hero title="자동 반환까지" desc="계약 날짜와 정산 응답이 있을 때만 진행률을 계산해요" />
      <div className="time-grid"><TimeBox value={returnLeft ? pad2(returnLeft.days) : '--'} label="일" /><TimeBox value={returnLeft ? pad2(returnLeft.hours) : '--'} label="시간" /><TimeBox value={returnLeft ? pad2(returnLeft.minutes) : '--'} label="분" /></div>
      <div className="return-progress">
        <div className="return-progress-head"><span>계약 진행률</span><strong>{hasLeaseDates ? String(progress) + '%' : '대기'}</strong></div>
        <div className="return-track"><span style={{ width: (hasLeaseDates ? String(progress) : '0') + '%' }} /><b className="safe-emoji" aria-label="money">💸</b></div>
      </div>
      <Card tone="blue"><strong>{settlement ? '정산 상태: ' + settlement.status : hasContract ? '정산 응답 대기 중' : '계약 응답 없음'}</strong><span>{finishAfter ? formatDate(finishAfter) + ' 이후 반환 조건을 확인해요.' : '계약 날짜 또는 BE2 settlement 응답이 필요해요.'}</span></Card>
      <SectionTitle>진행 상황</SectionTitle>
      <Timeline items={lease ? [
        '계약 시작|' + formatDate(lease.startsAt),
        '계약 만료|' + formatDate(lease.endsAt),
        '자동 반환 대기|' + (lease.returnLeft.totalMs > 0 ? String(lease.returnLeft.days) + '일 남음' : '반환 조건 확인'),
        '정산 응답|' + formatDate(lease.finishAfter) + ' 이후',
      ] : ['계약 날짜|응답 없음', 'XRPL 에스크로|응답 없음', '정산 상태|응답 없음']} />
    </Page>
  )
}

function T11Report({ app }: NavProps) {
  const hasContract = Boolean(app.contract || app.xrplContract)
  const hasSettlement = app.settlements.length > 0
  return <Page><Hero title="Safety report" desc="Only live contract and settlement signals are listed." /><Card tone="soft"><strong>No report score yet</strong><span>A backend scoring API is required before score and delta can be displayed.</span></Card><SectionTitle>Signals</SectionTitle><ListItem icon={<ReceiptIcon />} title="Contract" desc={hasContract ? app.contract?.status ?? app.xrplContract?.status ?? 'Response exists' : 'No response'} action={hasContract ? 'OK' : 'Waiting'} /><ListItem icon={<WalletIcon />} title="Settlement" desc={hasSettlement ? app.settlements[0]?.status ?? 'Response exists' : 'No response'} action={hasSettlement ? 'OK' : 'Waiting'} /></Page>
}
function T12Reputation({ next, app }: NavProps) {
  const hasContract = Boolean(app.contract || app.xrplContract)
  return <Page><Hero title="Reputation data" desc="Backend reputation scoring is required." /><Card tone="soft"><strong>No reputation grade yet</strong><span>Score and grade will appear only after the backend scoring API is connected.</span></Card><SectionTitle>Required signals</SectionTitle><ListItem icon={<ReceiptIcon />} title="Contract history" desc={hasContract ? 'Contract response exists' : 'No BE2 contract response'} action={hasContract ? 'OK' : 'Waiting'} /><ListItem icon={<ShieldIcon />} title="Escrow history" desc={app.xrplContract ? 'BE1 escrow response exists' : 'No BE1 escrow response'} action={app.xrplContract ? 'OK' : 'Waiting'} /><BottomCTA label="Home" secondary="Share disabled" onClick={next} /></Page>
}
function T13Bills({ go }: NavProps) {
  return <Page bottomNav><Hero title="Utility" desc="This flow is disabled in the current product build." /><Card tone="soft"><strong>Utility flow disabled</strong><span>Only contract, wallet, escrow, settlement, and remittance flows remain active.</span></Card><BottomCTA label="Home" secondary="Later" onClick={() => go('t09')} /></Page>
}
function T17Moveout({ next, app }: NavProps) {
  const hasSettlement = app.settlements.length > 0
  return <Page><Hero title="Move-out checklist" desc="Only settlement response is checked." /><ListItem icon={<WalletIcon />} title="Settlement response" desc={hasSettlement ? app.settlements[0]?.status ?? 'Settlement response exists' : 'No settlement response'} action={hasSettlement ? 'OK' : 'Waiting'} /><Card tone="soft"><strong>Return preparation</strong><span>Deposit return flow will appear after BE2 settlement response exists.</span></Card><BottomCTA label="Check settlement" onClick={next} /></Page>
}
function T18Returned({ next, app }: NavProps) {
  const settlement = app.settlements[0]
  return <Page><Hero title="Deposit return" desc="Return amount is shown only from actual settlement response." />{settlement ? <Card><Info label="Settlement ID" value={settlement.id} mono /><Info label="Status" value={settlement.status} /><Info label="Amount" value={settlement.amountMinor ? krw(settlement.amountMinor) : 'No amount response'} strong /></Card> : <Card tone="soft"><strong>No return data</strong><span>BE2 settlement response is required.</span></Card>}<BottomCTA label="Prepare remittance" secondary="Receipt" onClick={next} /></Page>
}
function T19Fx({ next, app }: NavProps) {
  const settlement = app.settlements[0]
  return <Page><Hero title="International remittance" desc="Recipient and FX quote appear only after remittance API is connected." /><Card tone="soft"><strong>{settlement ? 'Settlement amount found' : 'No remittance data'}</strong><span>{settlement?.amountMinor ? krw(settlement.amountMinor) : 'Deposit settlement response is required first.'}</span></Card><SectionTitle>Required integration</SectionTitle><ListItem icon={<WalletIcon />} title="Settlement amount" desc={settlement ? settlement.status : 'No BE2 settlement response'} action={settlement ? 'OK' : 'Waiting'} /><ListItem icon={<UserIcon />} title="Recipient" desc="No remittance API response" action="Waiting" /><BottomCTA label="Confirm" onClick={next} /></Page>
}
function T20Activity({ next, app }: NavProps) {
  const rows: string[][] = []
  const today = formatDate(new Date()).slice(5).replace('-', '.')

  if (app.tenantAddress) rows.push(['Runtime status', today, 'Tenant wallet created', shortHash(app.tenantAddress), 'XRPL'])
  if (app.landlordAddress) rows.push(['', today, 'Landlord wallet created', shortHash(app.landlordAddress), 'XRPL'])
  if (app.contract) rows.push(['', today, 'BE2 contract response', app.contract.id, app.contract.status])
  if (app.xrplContract) rows.push(['', today, 'BE1 escrow response', app.xrplContract.id, app.xrplContract.status])
  if (app.xrplContract?.depositEscrowTxHash) rows.push(['', today, 'XRPL TX created', shortHash(app.xrplContract.depositEscrowTxHash), 'On-chain'])
  app.settlements.forEach((settlement, index) => {
    rows.push([index === 0 ? 'Settlement response' : '', today, 'Settlement status', settlement.id, settlement.status])
  })
  app.backendEvents.slice().reverse().forEach((event, index) => {
    rows.push([index === 0 && rows.length === 0 ? 'Runtime log' : '', today, event, 'Frontend runtime', ''])
  })

  return (
    <Page bottomNav>
      <Hero title="Activity history" desc="Only wallet, contract, escrow, settlement, and runtime events are shown." />
      <div className="chip-wrap compact"><span className="chip selected">All</span><span className="chip">Wallet</span><span className="chip">Contract</span></div>
      {rows.length > 0 ? <ActivityRows rows={rows} /> : <Card tone="soft"><strong>No activity yet</strong><span>Wallet and contract events will appear here after successful backend calls.</span></Card>}
      <BottomCTA label="Landlord view" onClick={next} />
    </Page>
  )
}
function L01Invited({ next, app }: NavProps) {
  return <Page><div className="home-head"><span>BlueSafe</span></div><Hero title="Start as landlord" desc="Actual contract data is shown only from invite or BE2 contract response." /><Card tone="soft"><strong>{app.contract ? 'Contract response found' : 'No invite data'}</strong><span>{app.contract?.id ?? 'BE2 contract or invite API response is required.'}</span></Card><BottomCTA label="View contract" secondary="Later" onClick={next} /></Page>
}
function L02Verify({ next }: NavProps) {
  const [open, setOpen] = useState(false)
  return <Page><StepperHeader current={0} /><Hero title={'임대인\n인증 종류'} desc="월세 받을 명의를 선택해요" /><ListItem icon="개인" title="개인" desc="주민등록증 본인 명의" /><ListItem icon="사업" title="개인사업자" desc="사업자등록증 + 본인 명의" /><ListItem icon="법인" title="법인" desc="법인 인감 + 대표자 인증" /><p className="notice">월세 수령 계좌는 본인 명의여야 해요. BlueSafe가 자동으로 검증해요.</p><BottomCTA label="토스로 인증하기" onClick={() => setOpen(true)} /><ActionModal open={open} title="임대인 인증 준비 완료" onClose={() => setOpen(false)} primaryLabel="다음" onPrimary={next}><p>실제 Toss/OIDC 토큰이 연결되면 BE2 요청의 landlord role 토큰으로 사용해요.</p><Info label="role" value="landlord" /><Info label="auth" value="ready" /></ActionModal></Page>
}

function L03Property({ next, app }: NavProps) {
  return <Page><Hero title="Property data" desc="Address and contract terms require a real property API response." /><Card tone="soft"><strong>No property data</strong><span>{app.contract?.id ? 'Contract ID: ' + app.contract.id : 'BE2 property response is required.'}</span></Card><BottomCTA label="Review contract" onClick={next} /></Page>
}
function L04Review({ next, actions, busy, error, app }: NavProps) {
  const [open, setOpen] = useState(false)
  const sign = async () => {
    try { await actions.landlordSignContract(); setOpen(true) } catch { return }
  }
  return <Page><Hero title="Review contract" desc="Only BE2 contract response is used for landlord signing." /><Card tone="soft"><Info label="Contract ID" value={app.contract?.id ?? 'No response'} mono={Boolean(app.contract?.id)} /><Info label="Status" value={app.contract?.status ?? 'No response'} /></Card><BackendInline error={error} /><BottomCTA label={busy ? 'Saving signature' : 'Agree and sign'} secondary="Request edit" onClick={sign} /><ActionModal open={open} title="Agreement saved" onClose={() => setOpen(false)} primaryLabel="Continue" onPrimary={next}><p>BE2 contract status was updated.</p></ActionModal></Page>
}
function L05Signed({ next, app }: NavProps) {
  return <Page><Hero title="Contract status" desc="No fixed next steps are shown. Only actual contract state." /><Card tone="soft"><Info label="Contract ID" value={app.contract?.id ?? 'No response'} mono={Boolean(app.contract?.id)} /><Info label="Status" value={app.contract?.status ?? 'No response'} /></Card><BottomCTA label="Dashboard" secondary="Contract" onClick={next} /></Page>
}
function L06Home({ go, app }: NavProps) {
  const hasContract = Boolean(app.contract || app.xrplContract)
  return <Page bottomNav><div className="home-head"><span>BlueSafe</span></div><Hero title="Landlord dashboard" desc="Operational data appears only from contract and settlement responses." /><div className="landlord-summary"><div className="income-card"><span>Contract status</span><strong>{app.contract?.status ?? 'No response'}</strong><p>{app.contract?.id ?? 'No BE2 contract'}</p></div><div className="rent-status-card"><span>Settlement</span><strong>{app.settlements.length}</strong><p>responses</p></div><div className="vacancy-card"><span>XRPL</span><strong>{app.xrplContract ? 'Linked' : 'Waiting'}</strong></div><div className="quick-grid"><button onClick={() => go('l07')}>Property</button><button>Rent</button><button onClick={() => go('l11')}>Settlement</button><button onClick={() => go('l10')}>Report</button></div></div><div className="home-tasks landlord-properties"><SectionTitle right="All">Contracts</SectionTitle>{hasContract ? <ListItem icon={<HomeIcon />} title="Contract response" desc={app.contract?.id ?? app.xrplContract?.id} action={app.contract?.status ?? app.xrplContract?.status} onClick={() => go('l07')} /> : <Card tone="soft"><strong>No contract data</strong><span>BE2 contract response will appear here.</span></Card>}</div><BottomSpace /></Page>
}
function L07Detail({ app }: NavProps) {
  return <Page><Hero title="Property detail" desc="Only actual contract response is shown." /><Card tone="soft"><Info label="BE2 contract" value={app.contract?.id ?? 'No response'} mono={Boolean(app.contract?.id)} /><Info label="BE1 escrow" value={app.xrplContract?.id ?? 'No response'} mono={Boolean(app.xrplContract?.id)} /><Info label="Status" value={app.contract?.status ?? app.xrplContract?.status ?? 'No response'} /></Card><SectionTitle>Tenant</SectionTitle><ListItem icon={<UserIcon />} title="Tenant ID" desc={app.tenantId} action={app.tenantAddress ? 'Wallet linked' : 'Waiting'} /></Page>
}
function L08LateRent({ next, app }: NavProps) {
  return <Page><Hero title="Rent status" desc="Late rent and auto-deduction require actual payment or settlement API response." /><Card tone="soft"><strong>No rent event</strong><span>{app.settlements.length ? 'Settlement response exists.' : 'BE2 settlement or payment response is required.'}</span></Card><BottomCTA label="Confirm" secondary="Contact" onClick={next} /></Page>
}
function L10Earnings({ next, app }: NavProps) {
  const total = app.settlements.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0)
  return <Page bottomNav><Hero title="Earnings report" desc="No fixed YTD revenue. Only settlement totals are shown." /><div className="earnings-summary"><div className="earnings-total"><span>Settlement total</span><strong>{total ? krw(total) : 'No response'}</strong><p>{app.settlements.length} records</p></div><div className="earnings-mini"><span>Contract</span><strong>{app.contract ? '1' : '0'}</strong></div><div className="earnings-mini"><span>XRPL</span><strong>{app.xrplContract ? '1' : '0'}</strong></div></div><SectionTitle>By property</SectionTitle>{app.contract ? <ListItem icon={<HomeIcon />} title="Contract response" desc={app.contract.id} action={app.contract.status} /> : <Card tone="soft"><strong>No earnings data</strong><span>Settlement response will appear here.</span></Card>}<BottomCTA label="View settlement" onClick={next} /></Page>
}
function L11DepositRelease({ next, actions, busy, error, app }: NavProps) {
  const [open, setOpen] = useState(false)
  const settlement = app.settlements[0]
  const approve = async () => { try { await actions.landlordApproveSettlement(); setOpen(true) } catch { return } }
  return <Page><Hero title="Deposit settlement" desc="Approval is based only on actual settlement response." /><Card tone="soft"><Info label="Settlement ID" value={settlement?.id ?? 'No response'} mono={Boolean(settlement?.id)} /><Info label="Status" value={settlement?.status ?? 'No response'} /><Info label="Amount" value={settlement?.amountMinor ? krw(settlement.amountMinor) : 'No amount response'} /></Card><BackendInline error={error} /><BottomCTA label={busy ? 'Approving settlement' : 'Approve settlement'} secondary="Reject" onClick={approve} /><ActionModal open={open} title="Settlement approved" onClose={() => setOpen(false)} primaryLabel="Continue" onPrimary={next}><p>BE2 settlement status was updated.</p></ActionModal></Page>
}
function L12Activity({ app }: NavProps) {
  const rows: string[][] = []
  const today = formatDate(new Date()).slice(5).replace('-', '.')
  if (app.contract) rows.push(['Contract', today, 'BE2 contract response', app.contract.id, app.contract.status])
  if (app.xrplContract) rows.push(['', today, 'BE1 escrow response', app.xrplContract.id, app.xrplContract.status])
  app.settlements.forEach((item, index) => rows.push([index === 0 ? 'Settlement' : '', today, 'Settlement status', item.id, item.status]))
  return <Page bottomNav><Hero title="Transaction history" desc="Only contract and settlement responses are shown." /><div className="chip-wrap compact"><span className="chip selected">All</span><span className="chip">Contract</span><span className="chip">Settlement</span></div>{rows.length ? <ActivityRows rows={rows} /> : <Card tone="soft"><strong>No transaction history</strong><span>BE2 contract or settlement response will appear here.</span></Card>}<BottomSpace /></Page>
}
function Page({ children, bottomNav = false }: { children: React.ReactNode; bottomNav?: boolean }) {
  return <section className={bottomNav ? 'page has-bottom-nav' : 'page'}>{children}</section>
}

function Hero({ title, desc }: { eyebrow?: string; title: string; desc?: string }) {
  return <div className="hero"><h1>{title}</h1>{desc && <p>{desc}</p>}</div>
}

function TopBar({ onBack }: { title: string; onBack: () => void }) {
  return <header className="topbar"><button onClick={onBack} aria-label="뒤로"><ChevronLeftIcon /></button><strong aria-hidden="true" /><span /></header>
}

function StatusBar({ light = false }: { light?: boolean }) {
  return <div className={light ? 'status light' : 'status'}><span>9:41</span><span>5G 100%</span></div>
}

function HomeIndicator({ light = false }: { light?: boolean }) {
  return <div className={light ? 'home-indicator light' : 'home-indicator'}><span /></div>
}

function BottomCTA({ label, secondary, onClick }: { label: string; secondary?: string; onClick: () => void }) {
  return <div className={secondary ? 'bottom-cta has-secondary' : 'bottom-cta'}>{secondary && <button className="secondary">{secondary}</button>}<button className="primary" onClick={onClick}>{label}</button></div>
}

function Card({ children, tone = 'white' }: { children: React.ReactNode; tone?: 'white' | 'soft' | 'blue' | 'yellow' }) {
  return <div className={`card ${tone}`}>{children}</div>
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: string }) {
  return <div className="section-title"><h2>{children}</h2>{right && <span>{right}</span>}</div>
}

function ListItem({ icon, title, desc, action, onClick }: { icon: React.ReactNode; title: string; desc?: string; action?: string; onClick?: () => void }) {
  return <button className="list-item" onClick={onClick}><span className="list-icon">{icon}</span><span className="list-copy"><strong>{title}</strong>{desc && <small>{desc}</small>}</span>{action && <em>{action}</em>}</button>
}

function Info({ label, value, strong = false, mono = false }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return <div className="info"><span>{label}</span><strong className={`${strong ? 'strong' : ''} ${mono ? 'mono' : ''}`}>{value}</strong></div>
}

function Checklist({ items }: { items: string[] }) {
  return <>{items.map((item) => <ListItem key={item} icon={<CheckIcon />} title={item} />)}</>
}

function VaultDiagram() {
  return (
    <div className="onboarding-visual vault">
      <svg className="vault-lines" viewBox="0 0 327 232" preserveAspectRatio="none" aria-hidden="true"><path d="M 68 92 C 68 132, 110 150, 140 158" /><path d="M 259 92 C 259 132, 217 150, 187 158" /></svg>
      <div className="party-card tenant"><UserIcon /><span>임차인</span></div>
      <div className="party-card landlord"><KeyIcon /><span>임대인</span></div>
      <div className="vault-core"><LockIcon /><strong>VAULT</strong><small>XRPL Escrow</small></div>
    </div>
  )
}

function ExamplePanel({ kind }: { kind: 'return' | 'bills' | 'proof' }) {
  if (kind === 'return') return <div className="example-panel"><div className="example-calendar"><span>Auto return</span><strong>Waiting</strong><small>Calculated after contract dates exist</small></div><div className="example-chip">D-</div></div>
  if (kind === 'bills') return <div className="example-panel list-preview"><div><CheckIcon /><span>Electric</span><b>Waiting</b></div><div><ReceiptIcon /><span>Gas</span><b>Disabled</b></div><div><CheckIcon /><span>Water</span><b>Waiting</b></div></div>
  return <div className="example-panel proof-preview"><div><span>XRPL TX</span><strong>Waiting</strong><small>Shown after BE1 response</small></div><ShieldIcon /></div>
}
function Dots({ active, count }: { active: number; count: number }) {
  return <div className="dots">{Array.from({ length: count }, (_, i) => <button key={i} className={i === active ? 'active' : ''} />)}</div>
}

function StepperHeader({ current }: { current: number }) {
  return (
    <div className="stepper-head">
      {[0, 1, 2].map((n) => (
        <span key={n} className={n <= current ? 'active' : ''}>
          {n + 1}
        </span>
      ))}
    </div>
  )
}

function Timeline({ items }: { items: string[] }) {
  return <Card tone="soft">{items.map((raw, i) => { const [title, desc] = raw.split('|'); return <div className="step-row" key={title}><span className={i < 2 ? 'done' : ''}>{i < 2 ? <CheckIcon /> : i + 1}</span><div><strong>{title}</strong><small>{desc}</small></div></div> })}</Card>
}

function ActivityRows({ rows }: { rows: string[][] }) {
  return <>{rows.map(([section, date, title, desc, value], i) => <div key={`${date}-${title}-${i}`}>{section && <SectionTitle>{section}</SectionTitle>}<div className="activity-row"><span>{date}</span><div><strong>{title}</strong><small>{desc}</small></div><b>{value}</b></div></div>)}</>
}

function BackendStatus({ app, error }: { app: AppModel; error: string }) {
  const status = app.xrplContract?.status ?? app.contract?.status ?? '백엔드 응답 대기'
  const contractLabel = app.contract?.id ? `BE2 ${app.contract.id}` : 'BE2 응답 없음'
  const xrplLabel = app.xrplContract?.id ? `BE1 ${app.xrplContract.id}` : 'BE1 응답 없음'

  return (
    <div className="backend-status">
      <div>
        <span>연동 상태</span>
        <strong>{status}</strong>
      </div>
      <p>{contractLabel} · {xrplLabel}</p>
      {error && <em>{error}</em>}
    </div>
  )
}

function BackendInline({ label, error }: { label?: string; error?: string }) {
  if (!label && !error) {
    return null
  }

  return (
    <div className={error ? 'backend-inline error' : 'backend-inline'}>
      {label && <span>{label}</span>}
      {error && <span>{error}</span>}
    </div>
  )
}

function ActionModal({
  open,
  title,
  children,
  primaryLabel,
  onPrimary,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  primaryLabel: string
  onPrimary: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-sheet">
        <button className="modal-close" onClick={onClose} aria-label="닫기">×</button>
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        <button className="modal-primary" onClick={onPrimary}>{primaryLabel}</button>
      </div>
    </div>
  )
}

function TenantNav({ active, go }: { active: ScreenId; go: (id: ScreenId) => void }) {
  return <nav className="bottom-nav four-tabs">{[['t09', '홈', <HomeIcon />], ['t20', '내역', <HistoryIcon />], ['t06', '계약', <ReceiptIcon />], ['t12', '내정보', <UserIcon />]].map(([id, label, icon]) => <button key={id as string} className={active === id ? 'active' : ''} onClick={() => go(id as ScreenId)}>{icon}<span>{label as string}</span></button>)}</nav>
}

function LandlordNav({ active, go }: { active: ScreenId; go: (id: ScreenId) => void }) {
  return <nav className="bottom-nav four-tabs">{[['l06', '홈', <HomeIcon />], ['l10', '수익', <ChartIcon />], ['l12', '계약', <ReceiptIcon />], ['l02', '내정보', <UserIcon />]].map(([id, label, icon]) => <button key={id as string} className={active === id ? 'active' : ''} onClick={() => go(id as ScreenId)}>{icon}<span>{label as string}</span></button>)}</nav>
}

function TimeBox({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>
}

function IconBox({ children }: { children: React.ReactNode }) {
  return <span className="icon-box">{children}</span>
}

function BottomSpace() {
  return <div className="bottom-space" />
}

function krw(value: number) {
  return `₩${value.toLocaleString('ko-KR')}`
}

function shortHash(value: string) {
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function getLeaseMetrics(app: AppModel) {
  const startsAt = parseDate(app.contract?.startsAt ?? app.xrplContract?.startsAt)
  const endsAt = parseDate(app.contract?.endsAt ?? app.xrplContract?.endsAt)
  if (!startsAt || !endsAt) return undefined
  const finishAfter = addDays(endsAt, 7)
  const now = new Date()
  const totalMs = Math.max(1, endsAt.getTime() - startsAt.getTime())
  const elapsedMs = clamp(now.getTime() - startsAt.getTime(), 0, totalMs)
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / dayMs))
  const livedDays = Math.max(0, Math.floor((now.getTime() - startsAt.getTime()) / dayMs) + 1)
  const progress = Math.round((elapsedMs / totalMs) * 100)
  const returnLeft = splitDuration(finishAfter.getTime() - now.getTime())
  return { startsAt, endsAt, finishAfter, daysLeft, livedDays, progress, returnLeft }
}

const dayMs = 86_400_000

function parseDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayMs)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function splitDuration(ms: number) {
  const totalMs = Math.max(0, ms)
  const days = Math.floor(totalMs / dayMs)
  const hours = Math.floor((totalMs % dayMs) / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  return { totalMs, days, hours, minutes }
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function formatDate(date: Date) {
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`
}

function isChromeLessScreen(id: ScreenId) {
  return id === 'role' || id === 't02' || id === 't09' || id === 'l06'
}

function ChevronLeftIcon() { return <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg> }
function ShieldIcon() { return <svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.5-2.9 8.4-7 10-4.1-1.6-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-5" /></svg> }
function CheckIcon() { return <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg> }
function LockIcon() { return <svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2" /><rect x="5" y="10" width="14" height="11" rx="2" /></svg> }
function UserIcon() { return <svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg> }
function KeyIcon() { return <svg viewBox="0 0 24 24"><circle cx="7.5" cy="14.5" r="4.5" /><path d="M11 11 21 1M16 6l2 2M14 8l2 2" /></svg> }
function ReceiptIcon() { return <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h4" /></svg> }
function HomeIcon() { return <svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /></svg> }
function ChartIcon() { return <svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16" /><path d="M8 16v-5M12 16V8M16 16v-8" /></svg> }
function WalletIcon() { return <svg viewBox="0 0 24 24"><path d="M4 7h16v12H4z" /><path d="M4 7l3-4h13v4" /><path d="M17 13h.01" /></svg> }
function HistoryIcon() { return <svg viewBox="0 0 24 24"><path d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z" /><path d="M10 9h6M10 13h6" /></svg> }
function AlertIcon() { return <svg viewBox="0 0 24 24"><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5M12 18h.01" /></svg> }

export default App
