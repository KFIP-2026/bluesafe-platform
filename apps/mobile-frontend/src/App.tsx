import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import './App.css'
import { backendConfig, bluesafeApi, type BackendContract, type DisputeCase, type EvidenceFile, type SettlementRecord } from './api/bluesafe'
import { connectInternalWallet } from './api/internalWallet'
import reputationMascot from './assets/reputation-mascot.png'

type ScreenId =
  | 't01' | 'role' | 'wallet' | 't02' | 't03' | 't04' | 't05' | 't06' | 't07' | 't08' | 't09' | 't10'
  | 't11' | 't12' | 't13' | 't14' | 't15' | 't16' | 't17' | 't18' | 't19' | 't20'
  | 'l01' | 'l02' | 'l03' | 'l04' | 'l05' | 'l06' | 'l07' | 'l08' | 'l09' | 'l10'
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
  evidence?: EvidenceFile
  dispute?: DisputeCase
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
  landlordAcceptDispute: () => Promise<void>
  landlordApproveSettlement: () => Promise<void>
  uploadEvidence: (input: {
    category: 'contract_pdf' | 'utility_bill' | 'photo' | 'receipt' | 'other'
    fileName: string
    file?: Blob
    content?: string
  }) => Promise<EvidenceFile>
  createUtilityDispute: (file?: File) => Promise<void>
  acceptDispute: () => Promise<void>
}

const deposit = 15_000_000
const rent = 680_000
const maintenance = 70_000
const tenantScreens: ScreenDef[] = [
  { id: 't01', label: '시작', group: '임차인', component: T01Entry },
  { id: 'role', label: '역할 선택', group: '임차인', component: RoleSelect },
  { id: 't02', label: '온보딩', group: '임차인', component: T02Onboarding },
  { id: 't03', label: '토스 인증', group: '임차인', component: T03Auth },
  { id: 't04', label: 'ARC KYC', group: '임차인', component: T04Kyc },
  { id: 't05', label: '임대인 초대', group: '임차인', component: T05Invite },
  { id: 't06', label: '3자 계약서', group: '임차인', component: T06Contract },
  { id: 't07', label: '보증금 송금', group: '임차인', component: T07Pay },
  { id: 't08', label: '영수증', group: '임차인', component: T08Receipt },
  { id: 't09', label: '홈', group: '임차인', tab: 'tenant', component: T09Home },
  { id: 't10', label: '자동 반환', group: '임차인', component: T10Countdown },
  { id: 't11', label: '안전 리포트', group: '임차인', component: T11Report },
  { id: 't12', label: '평판', group: '임차인', component: T12Reputation },
  { id: 't13', label: '공과금', group: '임차인', tab: 'tenant', component: T13Bills },
  { id: 't14', label: '이의제기', group: '임차인', component: T14Dispute },
  { id: 't15', label: '분쟁 진행', group: '임차인', component: T15DisputeStatus },
  { id: 't16', label: '분쟁 결과', group: '임차인', component: T16DisputeResult },
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
  { id: 'l09', label: '분쟁 수신', group: '임대인', component: L09IncomingDispute },
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

        const xrplContract = await bluesafeApi.createXrplContract({
          tenantAddress: app.tenantAddress,
          landlordAddress: app.landlordAddress,
          depositAmount: '17647000000',
          stakeAmount: '1000000',
          startsAt: '2026-06-01T00:00:00.000Z',
          endsAt: '2027-05-31T00:00:00.000Z',
          finishAfter: '2027-06-07T00:00:00.000Z',
          cancelAfter: '2027-06-30T00:00:00.000Z',
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
    landlordAcceptDispute: async () => {
      await run('BE2 임대인 환불 판정', async () => {
        if (!backendConfig.hasBe2) throw new Error('BE2 URL is not configured')
        if (!app.dispute) throw new Error('No dispute exists in backend state')
        const dispute = await bluesafeApi.decideDispute(app.dispute.id, 'partial_manual', 'Landlord accepted partial refund')
        setApp((prev) => ({ ...prev, dispute }))
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
    uploadEvidence: async (input) => {
      return run('BE2 증빙 업로드', async () => {
        const contract = app.contract ?? await actions.createDraftContract()
        if (!backendConfig.hasBe2) throw new Error('BE2 URL is not configured')
        const evidence = await bluesafeApi.uploadEvidence({
          contractId: contract.id,
          category: input.category,
          uploaderId: app.tenantId,
          fileName: input.fileName,
          file: input.file,
          content: input.content,
          retentionDays: 365,
        })
        setApp((prev) => ({ ...prev, evidence }))
        return evidence
      })
    },
    createUtilityDispute: async (file?: File) => {
      await run('BE2 증빙 업로드 + 분쟁 접수', async () => {
        const contract = app.contract ?? await actions.createDraftContract()
        const evidence = await actions.uploadEvidence({
          category: 'utility_bill',
          fileName: file?.name ?? 'august-gas-bill.txt',
          file,
          content: 'August gas bill 31,000 KRW, average 25,000 KRW, suspected leak.',
        })
        if (!backendConfig.hasBe2) throw new Error('BE2 URL is not configured')
        const dispute = await bluesafeApi.createDispute({
          contractId: contract.id,
          raisedBy: 'tenant',
          reasonCode: 'UTILITY_OVER_AVERAGE',
          evidenceIds: [evidence.id],
        })
        setApp((prev) => ({ ...prev, evidence, dispute }))
      })
    },
    acceptDispute: async () => {
      const currentDispute = app.dispute
      if (!currentDispute) return
      await run('BE2 분쟁 판정 기록', async () => {
        if (!backendConfig.hasBe2) throw new Error('BE2 URL is not configured')
        const dispute = await bluesafeApi.decideDispute(currentDispute.id, 'partial_manual', 'Dispute accepted')
        setApp((prev) => ({ ...prev, dispute }))
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
        <div className="entry-bottom role-bottom"><button className="white-cta" onClick={start}>시작하기</button><span>{role === 'tenant' ? '임차인 보호 플로우로 시작' : '임대인 계약 플로우로 시작'}</span></div>
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
      desc: '평년보다 높은 청구는\n근거와 함께 이의제기할 수 있어요.',
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

function T06Contract({ next, actions, busy, error }: NavProps) {
  const [open, setOpen] = useState(false)
  const signContract = async () => {
    try {
      await actions.createDraftContract()
      await actions.uploadEvidence({
        category: 'contract_pdf',
        fileName: 'bluesafe-trust-lease.txt',
        content: 'BLUESAFE TRUST LEASE v1 signed by tenant, landlord, and BlueSafe.',
      })
      setOpen(true)
    } catch {
      return
    }
  }
  return (
    <Page>
      <Hero eyebrow="검토 중" title="3자 안심 계약서" desc="집주인·BlueSafe·임차인 모두가 서명해요" />
      <Card tone="soft">
        <p className="doc-label">BLUESAFE TRUST LEASE · v1</p>
        <Info label="주소" value="서울시 마포구 망원동 12-3, 302호" />
        <Info label="계약 기간" value="2026.06.01 — 2027.05.31" />
        <Info label="월세" value={krw(rent)} />
        <Info label="보증금" value={krw(deposit)} strong />
        <Info label="관리비" value="월 70,000원 (수도·인터넷 포함)" />
      </Card>
      <SectionTitle>안심 조항 3가지</SectionTitle>
      <ListItem icon="§1" title="보증금은 XRPL 에스크로에 잠겨요" desc="계약 기간엔 양쪽 모두 못 꺼내요" />
      <ListItem icon="§2" title="퇴실 후 7일 이내 자동 반환돼요" desc="집주인 응답이 없어도 풀려요" />
      <ListItem icon="§3" title="분쟁 시 BlueSafe 패널이 판정해요" desc="평균 처리 4.2일" />
      <label className="agree-row"><input type="checkbox" defaultChecked /> 전체 약관에 동의해요</label>
      <BackendInline error={error} />
      <BottomCTA label={busy ? '계약 저장 중' : '서명하고 계속'} onClick={signContract} />
      <ActionModal open={open} title="계약서 증빙 저장" onClose={() => setOpen(false)} primaryLabel="계속" onPrimary={next}>
        <p>계약 draft를 만들고 계약서 증빙을 BE2 Evidence Vault에 연결하는 흐름이에요.</p>
      </ActionModal>
    </Page>
  )
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
        <div className="quick-grid"><button>리포트</button><button onClick={() => go('t13')}>공과금</button><button onClick={() => go('t10')}>반환</button><button>계약서</button></div>
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

function T11Report() {
  return (
    <Page>
      <Hero title="8월 안전 리포트" desc="2026.08 · BlueSafe Trust" />
      <div className="report-summary">
        <div className="score-card"><span>안전 점수</span><strong>97</strong><p>/ 100</p></div>
        <div className="score-delta"><span>지난달보다</span><strong>+3 ↑</strong><p>좋아졌어요</p></div>
      </div>
      <SectionTitle>항목별 점수</SectionTitle>
      <InfoList rows={[['월세 정시 납부', '6/6'], ['공과금 적정성', '평균 대비 +12%'], ['집주인 응답성', '평균 4시간'], ['문서 보관', '모두 완료']]} />
    </Page>
  )
}

function T12Reputation({ next, app }: NavProps) {
  const hasContract = Boolean(app.contract || app.xrplContract)
  const hasEvidence = Boolean(app.evidence)
  const hasDispute = Boolean(app.dispute)

  return (
    <Page>
      <Hero title="평판 데이터" desc="목업 등급 대신 실제 계약·증빙·분쟁 응답으로 계산할 준비만 해두었어요" />
      <Card tone="soft">
        <strong>아직 평판 등급이 없어요</strong>
        <span>점수와 등급은 백엔드 평판 계산 API가 붙은 뒤에만 표시해요.</span>
      </Card>
      <SectionTitle>계산에 필요한 신호</SectionTitle>
      <ListItem icon={<ReceiptIcon />} title="계약 이력" desc={hasContract ? '계약 응답이 있어요' : 'BE2 계약 응답 없음'} action={hasContract ? '확인' : '대기'} />
      <ListItem icon={<ShieldIcon />} title="에스크로 이력" desc={app.xrplContract ? 'BE1 에스크로 응답이 있어요' : 'BE1 에스크로 응답 없음'} action={app.xrplContract ? '확인' : '대기'} />
      <ListItem icon={<CheckIcon />} title="증빙 이력" desc={hasEvidence ? '증빙이 연결됐어요' : '증빙 없음'} action={hasEvidence ? '확인' : '대기'} />
      <ListItem icon={<AlertIcon />} title="분쟁 이력" desc={hasDispute ? app.dispute?.status ?? '분쟁 응답 있음' : '분쟁 응답 없음'} action={hasDispute ? '확인' : '없음'} />
      <BottomCTA label="홈으로" secondary="공유 준비 중" onClick={next} />
    </Page>
  )
}
function T13Bills({ go, app }: NavProps) {
  const hasEvidence = Boolean(app.evidence)
  const hasDispute = Boolean(app.dispute)
  return (
    <Page bottomNav>
      <Hero title="공과금 확인" desc="목업 청구액 대신 BE2 증빙과 dispute 상태만 표시해요" />
      <div className="total-bill">
        <span>증빙 상태</span>
        <strong>{hasEvidence ? '증빙 등록됨' : '증빙 없음'}</strong>
        <p>{hasEvidence ? 'evidence: ' + app.evidence?.id : '아직 백엔드에 등록된 공과금 증빙이 없어요.'}</p>
      </div>
      <SectionTitle>연동 항목</SectionTitle>
      <ListItem icon={<ReceiptIcon />} title="공과금 증빙" desc={hasEvidence ? app.evidence?.category ?? '카테고리 응답 없음' : '업로드된 증빙 없음'} action={hasEvidence ? '등록' : '대기'} />
      <ListItem icon={<AlertIcon />} title="Dispute 상태" desc={hasDispute ? app.dispute?.reasonCode : 'BE2 dispute 응답 없음'} action={hasDispute ? app.dispute?.status : '대기'} />
      <Card tone={hasEvidence || hasDispute ? 'blue' : 'soft'}>
        <strong>{hasEvidence || hasDispute ? '백엔드 응답을 불러왔어요' : '실제 데이터가 필요해요'}</strong>
        <span>청구액과 항목별 금액은 OCR 또는 BE2 API 응답이 생긴 뒤 표시하는 흐름이 맞아요.</span>
      </Card>
      <BottomCTA label={hasEvidence ? '확인' : '증빙 업로드로 이동'} secondary="나중에" onClick={() => go(hasEvidence ? 't09' : 't14')} />
    </Page>
  )
}

function T14Dispute({ next, actions, busy, error }: NavProps) {
  const [file, setFile] = useState<File>()
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return
    setFile(selected)
  }

  return (
    <Page>
      <Hero title="공과금 증빙 업로드" desc="금액은 목업으로 넣지 않고, 실제 BE2 evidence 응답만 표시해요" />
      <SectionTitle>증빙 파일</SectionTitle>
      <input className="hidden-input" id="utility-evidence-file" type="file" accept="image/png,image/jpeg,application/pdf" onChange={onFile} />
      <div className="photo-grid evidence-grid">
        <div>{file ? file.name : '선택된 파일 없음'}</div>
        <div />
        <button onClick={() => document.getElementById('utility-evidence-file')?.click()}>+</button>
      </div>
      <Card tone="soft">
        <strong>업로드 후 표시되는 값</strong>
        <span>BE2 evidence ID, category, CID가 응답으로 돌아오면 공과금 화면에 연결돼요.</span>
      </Card>
      <BackendInline error={error} />
      <BottomCTA label={busy ? '증빙 업로드 중' : '증빙 업로드'} secondary="취소" onClick={async () => { try { await actions.uploadEvidence({ category: 'utility_bill', fileName: file?.name ?? 'utility-bill', file, content: 'utility bill evidence uploaded from frontend' }); next() } catch { return } }} />
    </Page>
  )
}
function T15DisputeStatus({ app }: NavProps) {
  return (
    <Page>
      <Hero eyebrow="진행 중" title={'분쟁이\n진행 중이에요'} desc="평균 4.2일 안에 결과가 나와요" />
      <StepperHeader current={1} />
      <BackendInline label={`BE2 dispute: ${app.dispute?.id ?? 'not submitted yet'} · ${app.dispute?.status ?? 'local'}`} />
      <Timeline items={['이의 제기 접수|09.04 · 14:32', '집주인에게 알림|09.04 · 14:32', 'BlueSafe 패널 검토 중|진행 중', '판정 + 환불|예상 09.08']} />
      <Card tone="blue"><strong>걱정하지 마세요</strong><span>결과가 나올 때까지 차액(6,000원)이 자동으로 보류돼요. 부담 없이 기다려요.</span></Card>
    </Page>
  )
}

function T16DisputeResult({ next, actions, busy, error }: NavProps) {
  return (
    <Page>
      <Hero title={'이의 제기가\n인정됐어요'} desc="환불이 토스 계좌에 들어왔어요" />
      <Card><Info label="환불 금액" value={krw(6_000)} strong /><Info label="판정" value="임차인 인정" /><Info label="근거" value="계량기 수치 + 평년 비교" /><Info label="입금 시점" value="오늘 16:18" /></Card>
      <Card tone="soft"><span>“계량기 수치를 비교한 결과 평년 대비 12% 초과 사용이 확인되지 않았어요. 차액 6,000원을 임차인에게 돌려드려요.” — BlueSafe Panel</span></Card>
      <BackendInline error={error} />
      <BottomCTA label={busy ? '판정 기록 중' : '확인'} onClick={async () => { try { await actions.acceptDispute(); next() } catch { return } }} />
    </Page>
  )
}

function T17Moveout({ next }: NavProps) {
  return (
    <Page>
      <Hero title="퇴실 체크리스트" desc="4가지를 마치면 자동 반환이 시작돼요" />
      <ListItem icon={<CheckIcon />} title="집 상태 사진 찍기" desc="거실·주방·욕실·방" action="완료" />
      <ListItem icon={<CheckIcon />} title="공과금 정산" desc="8월분까지 완료" action="완료" />
      <ListItem icon={<CheckIcon />} title="열쇠 반납 확인" desc="카카오톡 답변 받음" action="완료" />
      <ListItem icon="4" title="집주인 최종 확인 요청" desc="아직" action="필요" />
      <Card tone="blue"><strong>체크 끝나면 어떻게 돼요?</strong><span>집주인이 7일 동안 이의제기를 안 하면 자동으로 보증금이 풀려요.</span></Card>
      <BottomCTA label="집주인 확인 요청" onClick={next} />
    </Page>
  )
}

function T18Returned({ next }: NavProps) {
  return (
    <Page>
      <div className="success-block"><div className="success-icon"><CheckIcon /></div><h1>보증금이 돌아왔어요</h1><strong className="big-money">{krw(deposit)}</strong><p>토스뱅크 ••• 8821로 입금됐어요</p></div>
      <Card><p className="doc-label">SETTLEMENT</p><Info label="원래 보증금" value={krw(deposit)} /><Info label="이의제기 환불" value={`+${krw(6_000)}`} /><Info label="청소 차감" value={`−${krw(50_000)}`} /><Info label="최종 입금" value={krw(14_956_000)} strong /></Card>
      <BottomCTA label="본국으로 송금" secondary="영수증" onClick={next} />
    </Page>
  )
}

function T19Fx({ next }: NavProps) {
  return (
    <Page>
      <Hero eyebrow="저렴한 환율" title={'본국으로\n송금하기'} />
      <Card tone="soft"><Info label="보낼 금액" value={krw(14_956_000)} strong /><Info label="받는 금액 (USD)" value="$11,150.45" strong /><p className="notice inside">1 USD = 1,341.30 KRW · XRPL 브릿지 사용</p></Card>
      <SectionTitle>받는 사람</SectionTitle><ListItem icon={<UserIcon />} title="John Park" desc="Bank of America · ••• 4421" action="USA" /><ListItem icon={<PlusIcon />} title="다른 받는 사람 추가" />
      <Card tone="blue"><strong>시중 은행 대비 절약</strong><span>+ ₩42,300</span></Card>
      <BottomCTA label="확인하고 송금" onClick={next} />
    </Page>
  )
}

function T20Activity({ next, app }: NavProps) {
  const rows: string[][] = []
  const today = formatDate(new Date()).slice(5).replace('-', '.')

  if (app.tenantAddress) rows.push(['실시간 상태', today, '임차인 지갑 생성', shortHash(app.tenantAddress), 'XRPL'])
  if (app.landlordAddress) rows.push(['', today, '임대인 지갑 생성', shortHash(app.landlordAddress), 'XRPL'])
  if (app.contract) rows.push(['', today, 'BE2 계약 응답', app.contract.id, app.contract.status])
  if (app.xrplContract) rows.push(['', today, 'BE1 에스크로 응답', app.xrplContract.id, app.xrplContract.status])
  if (app.xrplContract?.depositEscrowTxHash) rows.push(['', today, 'XRPL TX 생성', shortHash(app.xrplContract.depositEscrowTxHash), '온체인'])
  if (app.evidence) rows.push(['', today, '증빙 업로드', app.evidence.id, app.evidence.category ?? 'evidence'])
  if (app.dispute) rows.push(['', today, 'Dispute 상태', app.dispute.reasonCode, app.dispute.status])
  app.settlements.forEach((settlement, index) => {
    rows.push([index === 0 ? '정산 응답' : '', today, '정산 상태', settlement.id, settlement.status])
  })
  app.backendEvents.slice().reverse().forEach((event, index) => {
    rows.push([index === 0 && rows.length === 0 ? '연동 로그' : '', today, event, '프론트 실행 기록', ''])
  })

  return (
    <Page bottomNav>
      <Hero title="활동 내역" desc="가짜 거래내역 대신 실제 연동 응답과 실행 로그만 보여요" />
      <div className="chip-wrap compact"><span className="chip selected">전체</span><span className="chip">지갑</span><span className="chip">계약</span><span className="chip">증빙</span></div>
      {rows.length > 0 ? <ActivityRows rows={rows} /> : <Card tone="soft"><strong>아직 활동 내역이 없어요</strong><span>지갑 생성, 계약 생성, 증빙 업로드가 성공하면 여기에 표시돼요.</span></Card>}
      <BottomCTA label="임대인 화면 보기" onClick={next} />
    </Page>
  )
}
function L01Invited({ next }: NavProps) {
  return (
    <Page>
      <div className="home-head"><span>BlueSafe</span></div>
      <Hero title={'안심 임대로\n시작해 볼래요?'} desc="망원동 12-3, 302호 보증금 1,500만원" />
      <ListItem icon={<ShieldIcon />} title="먹튀 걱정 없는 임차인" desc="월세 미납 시 BlueSafe가 잠긴 보증금에서 우선 차감해서 송금해요." />
      <ListItem icon={<WalletIcon />} title="월세 자동 정산" desc="매달 1일 자동으로 토스 계좌에 들어와요. 챙길 필요 없어요." />
      <ListItem icon={<ReceiptIcon />} title="깨끗한 거래 기록" desc="입출금·계약·정산이 한 화면. 종소세 신고 자료까지." />
      <BottomCTA label="계약서 보기" secondary="나중에" onClick={next} />
    </Page>
  )
}

function L02Verify({ next }: NavProps) {
  const [open, setOpen] = useState(false)
  return <Page><StepperHeader current={0} /><Hero title={'임대인\n인증 종류'} desc="월세 받을 명의를 선택해요" /><ListItem icon="개인" title="개인" desc="주민등록증 본인 명의" /><ListItem icon="사업" title="개인사업자" desc="사업자등록증 + 본인 명의" /><ListItem icon="법인" title="법인" desc="법인 인감 + 대표자 인증" /><p className="notice">월세 수령 계좌는 본인 명의여야 해요. BlueSafe가 자동으로 검증해요.</p><BottomCTA label="토스로 인증하기" onClick={() => setOpen(true)} /><ActionModal open={open} title="임대인 인증 준비 완료" onClose={() => setOpen(false)} primaryLabel="다음" onPrimary={next}><p>실제 Toss/OIDC 토큰이 연결되면 BE2 요청의 landlord role 토큰으로 사용해요.</p><Info label="role" value="landlord" /><Info label="auth" value="ready" /></ActionModal></Page>
}

function L03Property({ next }: NavProps) {
  return <Page><Hero title="매물 정보" desc="계약서가 자동으로 채워져요" /><div className="photo-banner">[ 매물 사진 4장 ]<span>1/4</span></div><Card tone="soft"><Info label="주소" value="서울시 마포구 망원동 12-3, 302호" /><Info label="면적" value="32㎡ (9.7평)" /><Info label="구조" value="원룸 · 풀옵션" /><Info label="월세" value={`${krw(rent)} / 월`} /><Info label="보증금" value={krw(deposit)} strong /><Info label="관리비" value={`${krw(maintenance)} / 월`} /><Info label="입주 가능일" value="2026.06.01" /></Card><BottomCTA label="계약서 자동 작성" onClick={next} /></Page>
}

function L04Review({ next, actions, busy, error }: NavProps) {
  const [open, setOpen] = useState(false)
  const sign = async () => {
    try {
      await actions.landlordSignContract()
      setOpen(true)
    } catch {
      return
    }
  }
  return <Page><Hero eyebrow="검토 중" title="계약서 확인" desc="필요하면 임차인에게 수정 요청을 보낼 수 있어요" /><Card tone="soft"><p className="doc-label">BLUESAFE TRUST LEASE v1</p><Info label="임차인" value="Sarah Kim" /><Info label="국적" value="USA · F-2" /><Info label="계약 기간" value="12 mo" /><Info label="월세" value={krw(rent)} /><Info label="보증금" value={krw(deposit)} strong /><Info label="입주" value="2026.06.01" /></Card><SectionTitle>집주인 보호 조항</SectionTitle><ListItem icon={<WalletIcon />} title="월세 미납 시 자동 차감" desc="잠긴 보증금에서 월세분 우선 송금" /><ListItem icon={<ReceiptIcon />} title="원상복구 청구" desc="퇴실 시 손상분 차감 가능" /><ListItem icon={<ClockIcon />} title="조기 해지 페널티" desc="6개월 미만 — 1개월분" /><BackendInline error={error} /><BottomCTA label={busy ? '서명 저장 중' : '동의하고 서명'} secondary="수정 요청" onClick={sign} /><ActionModal open={open} title="계약 동의 저장 완료" onClose={() => setOpen(false)} primaryLabel="계속" onPrimary={next}><p>BE2 계약 상태를 다음 단계로 업데이트했어요. 이후 임차인의 안전 송금이 완료되면 escrow anchor가 연결됩니다.</p></ActionModal></Page>
}

function L05Signed({ next }: NavProps) {
  return <Page><div className="success-block"><div className="success-icon"><CheckIcon /></div><h1>계약 체결 완료</h1><p>보증금 1,500만원이 안전하게 잠겼어요</p></div><Card><p className="doc-label">NEXT STEPS</p><Info label="06.01" value="첫 월세 자동 정산 · ₩680,000" /><Info label="12.01" value="6개월차 평판 리포트" /><Info label="2027.06.07" value="보증금 정산" /></Card><BottomCTA label="대시보드로" secondary="계약서" onClick={next} /></Page>
}

function L06Home({ go }: NavProps) {
  return (
    <Page bottomNav>
      <div className="home-head"><span>BlueSafe</span></div>
      <Hero title="안녕하세요, 김선생님" />
      <div className="landlord-summary">
        <div className="income-card">
          <span>이번 달 수익</span>
          <strong>2,040,000원</strong>
          <p>받음 204만원 · 예정 68만원</p>
        </div>
        <div className="rent-status-card">
          <span>정산 예정</span>
          <strong>1건</strong>
          <p>내일 입금</p>
        </div>
        <div className="vacancy-card">
          <span>공실</span>
          <strong>1개</strong>
        </div>
        <div className="quick-grid"><button>매물</button><button>월세</button><button onClick={() => go('l11')}>정산</button><button onClick={() => go('l10')}>리포트</button></div>
      </div>
      <div className="home-tasks landlord-properties">
        <SectionTitle right="전체">내 매물 (3)</SectionTitle>
        <ListItem icon="망원" title="망원동 12-3 #302" desc="Sarah K · 보증금 잠김" action={krw(rent)} onClick={() => go('l07')} />
        <ListItem icon="연남" title="연남동 56 #501" desc="공실 · 모집중" action="모집중" />
        <ListItem icon="망원" title="망원동 12-3 #201" desc="Diego R · 미납 1일" action={krw(rent)} onClick={() => go('l08')} />
      </div>
      <BottomSpace />
    </Page>
  )
}

function L07Detail() {
  return <Page><Hero title="망원동 12-3 #302" desc="Sarah Kim · 2026.06.01–2027.05.31" /><div className="property-summary"><div className="deposit-card"><span>잠긴 보증금</span><strong>{won(deposit)}</strong><p>멀티시그로 보관 중</p></div><div className="living-card"><span>거주</span><strong>83일차</strong></div></div><SectionTitle>월세 내역</SectionTitle><ListItem icon="Aug" title="월세 정산" desc="2026.08.01" action={`+${krw(rent)}`} /><ListItem icon="Jul" title="월세 정산" desc="2026.07.01" action={`+${krw(rent)}`} /><ListItem icon="Jun" title="월세 정산" desc="2026.06.01" action={`+${krw(rent)}`} /><SectionTitle>임차인</SectionTitle><ListItem icon="SK" title="Sarah Kim" desc="USA · F-2 · 평판 SBT 인증" action="안전" /></Page>
}

function L08LateRent({ next }: NavProps) {
  return <Page><Hero title={'미납이지만\n돈은 들어왔어요'} desc="먼저 보증금에서 우선 차감해 송금했어요" /><Card tone="yellow"><span>미납 임차인</span><strong>Diego Ramirez</strong><span>망원동 12-3 #201 · 1일 지연</span></Card><Card><Info label="월세 자동 차감 완료" value="₩680,000" strong /><Info label="잠금 잔액" value="₩14,320,000" /><Info label="입금 시각" value="오늘 09:01" /></Card><p className="notice">임차인이 7일 안에 갚으면 잠금 잔액이 원복돼요. 그동안 BlueSafe가 알림과 추심을 진행해요.</p><BottomCTA label="확인" secondary="연락하기" onClick={next} /></Page>
}

function L09IncomingDispute({ next, actions, busy, error }: NavProps) {
  const [open, setOpen] = useState(false)
  const accept = async () => {
    try {
      await actions.landlordAcceptDispute()
      setOpen(true)
    } catch {
      return
    }
  }
  return <Page><Hero eyebrow="응답 필요" title={'임차인이\n이의 제기를 했어요'} desc="4일 안에 답하지 않으면 BlueSafe 패널이 판정해요" /><Card tone="yellow"><strong>대상 청구 · 8월 가스비</strong><span>₩31,000 · +12.5% vs avg</span></Card><Card tone="soft"><strong>임차인 주장</strong><span>“평소엔 25,000원 정도 나오는데 이번에 31,000원 나왔어요. 누수 가능성이 있어요.”</span></Card><SectionTitle>어떻게 할까요?</SectionTitle><ListItem icon={<CheckIcon />} title="인정하고 차액 환불" desc="6,000원이 즉시 임차인에게" /><ListItem icon={<ReceiptIcon />} title="근거 제출하고 반박" desc="검침지·계약서 등 첨부" /><ListItem icon={<ShieldIcon />} title="BlueSafe 패널에 위임" desc="평균 4.2일 소요" /><BackendInline error={error} /><BottomCTA label={busy ? '환불 기록 중' : '인정하고 환불'} onClick={accept} /><ActionModal open={open} title="환불 인정 완료" onClose={() => setOpen(false)} primaryLabel="계속" onPrimary={next}><p>BE2 dispute decision을 기록했어요. 실제 분쟁 ID가 있을 때는 해당 케이스에 판정이 연결됩니다.</p></ActionModal></Page>
}

function L10Earnings({ next }: NavProps) {
  const bars = [42, 48, 52, 58, 64, 72, 78, 86, 74, 68, 61, 55]
  return (
    <Page bottomNav>
      <Hero title="수익 리포트" desc="2026 · YTD" />
      <div className="earnings-summary">
        <div className="earnings-total"><span>누적 수익</span><strong>16,320,000원</strong><p>작년보다 +8.2%</p></div>
        <div className="earnings-mini"><span>월평균</span><strong>204만원</strong></div>
        <div className="earnings-mini"><span>예정</span><strong>68만원</strong></div>
      </div>
      <div className="earnings-chart">{bars.map((height, i) => <span style={{ height }} key={i}><b>{'JFMAMJJASOND'[i]}</b></span>)}</div>
      <SectionTitle>매물별</SectionTitle>
      <ListItem icon={<HomeIcon />} title="망원동 12-3 #302" desc="Sarah Kim · 8mo" action="₩5,440,000" />
      <ListItem icon={<HomeIcon />} title="망원동 12-3 #201" desc="Diego Ramirez · 8mo" action="₩5,440,000" />
      <ListItem icon={<HomeIcon />} title="연남동 56 #501" desc="비어있음 4개월" action="₩5,440,000" />
      <Card tone="blue"><strong>종합소득세 신고용 자료</strong><span>내려받기 →</span></Card>
      <BottomCTA label="정산 화면 보기" onClick={next} />
    </Page>
  )
}

function L11DepositRelease({ next, actions, busy, error }: NavProps) {
  const [open, setOpen] = useState(false)
  const approve = async () => {
    try {
      await actions.landlordApproveSettlement()
      setOpen(true)
    } catch {
      return
    }
  }
  return <Page><Hero eyebrow="응답 필요" title={'퇴실 확인 +\n보증금 정산'} desc="응답 없으면 7일 후 자동 반환돼요" /><Card tone="soft"><Info label="잠긴 보증금" value={krw(deposit)} strong /></Card><SectionTitle>차감 항목</SectionTitle><ListItem icon={<ReceiptIcon />} title="청소 (전문 업체)" desc="영수증 첨부" action="−₩50,000" /><ListItem icon={<ReceiptIcon />} title="벽지 손상" desc="사진 2장" action="−₩0" /><ListItem icon={<ReceiptIcon />} title="가전 분실" desc="없음" action="−₩0" /><Card><Info label="임차인 환불액" value="₩14,950,000" strong /><Info label="내가 받는 차감금" value="₩50,000" /></Card><BackendInline error={error} /><BottomCTA label={busy ? '정산 승인 중' : '동의하고 정산'} secondary="거부" onClick={approve} /><ActionModal open={open} title="정산 승인 완료" onClose={() => setOpen(false)} primaryLabel="계속" onPrimary={next}><p>BE2 settlement 상태를 confirmed로 업데이트했어요. 기존 settlement가 없으면 프론트 로컬 상태로 승인 결과를 보관합니다.</p></ActionModal></Page>
}

function L12Activity() {
  const rows = [['2026 · 8월', '08.01', '월세 정산 — Sarah K', '#302', '+₩680,000'], ['', '08.02', '월세 자동 차감 — Diego R', '보증금에서', '+₩680,000'], ['', '08.04', '이의 환불 — Sarah K', '8월 가스', '−₩6,000'], ['2026 · 7월', '07.01', '월세 정산 — Sarah K', '#302', '+₩680,000'], ['', '07.01', '월세 정산 — Diego R', '#201', '+₩680,000']]
  return <Page bottomNav><Hero title="거래 내역" /><div className="chip-wrap compact"><span className="chip selected">전체</span><span className="chip">월세</span><span className="chip">보증금</span><span className="chip">차감</span></div><ActivityRows rows={rows} /><BottomSpace /></Page>
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

function InfoList({ rows }: { rows: string[][] }) {
  return <Card>{rows.map(([a, b]) => <Info key={a} label={a} value={b} />)}</Card>
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
  if (kind === 'return') {
    return (
      <div className="example-panel">
        <div className="example-calendar">
          <span>자동 반환 예정일</span>
          <strong>2027.06.07</strong>
          <small>응답 없으면 자동 반환</small>
        </div>
        <div className="example-chip">D-236</div>
      </div>
    )
  }

  if (kind === 'bills') {
    return (
      <div className="example-panel list-preview">
        <div><CheckIcon /><span>전기</span><b>정상</b></div>
        <div className="warn"><AlertIcon /><span>가스</span><b>+12.5%</b></div>
        <div><CheckIcon /><span>수도</span><b>정상</b></div>
      </div>
    )
  }

  return (
    <div className="example-panel proof-preview">
      <div>
        <span>XRPL TX</span>
        <strong>F2A8…91D3</strong>
        <small>Explorer에서 직접 확인</small>
      </div>
      <ShieldIcon />
    </div>
  )
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
  return <nav className="bottom-nav four-tabs">{[['t09', '홈', <HomeIcon />], ['t20', '내역', <HistoryIcon />], ['t13', '보호', <ShieldIcon />], ['t12', '내정보', <UserIcon />]].map(([id, label, icon]) => <button key={id as string} className={active === id ? 'active' : ''} onClick={() => go(id as ScreenId)}>{icon}<span>{label as string}</span></button>)}</nav>
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

function won(value: number) {
  return `${value.toLocaleString('ko-KR')}원`
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
function ClockIcon() { return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> }
function ReceiptIcon() { return <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h4" /></svg> }
function HomeIcon() { return <svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /></svg> }
function ChartIcon() { return <svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16" /><path d="M8 16v-5M12 16V8M16 16v-8" /></svg> }
function WalletIcon() { return <svg viewBox="0 0 24 24"><path d="M4 7h16v12H4z" /><path d="M4 7l3-4h13v4" /><path d="M17 13h.01" /></svg> }
function HistoryIcon() { return <svg viewBox="0 0 24 24"><path d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z" /><path d="M10 9h6M10 13h6" /></svg> }
function AlertIcon() { return <svg viewBox="0 0 24 24"><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5M12 18h.01" /></svg> }
function PlusIcon() { return <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg> }

export default App
