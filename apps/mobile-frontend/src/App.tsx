import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import './App.css'
import { backendConfig, bluesafeApi, type BackendContract, type ChainTxReceipt, type ContractStatus, type SettlementRecord } from './api/bluesafe'
import { connectInternalWallet } from './api/internalWallet'
import reputationMascot from './assets/reputation-mascot.png'
import { demoAddresses, demoContractTerms, demoIds, demoIso, enableDemoModeFromUrl, getDemoNow, getDemoSessionId, isDemoMode, isRealDemoTxMode } from './demoMode'

type ScreenId =
  | 't01' | 'role' | 'wallet' | 't02' | 't03' | 't04' | 't05' | 't06' | 't07' | 't08' | 't09' | 't10'
  | 't11' | 't12' | 't13' | 't14' | 't17' | 't18' | 't19' | 't20'
  | 'l01' | 'l02' | 'l03' | 'l04' | 'l05' | 'l06' | 'l07' | 'l08' | 'l10' | 'l11' | 'l12' | 'l13'

type Lang = 'ko' | 'en'
type UserRole = 'tenant' | 'landlord'

type ScreenDef = {
  id: ScreenId
  label: Record<Lang, string>
  group: string
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
  lang: Lang
  setLang: (lang: Lang) => void
}

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
  remittanceAddress: string
  remittanceAmountXrp: string
  contractDraft: ContractDraft
  contract?: BackendContract
  xrplContract?: BackendContract
  settlements: SettlementRecord[]
  chainActions: Partial<Record<ChainActionKey, ChainTxReceipt>>
  backendEvents: string[]
}

type ChainActionKey = 'rentPayment' | 'autoReturn' | 'sbt' | 'remittance'

type ContractDraft = {
  depositAmount: string
  stakeAmount: string
  startsAt: string
  endsAt: string
}

type DemoContractPayload = {
  depositAmount?: string
  stakeAmount?: string
  startsAt?: string
  endsAt?: string
}

type AppActions = {
  selectRole: (role: UserRole) => void
  connectWallet: () => Promise<void>
  connectCounterpartyWallet: () => Promise<void>
  updateContractDraft: (patch: Partial<ContractDraft>) => void
  createDraftContract: () => Promise<BackendContract>
  lockDeposit: () => Promise<void>
  loadSettlements: () => Promise<void>
  landlordSignContract: () => Promise<void>
  landlordApproveSettlement: () => Promise<void>
  runRentPayment: () => Promise<ChainTxReceipt>
  finishEscrow: () => Promise<ChainTxReceipt>
  mintSbt: () => Promise<ChainTxReceipt>
  updateRemittanceAddress: (address: string) => void
  updateRemittanceAmount: (amountXrp: string) => void
  runRemittance: (destinationAddress: string, amountXrp: string) => Promise<ChainTxReceipt>
}

type TimelineItem = {
  title: string
  desc: string
  state?: 'done' | 'pending' | 'blocked'
}

const ko = {
  start: '시작하기',
  next: '다음',
  continue: '계속하기',
  later: '나중에',
  confirm: '확인',
  home: '홈',
  history: '내역',
  contract: '계약',
  profile: '내정보',
  settings: '설정',
  language: '언어',
  korean: '한국어',
  english: 'English',
  revenue: '수익',
  all: '전체',
  waiting: '대기 중',
  complete: '완료',
  responseNone: '응답 없음',
  responseWaiting: '응답 대기',
  contractWaiting: '계약 응답 대기',
  walletNeeded: '지갑 연결 필요',
  entryTitle: '보증금 걱정\n더이상 하지마세요',
  entryDesc: '블루세이프가 지켜드릴게요.\n토스 인증으로 30초만에 시작해요.',
  multisig: '멀티시그',
  autoReturn: '자동반환',
  remittance: '국제송금',
  entryFoot: '토스 인증으로 30초 만에 가입',
  roleTitle: '어떤 계약으로\n시작할까요',
  roleDesc: '역할에 맞는 화면으로 안내할게요.',
  tenant: '임차인',
  landlord: '임대인',
  tenantRoleTitle: '보증금을 안전하게 맡길래요',
  tenantRoleDesc: '계약 확인, 보증금 락업, 자동 반환',
  landlordRoleTitle: '계약과 정산을 관리할래요',
  landlordRoleDesc: '계약 확인, 월세 정산, 반환 승인',
  tenantFlow: '임차인 계약 플로우로 시작',
  landlordFlow: '임대인 계약 플로우로 시작',
  walletTitle: 'BlueSafe 지갑을\n준비해요',
  walletTenantDesc: '보증금을 안전하게 보관할 내부 XRPL 지갑이에요.',
  walletLandlordDesc: '계약과 정산을 확인할 내부 XRPL 지갑이에요.',
  walletConnected: '연결 완료',
  walletPending: '연결 대기',
  walletCreate: '내부 XRPL 지갑을 생성해주세요',
  walletConnect: '내 지갑 만들기',
  walletConnecting: '준비 중',
  walletServer: 'BlueSafe 서버가 지갑을 만들고 주소만 앱에 연결해요.',
  walletCustody: '서버 보관',
  walletPoint1: '멀티시그 보관',
  walletPoint2: '온체인 영수증',
  walletPoint3: '자동 반환 추적',
  onboarding1Title: '보증금이\n에스크로에 잠겨요',
  onboarding1Desc: '계약 기간 동안 임대인도, 임차인도\n중간에 꺼낼 수 없어요.',
  onboarding2Title: '퇴실 후\n자동으로 돌아와요',
  onboarding2Desc: '집주인이 응답하지 않아도\n7일 후 보증금이 자동 반환돼요.',
  onboarding3Title: '공과금 흐름은\n현재 제외했어요',
  onboarding3Desc: '이번 제품 빌드는 계약, 지갑, 에스크로,\n정산 플로우에 집중해요.',
  onboarding4Title: '모든 기록은\n직접 확인할 수 있어요',
  onboarding4Desc: '보증금 락업과 반환 기록은\nXRPL 응답이 있을 때 표시돼요.',
  skip: '건너뛰기',
  authTitle: '토스로\n간편하게 인증하기',
  authDesc: '본인 확인을 위해 한 번만 거치면 돼요.',
  authSafe: '안전한 본인확인',
  authSafeDesc: '계약 생성을 위한 최소 정보만 사용해요.',
  authInfo: 'BlueSafe가 받아오는 정보',
  nameBirth: '이름·생년월일',
  nameBirthDesc: '계약서 자동 채우기에 사용',
  regNumber: '외국인등록번호',
  regNumberDesc: 'KYC 1단계 통과',
  ownerAccount: '본인 명의 계좌',
  ownerAccountDesc: '보증금 입출금 검증',
  authNotice: '인증 정보는 암호화되어 보관돼요.',
  tossAuth: '토스로 인증하기',
  terms: '약관 보기',
  authDone: '인증 준비 완료',
  kycTitle: '외국인 등록증을\n업로드해요',
  kycDesc: '여기에 카드를 맞춰요',
  checklist: '확인 항목',
  kyc1: '카드 전체가 프레임에 들어왔는지',
  kyc2: '글자가 흐릿하지 않은지',
  kyc3: '뒷면 칩이 보이지 않는지',
  takePhoto: '촬영하기',
  inviteTitle: '집주인을\n초대해요',
  inviteDesc: '카카오·문자 어디로든 보낼 수 있어요.',
  inviteLink: '초대 링크',
  copy: '복사',
  kakao: '카카오톡',
  sms: '문자',
  landlordTodo: '집주인이 할 일',
  inviteStep1: '링크 클릭 → 인증',
  inviteStep1Desc: '같은 BlueSafe 화면이 열려요',
  inviteStep2: '계약서 확인 + 서명',
  inviteStep2Desc: '백엔드 계약 응답 기준',
  inviteStep3: '보증금 받을 계좌 등록',
  inviteStep3Desc: '본인 명의만 가능',
  sendKakao: '카카오톡으로 보내기',
  review: '검토 중',
  contractTitle: '3자 안심 계약서',
  contractDesc: '집주인·BlueSafe·임차인 모두가 서명해요.',
  contractId: '계약 ID',
  status: '상태',
  period: '계약 기간',
  deposit: '보증금',
  depositAmount: '보증금 금액',
  stake: '락업 수량',
  contractTerms: '계약 조건',
  contractTermsDesc: 'BE1 에스크로에 보낼 실제 조건을 입력해요.',
  estimatedLockup: '예상 가치',
  autoCalculated: '보증금을 XRPL 기준 가치로 환산해 보여줘요',
  startDate: '시작일',
  endDate: '종료일',
  missingContractTerms: '보증금과 계약 기간을 입력해야 해요',
  connectLandlordWallet: '임대인 지갑 연결',
  connectTenantWallet: '임차인 지갑 연결',
  counterpartyWallet: '상대방 지갑',
  counterpartyReady: '상대방 지갑이 준비됐어요',
  counterpartyNeeded: '상대방 지갑 연결이 필요해요',
  flowReady: '다음 단계 준비 완료',
  tx: 'XRPL TX',
  txKind: 'TX 종류',
  network: '네트워크',
  realTxMode: '실제 XRPL Testnet TX',
  realTxModeDesc: '버튼을 누르면 테스트넷에 EscrowCreate가 제출돼요. 보통 10~30초 걸려요.',
  mockTxMode: '영상용 TX 목업 모드',
  mockTxModeDesc: '현재 URL에 tx=mock이 있어 체인 제출 없이 흐름만 보여줘요.',
  realTxDone: '실제 테스트넷 반영 완료',
  realTxDoneDesc: '검증된 트랜잭션을 XRPL 익스플로러에서 확인할 수 있어요.',
  txNotSubmitted: '제출 안함',
  featureCheck: '체인 기능 체크',
  escrowFeature: '에스크로',
  escrowFeatureDesc: 'BE1 EscrowCreate 제출 경로',
  rentFeature: '월세 송금',
  rentFeatureDesc: '정산 Payment + Memo 서비스',
  sbtFeature: 'SBT',
  sbtFeatureDesc: 'NFTokenMint 평판 증명 서비스',
  autoReturnFeature: '자동 반환',
  autoReturnFeatureDesc: 'EscrowFinish 반환 TX',
  remittanceFeature: '본국 송금',
  remittanceFeatureDesc: 'Payment 송금 TX',
  realTx: '실제 TX',
  serviceReady: '서비스 구현',
  runRentPayment: '월세 송금 실행',
  runningRentPayment: '월세 송금 중',
  rentPaymentDone: '월세 송금 완료',
  runAutoReturn: '자동 반환 실행',
  runningAutoReturn: '반환 실행 중',
  autoReturnDone: '자동 반환 완료',
  mintSbt: '평판 SBT 발행',
  mintingSbt: 'SBT 발행 중',
  sbtMinted: '평판 SBT 발행 완료',
  runRemittance: '본국 송금 실행',
  runningRemittance: '송금 중',
  remittanceDone: '본국 송금 완료',
  txReceipt: 'TX 영수증',
  signContinue: '서명하고 계속',
  createContract: '계약 생성',
  escrowTitle: '안전 송금 금액',
  escrowDesc: '실제 지갑 주소와 백엔드 응답이 준비됐을 때만 실행해요.',
  tenantWallet: '임차인 지갑',
  landlordWallet: '임대인 지갑',
  internalWallet: '내부 XRPL 지갑',
  walletBothReady: '양쪽 주소가 준비됐어요',
  walletBothNeeded: '임차인과 임대인 지갑 주소가 모두 필요해요',
  createEscrow: 'XRPL 에스크로 생성',
  creatingEscrow: '에스크로 생성 중',
  receiptTitle: '보증금이 잠겼어요',
  receiptDesc: '백엔드와 XRPL 응답으로 확인된 정보만 표시해요.',
  onchainReceipt: '온체인 영수증',
  explorer: '익스플로러로 보기',
  share: '공유',
  backendStatus: '연동 상태',
  homeDeposit: '현재 보증금',
  safeMultisig: '멀티시그로 안전하게 보관해요',
  daysLeft: '일 남음',
  untilExpiry: '계약 만료까지',
  living: '거주',
  report: '리포트',
  return: '반환',
  todayTodo: '오늘 할 일',
  noTodo: '아직 표시할 일이 없어요',
  noTodoDesc: '지갑, 계약, 에스크로 응답이 생기면 여기에 표시돼요.',
  escrowCreated: 'XRPL 에스크로가 생성됐어요',
  escrowPending: '계약은 생성됐고 에스크로 대기 중이에요',
  backendWaiting: '백엔드 계약 응답을 기다리고 있어요',
  countdownTitle: '자동 반환까지',
  countdownDesc: '집주인이 응답하지 않아도 반환 조건을 확인해요.',
  day: '일',
  hour: '시간',
  minute: '분',
  noAction: '아무것도 안 해도 돼요',
  noActionDesc: '계약 종료 후 정산 응답이 준비되면 반환 절차가 진행돼요.',
  progress: '진행 상황',
  reportTitle: '안전 리포트',
  reportDesc: '실제 계약과 정산 신호만 표시해요.',
  noScore: '아직 점수가 없어요',
  noScoreDesc: '점수 API가 연결되면 점수와 변동폭이 표시돼요.',
  signals: '신호',
  settlement: '정산',
  reputationTitle: '평판이 차올라요',
  reputationDesc: '백엔드 평판 점수 API가 연결되면 등급이 표시돼요.',
  noGrade: '아직 평판 등급이 없어요',
  noGradeDesc: '점수와 등급은 실제 API 응답 이후에만 표시돼요.',
  requiredSignals: '필요한 신호',
  contractHistory: '계약 기록',
  escrowHistory: '에스크로 기록',
  utilityTitle: '공과금',
  utilityDesc: '현재 제품 빌드에서는 비활성화된 플로우예요.',
  utilityDisabled: '공과금 플로우 비활성화',
  utilityDisabledDesc: '계약, 지갑, 에스크로, 정산, 송금 플로우만 활성화되어 있어요.',
  moveoutTitle: '퇴실 체크리스트',
  moveoutDesc: '정산 응답이 있는지만 확인해요.',
  settlementResponse: '정산 응답',
  returnPrep: '반환 준비',
  returnPrepDesc: 'BE2 정산 응답이 생기면 반환 플로우가 표시돼요.',
  checkSettlement: '정산 확인',
  returnedTitle: '보증금이 돌아왔어요',
  returnedDesc: '반환 금액은 실제 정산 응답에서만 표시해요.',
  noReturnData: '반환 데이터가 없어요',
  noReturnDataDesc: 'BE2 정산 응답이 필요해요.',
  prepareRemittance: '송금 준비',
  fxTitle: '본국으로\n송금하기',
  fxDesc: '수취인과 환율 견적은 송금 API 연결 후 표시돼요.',
  settlementFound: '정산 금액 확인',
  noFxData: '송금 데이터가 없어요',
  recipient: '수취인',
  recipientWaiting: '송금 API 응답 없음',
  activityTitle: '활동 내역',
  activityDesc: '지갑, 계약, 에스크로, 정산 이벤트만 표시해요.',
  activityEmpty: '아직 활동 내역이 없어요',
  activityEmptyDesc: '지갑과 계약 이벤트가 성공하면 여기에 표시돼요.',
  walletCreated: '지갑 생성',
  tenantWalletCreated: '임차인 지갑 생성',
  landlordWalletCreated: '임대인 지갑 생성',
  be2ContractResponse: 'BE2 계약 응답',
  be1EscrowResponse: 'BE1 에스크로 응답',
  xrplTxCreated: 'XRPL TX 생성',
  settlementStatus: '정산 상태',
  landlordView: '임대인 화면 보기',
  lStartTitle: '임대인으로 시작하기',
  lStartDesc: '초대 또는 BE2 계약 응답에서 온 데이터만 표시해요.',
  noInvite: '초대 데이터가 없어요',
  inviteNeeded: 'BE2 계약 또는 초대 API 응답이 필요해요.',
  viewContract: '계약서 보기',
  lVerifyTitle: '임대인\n인증 종류',
  lVerifyDesc: '월세 받을 명의를 선택해요.',
  personal: '개인',
  business: '개인사업자',
  corporation: '법인',
  lVerifyNotice: '월세 수령 계좌는 본인 명의여야 해요.',
  propertyTitle: '매물 정보',
  propertyDesc: '주소와 계약 조건은 실제 매물 API 응답이 필요해요.',
  noProperty: '매물 데이터가 없어요',
  propertyNeeded: 'BE2 매물 응답이 필요해요.',
  reviewContract: '계약서 확인',
  reviewContractDesc: '임대인 서명에는 BE2 계약 응답만 사용해요.',
  savingSignature: '서명 저장 중',
  agreeSign: '동의하고 서명',
  requestEdit: '수정 요청',
  agreementSaved: '동의가 저장됐어요',
  agreementSavedDesc: 'BE2 계약 상태가 업데이트됐어요.',
  contractStatusTitle: '계약 상태',
  contractStatusDesc: '고정된 다음 단계 없이 실제 계약 상태만 표시해요.',
  dashboard: '대시보드',
  landlordDashboard: '임대인 대시보드',
  landlordDashboardDesc: '계약과 정산 응답에서 온 운영 데이터만 표시해요.',
  property: '매물',
  rent: '월세',
  contracts: '계약',
  noContractData: '계약 데이터가 없어요',
  noContractDataDesc: 'BE2 계약 응답이 여기에 표시돼요.',
  propertyDetail: '매물 상세',
  propertyDetailDesc: '실제 계약 응답만 표시해요.',
  tenantId: '임차인 ID',
  walletLinked: '지갑 연결됨',
  rentStatus: '월세 상태',
  rentStatusDesc: '미납과 자동 차감은 실제 결제 또는 정산 API 응답이 필요해요.',
  noRentEvent: '월세 이벤트가 없어요',
  earningsReport: '수익 리포트',
  earningsDesc: '고정 YTD 수익 없이 정산 합계만 표시해요.',
  settlementTotal: '정산 합계',
  records: '건',
  byProperty: '매물별',
  noEarnings: '수익 데이터가 없어요',
  noEarningsDesc: '정산 응답이 여기에 표시돼요.',
  viewSettlement: '정산 화면 보기',
  depositSettlement: '보증금 정산',
  depositSettlementDesc: '승인은 실제 정산 응답 기준으로만 처리해요.',
  settlementId: '정산 ID',
  amount: '금액',
  noAmount: '금액 응답 없음',
  approvingSettlement: '정산 승인 중',
  approveSettlement: '정산 승인',
  reject: '거부',
  settlementApproved: '정산 승인 완료',
  transactionHistory: '거래 내역',
  transactionHistoryDesc: '계약과 정산 응답만 표시해요.',
  noTransactionHistory: '거래 내역이 없어요',
  noTransactionHistoryDesc: 'BE2 계약 또는 정산 응답이 여기에 표시돼요.',
}

const en: typeof ko = {
  start: 'Start',
  next: 'Next',
  continue: 'Continue',
  later: 'Later',
  confirm: 'Confirm',
  home: 'Home',
  history: 'History',
  contract: 'Contract',
  profile: 'Profile',
  settings: 'Settings',
  language: 'Language',
  korean: 'Korean',
  english: 'English',
  revenue: 'Revenue',
  all: 'All',
  waiting: 'Waiting',
  complete: 'Complete',
  responseNone: 'No response',
  responseWaiting: 'Waiting for response',
  contractWaiting: 'Waiting for contract',
  walletNeeded: 'Wallet required',
  entryTitle: 'Stop worrying\nabout your deposit',
  entryDesc: 'BlueSafe will protect it for you.\nStart in 30 seconds with Toss verification.',
  multisig: 'Multisig',
  autoReturn: 'Auto return',
  remittance: 'Remittance',
  entryFoot: 'Join in 30 seconds with Toss verification',
  roleTitle: 'Which contract\nare you starting?',
  roleDesc: 'We will guide you through the right flow.',
  tenant: 'Tenant',
  landlord: 'Landlord',
  tenantRoleTitle: 'I want to protect my deposit',
  tenantRoleDesc: 'Contract review, deposit lockup, auto return',
  landlordRoleTitle: 'I want to manage contracts',
  landlordRoleDesc: 'Contract review, rent settlement, return approval',
  tenantFlow: 'Start tenant contract flow',
  landlordFlow: 'Start landlord contract flow',
  walletTitle: 'Prepare your\nBlueSafe wallet',
  walletTenantDesc: 'An internal XRPL wallet for securing your deposit.',
  walletLandlordDesc: 'An internal XRPL wallet for contract and settlement checks.',
  walletConnected: 'Connected',
  walletPending: 'Waiting',
  walletCreate: 'Create your internal XRPL wallet',
  walletConnect: 'Create wallet',
  walletConnecting: 'Preparing',
  walletServer: 'BlueSafe creates the wallet and connects only the address to the app.',
  walletCustody: 'Server custody',
  walletPoint1: 'Multisig custody',
  walletPoint2: 'On-chain receipt',
  walletPoint3: 'Auto-return tracking',
  onboarding1Title: 'Your deposit\nis locked in escrow',
  onboarding1Desc: 'During the contract period, neither side\ncan withdraw it alone.',
  onboarding2Title: 'After move-out,\nit returns automatically',
  onboarding2Desc: 'Even without landlord response,\nthe deposit can return after 7 days.',
  onboarding3Title: 'Utility flow\nis excluded for now',
  onboarding3Desc: 'This build focuses on contract, wallet,\nescrow, and settlement flows.',
  onboarding4Title: 'Every record\ncan be verified',
  onboarding4Desc: 'Deposit lockup and return records appear\nwhen XRPL responses exist.',
  skip: 'Skip',
  authTitle: 'Verify easily\nwith Toss',
  authDesc: 'You only need to verify once.',
  authSafe: 'Secure identity check',
  authSafeDesc: 'Only minimum data for contract creation is used.',
  authInfo: 'Information BlueSafe receives',
  nameBirth: 'Name and birth date',
  nameBirthDesc: 'Used for contract autofill',
  regNumber: 'Alien registration number',
  regNumberDesc: 'Pass KYC level 1',
  ownerAccount: 'Account in your name',
  ownerAccountDesc: 'Verify deposit inflow and outflow',
  authNotice: 'Verification data is stored encrypted.',
  tossAuth: 'Verify with Toss',
  terms: 'View terms',
  authDone: 'Verification is ready',
  kycTitle: 'Upload your\nregistration card',
  kycDesc: 'Align the card here',
  checklist: 'Checklist',
  kyc1: 'The entire card is inside the frame',
  kyc2: 'The text is not blurry',
  kyc3: 'The rear chip is not visible',
  takePhoto: 'Take photo',
  inviteTitle: 'Invite your\nlandlord',
  inviteDesc: 'Send it by KakaoTalk or text.',
  inviteLink: 'Invite link',
  copy: 'Copy',
  kakao: 'KakaoTalk',
  sms: 'SMS',
  landlordTodo: 'What the landlord does',
  inviteStep1: 'Open link and verify',
  inviteStep1Desc: 'The same BlueSafe screen opens',
  inviteStep2: 'Review and sign contract',
  inviteStep2Desc: 'Based on backend contract response',
  inviteStep3: 'Register receiving account',
  inviteStep3Desc: 'Only accounts in their name',
  sendKakao: 'Send via KakaoTalk',
  review: 'Reviewing',
  contractTitle: 'Three-party safe contract',
  contractDesc: 'Landlord, BlueSafe, and tenant all sign.',
  contractId: 'Contract ID',
  status: 'Status',
  period: 'Contract period',
  deposit: 'Deposit',
  depositAmount: 'Deposit amount',
  stake: 'Lockup amount',
  contractTerms: 'Contract terms',
  contractTermsDesc: 'Enter the real terms that will be sent to BE1 escrow.',
  estimatedLockup: 'Estimated value',
  autoCalculated: 'Shown as an XRPL value estimate from the deposit',
  startDate: 'Start date',
  endDate: 'End date',
  missingContractTerms: 'Deposit and contract dates are required',
  connectLandlordWallet: 'Connect landlord wallet',
  connectTenantWallet: 'Connect tenant wallet',
  counterpartyWallet: 'Counterparty wallet',
  counterpartyReady: 'Counterparty wallet is ready',
  counterpartyNeeded: 'Counterparty wallet is required',
  flowReady: 'Ready for the next step',
  tx: 'XRPL TX',
  txKind: 'TX type',
  network: 'Network',
  realTxMode: 'Real XRPL Testnet TX',
  realTxModeDesc: 'The button submits an EscrowCreate to Testnet. It usually takes 10-30 seconds.',
  mockTxMode: 'Video mock TX mode',
  mockTxModeDesc: 'The current URL has tx=mock, so the flow runs without chain submission.',
  realTxDone: 'Real Testnet transaction completed',
  realTxDoneDesc: 'You can verify the validated transaction in the XRPL explorer.',
  txNotSubmitted: 'Not submitted',
  featureCheck: 'Chain feature check',
  escrowFeature: 'Escrow',
  escrowFeatureDesc: 'BE1 EscrowCreate submit path',
  rentFeature: 'Rent payment',
  rentFeatureDesc: 'Settlement Payment + Memo service',
  sbtFeature: 'SBT',
  sbtFeatureDesc: 'NFTokenMint reputation proof service',
  autoReturnFeature: 'Auto return',
  autoReturnFeatureDesc: 'EscrowFinish return TX',
  remittanceFeature: 'Remittance',
  remittanceFeatureDesc: 'Payment remittance TX',
  realTx: 'Real TX',
  serviceReady: 'Service ready',
  runRentPayment: 'Run rent payment',
  runningRentPayment: 'Sending rent',
  rentPaymentDone: 'Rent payment complete',
  runAutoReturn: 'Run auto return',
  runningAutoReturn: 'Returning deposit',
  autoReturnDone: 'Auto return complete',
  mintSbt: 'Mint reputation SBT',
  mintingSbt: 'Minting SBT',
  sbtMinted: 'Reputation SBT minted',
  runRemittance: 'Run remittance',
  runningRemittance: 'Sending remittance',
  remittanceDone: 'Remittance complete',
  txReceipt: 'TX receipt',
  signContinue: 'Sign and continue',
  createContract: 'Create contract',
  escrowTitle: 'Safe transfer amount',
  escrowDesc: 'Runs only when real wallet addresses and backend responses are ready.',
  tenantWallet: 'Tenant wallet',
  landlordWallet: 'Landlord wallet',
  internalWallet: 'Internal XRPL wallet',
  walletBothReady: 'Both addresses are ready',
  walletBothNeeded: 'Tenant and landlord wallet addresses are required',
  createEscrow: 'Create XRPL escrow',
  creatingEscrow: 'Creating escrow',
  receiptTitle: 'Deposit is locked',
  receiptDesc: 'Only backend and XRPL verified data is shown.',
  onchainReceipt: 'On-chain receipt',
  explorer: 'Open explorer',
  share: 'Share',
  backendStatus: 'Integration status',
  homeDeposit: 'Current deposit',
  safeMultisig: 'Stored safely with multisig',
  daysLeft: 'days left',
  untilExpiry: 'Until contract expiry',
  living: 'Living',
  report: 'Report',
  return: 'Return',
  todayTodo: 'Today',
  noTodo: 'Nothing to show yet',
  noTodoDesc: 'Wallet, contract, and escrow responses will appear here.',
  escrowCreated: 'XRPL escrow has been created',
  escrowPending: 'Contract exists and escrow is pending',
  backendWaiting: 'Waiting for backend contract response',
  countdownTitle: 'Until auto return',
  countdownDesc: 'Return conditions are checked even without landlord response.',
  day: 'Day',
  hour: 'Hour',
  minute: 'Min',
  noAction: 'Nothing else to do',
  noActionDesc: 'After contract end, settlement response starts the return process.',
  progress: 'Progress',
  reportTitle: 'Safety report',
  reportDesc: 'Only real contract and settlement signals are shown.',
  noScore: 'No score yet',
  noScoreDesc: 'Score and delta appear after the scoring API is connected.',
  signals: 'Signals',
  settlement: 'Settlement',
  reputationTitle: 'Reputation grows',
  reputationDesc: 'Grades appear after the backend reputation scoring API is connected.',
  noGrade: 'No reputation grade yet',
  noGradeDesc: 'Score and grade appear only after real API responses.',
  requiredSignals: 'Required signals',
  contractHistory: 'Contract history',
  escrowHistory: 'Escrow history',
  utilityTitle: 'Utilities',
  utilityDesc: 'This flow is disabled in the current product build.',
  utilityDisabled: 'Utility flow disabled',
  utilityDisabledDesc: 'Only contract, wallet, escrow, settlement, and remittance flows are active.',
  moveoutTitle: 'Move-out checklist',
  moveoutDesc: 'Only settlement response is checked.',
  settlementResponse: 'Settlement response',
  returnPrep: 'Return preparation',
  returnPrepDesc: 'Deposit return flow appears after BE2 settlement response exists.',
  checkSettlement: 'Check settlement',
  returnedTitle: 'Deposit returned',
  returnedDesc: 'Return amount is shown only from actual settlement response.',
  noReturnData: 'No return data',
  noReturnDataDesc: 'BE2 settlement response is required.',
  prepareRemittance: 'Prepare remittance',
  fxTitle: 'Send money\nhome',
  fxDesc: 'Recipient and FX quote appear after remittance API integration.',
  settlementFound: 'Settlement amount found',
  noFxData: 'No remittance data',
  recipient: 'Recipient',
  recipientWaiting: 'No remittance API response',
  activityTitle: 'Activity history',
  activityDesc: 'Only wallet, contract, escrow, and settlement events are shown.',
  activityEmpty: 'No activity yet',
  activityEmptyDesc: 'Wallet and contract events will appear here after successful calls.',
  walletCreated: 'Wallet created',
  tenantWalletCreated: 'Tenant wallet created',
  landlordWalletCreated: 'Landlord wallet created',
  be2ContractResponse: 'BE2 contract response',
  be1EscrowResponse: 'BE1 escrow response',
  xrplTxCreated: 'XRPL TX created',
  settlementStatus: 'Settlement status',
  landlordView: 'View landlord flow',
  lStartTitle: 'Start as landlord',
  lStartDesc: 'Only invite or BE2 contract response data is shown.',
  noInvite: 'No invite data',
  inviteNeeded: 'BE2 contract or invite API response is required.',
  viewContract: 'View contract',
  lVerifyTitle: 'Landlord\nverification type',
  lVerifyDesc: 'Choose the name that receives rent.',
  personal: 'Individual',
  business: 'Sole proprietor',
  corporation: 'Corporation',
  lVerifyNotice: 'The rent receiving account must be in your name.',
  propertyTitle: 'Property data',
  propertyDesc: 'Address and terms require a real property API response.',
  noProperty: 'No property data',
  propertyNeeded: 'BE2 property response is required.',
  reviewContract: 'Review contract',
  reviewContractDesc: 'Only BE2 contract response is used for landlord signing.',
  savingSignature: 'Saving signature',
  agreeSign: 'Agree and sign',
  requestEdit: 'Request edit',
  agreementSaved: 'Agreement saved',
  agreementSavedDesc: 'BE2 contract status was updated.',
  contractStatusTitle: 'Contract status',
  contractStatusDesc: 'No fixed next steps are shown. Only actual contract state.',
  dashboard: 'Dashboard',
  landlordDashboard: 'Landlord dashboard',
  landlordDashboardDesc: 'Operational data appears only from contract and settlement responses.',
  property: 'Property',
  rent: 'Rent',
  contracts: 'Contracts',
  noContractData: 'No contract data',
  noContractDataDesc: 'BE2 contract response will appear here.',
  propertyDetail: 'Property detail',
  propertyDetailDesc: 'Only actual contract response is shown.',
  tenantId: 'Tenant ID',
  walletLinked: 'Wallet linked',
  rentStatus: 'Rent status',
  rentStatusDesc: 'Late rent and auto-deduction require actual payment or settlement API response.',
  noRentEvent: 'No rent event',
  earningsReport: 'Earnings report',
  earningsDesc: 'No fixed YTD revenue. Only settlement totals are shown.',
  settlementTotal: 'Settlement total',
  records: 'records',
  byProperty: 'By property',
  noEarnings: 'No earnings data',
  noEarningsDesc: 'Settlement response will appear here.',
  viewSettlement: 'View settlement',
  depositSettlement: 'Deposit settlement',
  depositSettlementDesc: 'Approval is based only on actual settlement response.',
  settlementId: 'Settlement ID',
  amount: 'Amount',
  noAmount: 'No amount response',
  approvingSettlement: 'Approving settlement',
  approveSettlement: 'Approve settlement',
  reject: 'Reject',
  settlementApproved: 'Settlement approved',
  transactionHistory: 'Transaction history',
  transactionHistoryDesc: 'Only contract and settlement responses are shown.',
  noTransactionHistory: 'No transaction history',
  noTransactionHistoryDesc: 'BE2 contract or settlement response will appear here.',
}

const copy = { ko, en }

const tenantScreens: ScreenDef[] = [
  { id: 't01', label: { ko: '시작', en: 'Start' }, group: 'tenant', component: T01Entry },
  { id: 'role', label: { ko: '역할 선택', en: 'Choose role' }, group: 'tenant', component: RoleSelect },
  { id: 't02', label: { ko: '온보딩', en: 'Onboarding' }, group: 'tenant', component: T02Onboarding },
  { id: 't03', label: { ko: '토스 인증', en: 'Toss verification' }, group: 'tenant', component: T03Auth },
  { id: 't04', label: { ko: '신분증 업로드', en: 'ID upload' }, group: 'tenant', component: T04Kyc },
  { id: 't05', label: { ko: '임대인 초대', en: 'Invite landlord' }, group: 'tenant', component: T05Invite },
  { id: 't06', label: { ko: '계약', en: 'Contract' }, group: 'tenant', tab: 'tenant', component: T06Contract },
  { id: 't07', label: { ko: '보증금 송금', en: 'Deposit transfer' }, group: 'tenant', component: T07Pay },
  { id: 't08', label: { ko: '영수증', en: 'Receipt' }, group: 'tenant', component: T08Receipt },
  { id: 't09', label: { ko: '홈', en: 'Home' }, group: 'tenant', tab: 'tenant', component: T09Home },
  { id: 't10', label: { ko: '자동 반환', en: 'Auto return' }, group: 'tenant', component: T10Countdown },
  { id: 't11', label: { ko: '안전 리포트', en: 'Safety report' }, group: 'tenant', component: T11Report },
  { id: 't12', label: { ko: '내정보', en: 'Profile' }, group: 'tenant', component: T12Reputation },
  { id: 't13', label: { ko: '공과금', en: 'Utilities' }, group: 'tenant', component: T13Bills },
  { id: 't14', label: { ko: '월세 송금', en: 'Rent payment' }, group: 'tenant', component: T14RentPayment },
  { id: 't17', label: { ko: '퇴실 체크', en: 'Move-out' }, group: 'tenant', component: T17Moveout },
  { id: 't18', label: { ko: '반환 완료', en: 'Returned' }, group: 'tenant', component: T18Returned },
  { id: 't19', label: { ko: '본국 송금', en: 'Remittance' }, group: 'tenant', component: T19Fx },
  { id: 't20', label: { ko: '활동 내역', en: 'Activity' }, group: 'tenant', tab: 'tenant', component: T20Activity },
]

const landlordScreens: ScreenDef[] = [
  { id: 'l01', label: { ko: '초대', en: 'Invite' }, group: 'landlord', component: L01Invited },
  { id: 'l02', label: { ko: '임대인 인증', en: 'Verification' }, group: 'landlord', component: L02Verify },
  { id: 'l03', label: { ko: '매물 정보', en: 'Property' }, group: 'landlord', component: L03Property },
  { id: 'l04', label: { ko: '계약 확인', en: 'Review' }, group: 'landlord', component: L04Review },
  { id: 'l05', label: { ko: '계약 완료', en: 'Signed' }, group: 'landlord', component: L05Signed },
  { id: 'l06', label: { ko: '임대인 홈', en: 'Landlord home' }, group: 'landlord', tab: 'landlord', component: L06Home },
  { id: 'l07', label: { ko: '매물 상세', en: 'Property detail' }, group: 'landlord', component: L07Detail },
  { id: 'l08', label: { ko: '월세 상태', en: 'Rent status' }, group: 'landlord', component: L08LateRent },
  { id: 'l10', label: { ko: '수익 리포트', en: 'Earnings' }, group: 'landlord', tab: 'landlord', component: L10Earnings },
  { id: 'l11', label: { ko: '보증금 정산', en: 'Settlement' }, group: 'landlord', component: L11DepositRelease },
  { id: 'l12', label: { ko: '거래 내역', en: 'Transactions' }, group: 'landlord', tab: 'landlord', component: L12Activity },
  { id: 'l13', label: { ko: '내정보', en: 'Profile' }, group: 'landlord', tab: 'landlord', component: L13Profile },
]

const walletScreen: ScreenDef = { id: 'wallet', label: { ko: '지갑 연결', en: 'Wallet' }, group: 'tenant', component: WalletConnect }
const allScreens = [...tenantScreens.slice(0, 2), walletScreen, ...tenantScreens.slice(2), ...landlordScreens]
let didApplyInitialReset = false

function getInitialScreen(): ScreenId {
  enableDemoModeFromUrl()
  const params = new URLSearchParams(window.location.search)
  if (params.get('reset') === '1' && !didApplyInitialReset) {
    localStorage.removeItem(appStorageKey)
    didApplyInitialReset = true
  }
  const screen = params.get('screen') as ScreenId | null
  if (screen && shouldStartFromEntry(screen, params)) return 't01'
  return screen && allScreens.some((item) => item.id === screen) ? screen : 't01'
}

function shouldStartFromEntry(screen: ScreenId, params: URLSearchParams) {
  if (params.get('direct') === '1' || params.get('debug') === '1') return false
  return ['role', 'wallet', 't02', 'l01'].includes(screen)
}

function getInitialRole(screenId: ScreenId): UserRole {
  const role = new URLSearchParams(window.location.search).get('role')
  if (role === 'tenant' || role === 'landlord') return role
  return screenId.startsWith('l') ? 'landlord' : 'tenant'
}

function getInitialLang(): Lang {
  const lang = new URLSearchParams(window.location.search).get('lang')
  if (lang === 'ko' || lang === 'en') {
    localStorage.setItem('bluesafe-lang', lang)
    return lang
  }
  return (localStorage.getItem('bluesafe-lang') as Lang | null) ?? 'ko'
}

const appStorageKey = 'bluesafe-runtime-state-v2'
const demoContractPayloadKey = 'bluesafe-demo-contract-payload'
const demoReturnCompressionMs = 5_000
const shouldResetRemoteDemoSession = () => new URLSearchParams(window.location.search).get('reset') === '1'

function emptyContractDraft(): ContractDraft {
  if (isDemoMode()) return { ...demoContractTerms }
  return { depositAmount: '', stakeAmount: '', startsAt: '', endsAt: '' }
}

function createInitialApp(selectedRole: UserRole): AppModel {
  return seedDemoCounterpartyState({
    selectedRole,
    walletConnected: false,
    walletProvider: '',
    walletName: '',
    walletNetwork: '',
    tenantId: '',
    landlordId: '',
    tenantAddress: '',
    landlordAddress: '',
    remittanceAddress: '',
    remittanceAmountXrp: '0.1',
    contractDraft: emptyContractDraft(),
    settlements: [],
    chainActions: {},
    backendEvents: [],
  }, selectedRole)
}

function createDemoLinkedContract(status: ContractStatus = 'draft'): BackendContract {
  return {
    id: demoIds.be2Contract,
    status,
    tenantId: demoAddresses.tenant,
    landlordId: demoAddresses.landlord,
    tenantAddress: demoAddresses.tenant,
    landlordAddress: demoAddresses.landlord,
    depositAmount: demoContractTerms.depositAmount,
    stakeAmount: demoContractTerms.stakeAmount,
    startsAt: demoIso(demoContractTerms.startsAt),
    endsAt: demoIso(demoContractTerms.endsAt),
    updatedAt: new Date().toISOString(),
  }
}

function seedDemoCounterpartyState(app: AppModel, role: UserRole): AppModel {
  if (!isDemoMode() || role !== 'landlord') return { ...app, selectedRole: role }
  return {
    ...app,
    selectedRole: role,
    tenantId: app.tenantId || demoAddresses.tenant,
    tenantAddress: app.tenantAddress || demoAddresses.tenant,
    contractDraft: isContractDraftReady(app.contractDraft) ? app.contractDraft : { ...demoContractTerms },
    contract: app.contract ?? createDemoLinkedContract(),
  }
}

function updateContractParticipant(contract: BackendContract | undefined, role: UserRole, account: string) {
  if (!contract) return contract
  return role === 'tenant'
    ? { ...contract, tenantId: account, tenantAddress: account }
    : { ...contract, landlordId: account, landlordAddress: account }
}

function mergeDemoAppState(local: AppModel, remote: Partial<AppModel>): AppModel {
  return {
    ...local,
    walletConnected: local.walletConnected || Boolean(remote.walletConnected),
    walletProvider: local.walletProvider || remote.walletProvider || '',
    walletName: local.walletName || remote.walletName || '',
    walletNetwork: local.walletNetwork || remote.walletNetwork || '',
    tenantId: remote.tenantId || local.tenantId,
    landlordId: remote.landlordId || local.landlordId,
    tenantAddress: remote.tenantAddress || local.tenantAddress,
    landlordAddress: remote.landlordAddress || local.landlordAddress,
    remittanceAddress: remote.remittanceAddress || local.remittanceAddress,
    remittanceAmountXrp: remote.remittanceAmountXrp || local.remittanceAmountXrp || '0.1',
    contractDraft: normalizeContractDraft({ ...local.contractDraft, ...(remote.contractDraft ?? {}) }),
    contract: pickNewestContract(local.contract, remote.contract),
    xrplContract: pickNewestContract(local.xrplContract, remote.xrplContract),
    settlements: pickLongestArray(local.settlements, remote.settlements),
    chainActions: { ...local.chainActions, ...(remote.chainActions ?? {}) },
    backendEvents: mergeEvents(local.backendEvents, remote.backendEvents),
  }
}

function pickNewestContract(local?: BackendContract, remote?: BackendContract) {
  if (!remote) return local
  if (!local) return remote
  if (remote.depositEscrowTxHash && !local.depositEscrowTxHash) return remote
  const localTime = local.updatedAt ? Date.parse(local.updatedAt) : 0
  const remoteTime = remote.updatedAt ? Date.parse(remote.updatedAt) : 0
  return remoteTime >= localTime ? remote : local
}

function pickLongestArray<T>(local: T[], remote?: T[]) {
  return Array.isArray(remote) && remote.length >= local.length ? remote : local
}

function mergeEvents(local: string[], remote?: string[]) {
  return [...new Set([...(remote ?? []), ...local])].slice(0, 8)
}

function getSharedContractId(app: AppModel) {
  return app.contract?.id ?? app.xrplContract?.id ?? (isDemoMode() ? demoIds.be2Contract : 'pending')
}

function buildInviteUrl(contractId: string, lang: Lang) {
  const base = buildLandlordInviteOrigin()
  const params = new URLSearchParams({
    demo: isDemoMode() ? '1' : '0',
    lang,
    role: 'landlord',
    contractId,
  })
  if (isDemoMode()) params.set('demoSession', getDemoSessionId())
  if (isDemoMode() && !isRealDemoTxMode()) params.set('tx', 'mock')
  return `${base}/?${params.toString()}`
}

function buildLandlordInviteOrigin() {
  if (typeof window === 'undefined') return 'https://bluesafe.app'
  if (!isDemoMode()) return window.location.origin

  const params = new URLSearchParams(window.location.search)
  const explicitOrigin = params.get('landlordOrigin')
  if (explicitOrigin) return explicitOrigin

  const url = new URL(window.location.href)
  if (url.port === '5179') {
    url.port = '5180'
    return url.origin
  }
  return window.location.origin
}

function loadStoredApp(selectedRole: UserRole): AppModel {
  try {
    const raw = localStorage.getItem(appStorageKey)
    if (!raw) return createInitialApp(selectedRole)
    const stored = JSON.parse(raw) as Partial<AppModel>
    const storedDraft = normalizeContractDraft({ ...emptyContractDraft(), ...(stored.contractDraft ?? {}) })
    return seedDemoCounterpartyState({
      ...createInitialApp(selectedRole),
      ...stored,
      selectedRole,
      contractDraft: isDemoMode() && !isContractDraftReady(storedDraft) ? { ...demoContractTerms } : storedDraft,
      settlements: Array.isArray(stored.settlements) ? stored.settlements : [],
      chainActions: stored.chainActions ?? {},
      backendEvents: Array.isArray(stored.backendEvents) ? stored.backendEvents : [],
    }, selectedRole)
  } catch {
    return createInitialApp(selectedRole)
  }
}

function App() {
  const initialScreen = getInitialScreen()
  const [screenId, setScreenId] = useState<ScreenId>(initialScreen)
  const [lang, setLang] = useState<Lang>(getInitialLang)
  const [app, setApp] = useState<AppModel>(() => loadStoredApp(getInitialRole(initialScreen)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [demoSyncReady, setDemoSyncReady] = useState(!isDemoMode())
  const demoSessionId = getDemoSessionId()
  const currentIndex = allScreens.findIndex((screen) => screen.id === screenId)
  const current = allScreens[currentIndex] ?? allScreens[0]
  const CurrentScreen = current.component
  const showTopBar = screenId !== 't01' && !isChromeLessScreen(screenId)

  const setLanguage = (nextLang: Lang) => {
    setLang(nextLang)
    localStorage.setItem('bluesafe-lang', nextLang)
  }
  useEffect(() => {
    localStorage.setItem(appStorageKey, JSON.stringify(app))
    if (isDemoMode() && demoSyncReady) {
      void bluesafeApi.saveDemoSession(demoSessionId, app).catch(() => undefined)
    }
  }, [app, demoSessionId, demoSyncReady])

  useEffect(() => {
    if (!isDemoMode()) return
    let cancelled = false
    const load = async () => {
      try {
        if (shouldResetRemoteDemoSession()) await bluesafeApi.clearDemoSession(demoSessionId)
        const remote = await bluesafeApi.getDemoSession<AppModel>(demoSessionId)
        if (!cancelled && remote?.state) setApp((prev) => mergeDemoAppState(prev, remote.state))
      } catch {
        /* demo sync should not block local rehearsal */
      } finally {
        if (!cancelled) setDemoSyncReady(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [demoSessionId])

  useEffect(() => {
    if (!isDemoMode() || !demoSyncReady) return
    const timer = window.setInterval(() => {
      void bluesafeApi.getDemoSession<AppModel>(demoSessionId)
        .then((remote) => {
          if (remote?.state) setApp((prev) => mergeDemoAppState(prev, remote.state))
        })
        .catch(() => undefined)
    }, 1800)
    return () => window.clearInterval(timer)
  }, [demoSessionId, demoSyncReady])
  const go = (id: ScreenId) => setScreenId(id)
  const next = () => setScreenId(allScreens[Math.min(currentIndex + 1, allScreens.length - 1)].id)
  const back = () => setScreenId(getBackTarget(screenId) ?? allScreens[Math.max(currentIndex - 1, 0)].id)
  const pushEvent = (message: string) => setApp((prev) => ({ ...prev, backendEvents: [message, ...prev.backendEvents].slice(0, 5) }))
  const run = async <T,>(label: string, task: () => Promise<T>) => {
    setBusy(true)
    setError('')
    try {
      const result = await task()
      pushEvent(label)
      return result
    } catch (err) {
      const message = err instanceof Error ? localizeError(err.message, lang) : localizeError('', lang)
      setError(message)
      pushEvent(`${label} ${lang === 'ko' ? '실패' : 'failed'}: ${message}`)
      throw err
    } finally {
      setBusy(false)
    }
  }
  const storeChainAction = (key: ChainActionKey, receipt: ChainTxReceipt) => {
    setApp((prev) => ({
      ...prev,
      chainActions: {
        ...prev.chainActions,
        [key]: receipt,
      },
    }))
  }

  const actions: AppActions = {
    selectRole: (role) => setApp((prev) => seedDemoCounterpartyState({ ...prev, selectedRole: role }, role)),
    updateContractDraft: (patch) => setApp((prev) => ({ ...prev, contractDraft: normalizeContractDraft({ ...prev.contractDraft, ...patch }) })),
    updateRemittanceAddress: (address) => setApp((prev) => ({ ...prev, remittanceAddress: address.trim() })),
    updateRemittanceAmount: (amountXrp) => setApp((prev) => ({ ...prev, remittanceAmountXrp: amountXrp.trim() })),
    connectWallet: async () => {
      await run(lang === 'ko' ? 'BlueSafe 내부 XRPL 지갑 연결' : 'BlueSafe internal XRPL wallet connected', async () => {
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
            ? { ...nextState, tenantAddress: session.account, tenantId: session.account, contract: updateContractParticipant(prev.contract, 'tenant', session.account) }
            : { ...nextState, landlordAddress: session.account, landlordId: session.account, contract: updateContractParticipant(prev.contract, 'landlord', session.account) }
        })
      })
    },
    connectCounterpartyWallet: async () => {
      const role = app.selectedRole === 'tenant' ? 'landlord' : 'tenant'
      await run(role === 'tenant'
        ? (lang === 'ko' ? '임차인 내부 XRPL 지갑 연결' : 'Tenant internal XRPL wallet connected')
        : (lang === 'ko' ? '임대인 내부 XRPL 지갑 연결' : 'Landlord internal XRPL wallet connected'), async () => {
        const session = await connectInternalWallet(role)
        setApp((prev) => role === 'tenant'
          ? { ...prev, tenantAddress: session.account, tenantId: session.account, contract: updateContractParticipant(prev.contract, 'tenant', session.account) }
          : { ...prev, landlordAddress: session.account, landlordId: session.account, contract: updateContractParticipant(prev.contract, 'landlord', session.account) })
      })
    },
    createDraftContract: async () => {
      if (app.contract) {
        const contract = withContractDraft(app.contract, app.contractDraft)
        setApp((prev) => ({ ...prev, contract }))
        return contract
      }
      return run(lang === 'ko' ? 'BE2 계약 생성' : 'BE2 contract created', async () => {
        if (!backendConfig.hasBe2) throw new Error('BE2 URL is not configured')
        const participants = getParticipantIds(app)
        if (!participants) throw new Error('Tenant and landlord identifiers are required')
        if (!isContractDraftReady(app.contractDraft)) throw new Error('Contract depositAmount, stakeAmount, startsAt and endsAt are required')
        const contract = await bluesafeApi.createOperationalContract({
          ...participants,
          depositAmount: app.contractDraft.depositAmount,
          stakeAmount: app.contractDraft.stakeAmount,
          startsAt: new Date(app.contractDraft.startsAt).toISOString(),
          endsAt: new Date(app.contractDraft.endsAt).toISOString(),
        })
        persistDemoContractPayload({
          depositAmount: app.contractDraft.depositAmount,
          stakeAmount: app.contractDraft.stakeAmount,
          startsAt: new Date(app.contractDraft.startsAt).toISOString(),
          endsAt: new Date(app.contractDraft.endsAt).toISOString(),
        })
        setApp((prev) => ({ ...prev, contract }))
        return contract
      })
    },
    lockDeposit: async () => {
      await run(lang === 'ko' ? 'BE1 에스크로 생성 및 BE2 연결' : 'BE1 escrow created and anchored to BE2', async () => {
        const contract = withContractDraft(app.contract ?? await actions.createDraftContract(), app.contractDraft)
        if (!backendConfig.hasBe1) throw new Error('BE1 URL is not configured')
        if (!app.tenantAddress || !app.landlordAddress) throw new Error('Tenant and landlord wallet addresses are required')
        const participants = getParticipantIds(app)
        if (!participants) throw new Error('Tenant and landlord identifiers are required')
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
          tenantPii: participants.tenantId,
          landlordPii: participants.landlordId,
        })
        const txHash = xrplContract.depositEscrowTxHash
        if (!txHash) throw new Error('BE1 did not return an escrow transaction hash')
        const anchored = withContractDraft(await bluesafeApi.anchorEscrow(contract.id, txHash), app.contractDraft)
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
      await run(lang === 'ko' ? 'BE2 정산 상태 조회' : 'BE2 settlement status loaded', async () => {
        const page = await bluesafeApi.listSettlements(contractId)
        setApp((prev) => ({ ...prev, settlements: page.items }))
      })
    },
    landlordSignContract: async () => {
      await run(lang === 'ko' ? 'BE2 임대인 계약 동의' : 'BE2 landlord agreement saved', async () => {
        const contract = app.contract ?? await actions.createDraftContract()
        if (!backendConfig.hasBe2) throw new Error('BE2 URL is not configured')
        const signed = await bluesafeApi.updateOperationalContractStatus(contract.id, contract.status === 'draft' ? 'escrow_pending' : contract.status)
        setApp((prev) => ({ ...prev, contract: signed }))
      })
    },
    landlordApproveSettlement: async () => {
      await run(lang === 'ko' ? 'BE2 보증금 정산 승인' : 'BE2 deposit settlement approved', async () => {
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
    runRentPayment: async () => run(lang === 'ko' ? '월세 Payment TX 생성' : 'Rent Payment TX created', async () => {
      if (!app.tenantAddress || !app.landlordAddress) throw new Error('Tenant and landlord wallet addresses are required')
      const receipt = await bluesafeApi.createRentPayment({ amountDrops: '100000' })
      storeChainAction('rentPayment', receipt)
      return receipt
    }),
    finishEscrow: async () => run(lang === 'ko' ? 'EscrowFinish 반환 TX 생성' : 'EscrowFinish return TX created', async () => {
      const owner = app.xrplContract?.contractAccountAddress ?? app.tenantAddress
      const offerSequence = app.xrplContract?.depositEscrowSequence
      if (!owner || !offerSequence) throw new Error('Escrow owner and offerSequence are required')
      const receipt = await bluesafeApi.finishEscrow({ owner, offerSequence })
      storeChainAction('autoReturn', receipt)
      return receipt
    }),
    mintSbt: async () => run(lang === 'ko' ? '평판 SBT NFTokenMint 생성' : 'Reputation SBT NFTokenMint created', async () => {
      const receipt = await bluesafeApi.mintReputationSbt()
      storeChainAction('sbt', receipt)
      return receipt
    }),
    runRemittance: async (destinationAddress, amountXrp) => run(lang === 'ko' ? '본국 송금 Payment TX 생성' : 'Remittance Payment TX created', async () => {
      if (!destinationAddress.trim()) throw new Error('Destination wallet address is required')
      const amountDrops = xrpToDrops(amountXrp)
      if (!amountDrops) throw new Error('Remittance amount must be greater than 0 XRP')
      const receipt = await bluesafeApi.createRemittance({ destinationAddress: destinationAddress.trim(), amountDrops })
      setApp((prev) => ({ ...prev, remittanceAddress: destinationAddress.trim(), remittanceAmountXrp: amountXrp.trim() }))
      storeChainAction('remittance', receipt)
      return receipt
    }),
  }

  return (
    <main className="app-shell">
      <section className="phone">
        <StatusBar />
        <div className={screenId === 't01' ? 'viewport is-entry' : 'viewport'}>
          {showTopBar && <TopBar title={current.label[lang]} onBack={back} />}
          <CurrentScreen key={screenId} next={next} go={go} app={app} actions={actions} busy={busy} error={error} lang={lang} setLang={setLanguage} />
        </div>
        {current.tab === 'tenant' && <TenantNav active={screenId} go={go} lang={lang} />}
        {current.tab === 'landlord' && <LandlordNav active={screenId} go={go} lang={lang} />}
        <HomeIndicator />
      </section>
    </main>
  )
}

function T01Entry({ next, lang }: NavProps) {
  const c = copy[lang]
  return (
    <div className="entry">
      <img src={reputationMascot} alt="" className="entry-watermark" />
      <div className="entry-copy"><h1>{lines(c.entryTitle)}</h1><p>{lines(c.entryDesc)}</p></div>
      <div className="entry-keywords" aria-label="BlueSafe features">
        <span>{c.multisig}</span><span>{c.autoReturn}</span><span>{c.remittance}</span>
      </div>
      <div className="entry-bottom"><button className="white-cta" onClick={next}>{c.start}</button><span>{c.entryFoot}</span></div>
    </div>
  )
}

function RoleSelect({ go, app, actions, lang }: NavProps) {
  const [role, setRole] = useState<UserRole>(app.selectedRole)
  const c = copy[lang]
  const start = () => { actions.selectRole(role); go('wallet') }
  return (
    <Page>
      <div className="role-page">
        <Hero title={c.roleTitle} desc={c.roleDesc} />
        <div className="role-select-list" aria-label={c.roleTitle}>
          <button className={role === 'tenant' ? 'active' : ''} onClick={() => setRole('tenant')}><span>{c.tenant}</span><strong>{c.tenantRoleTitle}</strong><small>{c.tenantRoleDesc}</small></button>
          <button className={role === 'landlord' ? 'active' : ''} onClick={() => setRole('landlord')}><span>{c.landlord}</span><strong>{c.landlordRoleTitle}</strong><small>{c.landlordRoleDesc}</small></button>
        </div>
        <div className="entry-bottom role-bottom"><button className="white-cta" onClick={start}>{c.start}</button><span>{role === 'tenant' ? c.tenantFlow : c.landlordFlow}</span></div>
      </div>
    </Page>
  )
}

function WalletConnect({ go, app, actions, error, busy, lang }: NavProps) {
  const c = copy[lang]
  const [connecting, setConnecting] = useState(false)
  const isTenant = app.selectedRole === 'tenant'
  const address = isTenant ? app.tenantAddress : app.landlordAddress
  const shortAddress = address ? shortHash(address) : ''
  const roleWalletConnected = Boolean(address)
  const continueToRole = () => go(isTenant ? 't02' : 'l01')
  const connect = async () => {
    setConnecting(true)
    try { await actions.connectWallet() } finally { setConnecting(false) }
  }
  return (
    <Page>
      <div className="wallet-page">
        <Hero title={c.walletTitle} desc={isTenant ? c.walletTenantDesc : c.walletLandlordDesc} />
        <div className="wallet-visual" aria-hidden="true"><div className="wallet-orbit"><span /><span /><strong>XRPL</strong></div></div>
        <div className="wallet-card"><div><span>{roleWalletConnected ? c.walletConnected : c.walletPending}</span><strong>{roleWalletConnected ? shortAddress : c.walletCreate}</strong><p>{roleWalletConnected ? `${app.walletProvider || c.internalWallet} · ${app.walletNetwork || c.responseNone} · ${c.walletCustody}` : c.walletServer}</p></div></div>
        <div className="wallet-points"><span>{c.walletPoint1}</span><span>{c.walletPoint2}</span><span>{c.walletPoint3}</span></div>
        {error && <p className="wallet-error">{error}</p>}
        <div className="entry-bottom wallet-bottom"><button className="white-cta" onClick={roleWalletConnected ? continueToRole : connect}>{roleWalletConnected ? c.continue : connecting || busy ? c.walletConnecting : c.walletConnect}</button><span>{isTenant ? c.tenantFlow : c.landlordFlow}</span></div>
      </div>
    </Page>
  )
}

function T02Onboarding({ next, lang }: NavProps) {
  const c = copy[lang]
  const [slide, setSlide] = useState(0)
  const slides = [
    { title: c.onboarding1Title, desc: c.onboarding1Desc, visual: <VaultDiagram lang={lang} /> },
    { title: c.onboarding2Title, desc: c.onboarding2Desc, visual: <ExamplePanel kind="return" lang={lang} /> },
    { title: c.onboarding3Title, desc: c.onboarding3Desc, visual: <ExamplePanel kind="bills" lang={lang} /> },
    { title: c.onboarding4Title, desc: c.onboarding4Desc, visual: <ExamplePanel kind="proof" lang={lang} /> },
  ]
  const current = slides[slide]
  const isLast = slide === slides.length - 1
  return <Page><div className="skip-row"><button>{c.skip}</button></div><Hero title={current.title} desc={current.desc} />{current.visual}<Dots active={slide} count={slides.length} /><BottomCTA label={isLast ? c.tossAuth : c.next} onClick={() => isLast ? next() : setSlide(slide + 1)} /></Page>
}

function T03Auth({ next, lang }: NavProps) {
  const c = copy[lang]
  const [open, setOpen] = useState(false)
  return (
    <Page>
      <Hero title={c.authTitle} desc={c.authDesc} />
      <Card tone="soft"><div className="auth-row"><IconBox><ShieldIcon /></IconBox><div><strong>{c.authSafe}</strong><span>{c.authSafeDesc}</span></div></div></Card>
      <SectionTitle>{c.authInfo}</SectionTitle>
      <ListItem icon={<CheckIcon />} title={c.nameBirth} desc={c.nameBirthDesc} />
      <ListItem icon={<CheckIcon />} title={c.regNumber} desc={c.regNumberDesc} />
      <ListItem icon={<CheckIcon />} title={c.ownerAccount} desc={c.ownerAccountDesc} />
      <p className="notice">{c.authNotice}</p>
      <BottomCTA label={c.tossAuth} secondary={c.terms} onClick={() => setOpen(true)} />
      <ActionModal open={open} title={c.authDone} onClose={() => setOpen(false)} primaryLabel={c.next} onPrimary={next}><p>{c.authSafeDesc}</p></ActionModal>
    </Page>
  )
}

function T04Kyc({ next, lang }: NavProps) {
  const c = copy[lang]
  return <Page><StepperHeader current={0} /><Hero title={c.kycTitle} desc={c.kycDesc} /><div className="camera-card"><div>{c.kycDesc}</div></div><SectionTitle>{c.checklist}</SectionTitle><Checklist items={[c.kyc1, c.kyc2, c.kyc3]} /><BottomCTA label={c.takePhoto} onClick={next} /></Page>
}

function T05Invite({ next, app, actions, busy, error, lang }: NavProps) {
  const c = copy[lang]
  const landlordReady = Boolean(app.landlordAddress)
  const sharedContractId = getSharedContractId(app)
  const inviteUrl = buildInviteUrl(sharedContractId, lang)
  const connect = async () => { try { await actions.connectCounterpartyWallet() } catch { return } }
  return (
    <Page>
      <Hero title={c.inviteTitle} desc={c.inviteDesc} />
      <Card tone="soft">
        <div className="invite-card">
          <IconBox><ReceiptIcon /></IconBox>
          <div>
            <strong>{c.inviteLink}</strong>
            <span className="invite-url">{inviteUrl}</span>
          </div>
        </div>
      </Card>
      <Card tone="soft">
        <Info label={c.contractId} value={sharedContractId} mono />
        <Info label={c.tenantWallet} value={app.tenantAddress ? shortHash(app.tenantAddress) : c.walletNeeded} mono={Boolean(app.tenantAddress)} />
        <Info label={c.landlordWallet} value={app.landlordAddress ? shortHash(app.landlordAddress) : c.walletNeeded} mono={Boolean(app.landlordAddress)} />
      </Card>
      <SectionTitle>{c.landlordTodo}</SectionTitle>
      <Timeline items={[{ title: c.counterpartyWallet, desc: landlordReady ? c.counterpartyReady : c.counterpartyNeeded, state: landlordReady ? 'done' : 'pending' }, { title: c.inviteStep2, desc: c.inviteStep2Desc, state: 'pending' }, { title: c.inviteStep3, desc: c.inviteStep3Desc, state: 'pending' }]} />
      <BackendInline error={error} />
      <BottomCTA label={landlordReady ? c.next : busy ? c.walletConnecting : c.connectLandlordWallet} secondary={landlordReady ? undefined : c.later} onClick={landlordReady ? next : connect} />
    </Page>
  )
}

function T06Contract({ next, actions, busy, error, app, lang }: NavProps) {
  const c = copy[lang]
  const [open, setOpen] = useState(false)
  const contract = app.contract ? withContractDraft(app.contract, app.contractDraft) : undefined
  const participantsReady = Boolean(getParticipantIds(app))
  const termsReady = isContractDraftReady(app.contractDraft)
  const canCreate = participantsReady && termsReady && !busy
  const canContinue = Boolean(contract) && termsReady
  const create = async () => { try { await actions.createDraftContract(); setOpen(true) } catch { return } }
  return (
    <Page bottomNav>
      <Hero title={c.contractTitle} desc={c.contractDesc} />
      <Card tone="soft">
        <Info label={c.tenantWallet} value={app.tenantAddress ? shortHash(app.tenantAddress) : c.walletNeeded} mono={Boolean(app.tenantAddress)} />
        <Info label={c.landlordWallet} value={app.landlordAddress ? shortHash(app.landlordAddress) : c.walletNeeded} mono={Boolean(app.landlordAddress)} />
        <Info label={c.contractId} value={contract?.id ?? c.responseNone} mono={Boolean(contract?.id)} />
        <Info label={c.status} value={statusText(contract?.status, lang)} />
      </Card>
      <ContractTermsForm draft={app.contractDraft} onChange={actions.updateContractDraft} lang={lang} />
      <BackendInline label={!participantsReady ? c.walletBothNeeded : !termsReady ? c.missingContractTerms : c.flowReady} error={error} />
      <BottomCTA disabled={contract ? !canContinue : !canCreate} label={busy ? c.responseWaiting : contract ? c.signContinue : c.createContract} onClick={contract ? next : create} />
      <ActionModal open={open} title={c.contractTitle} onClose={() => setOpen(false)} primaryLabel={c.next} onPrimary={next}><p>{app.contract?.id ?? c.responseWaiting}</p></ActionModal>
    </Page>
  )
}

function T07Pay({ next, actions, busy, error, app, lang }: NavProps) {
  const c = copy[lang]
  const contract = getPreparedContract(app)
  const amount = contract?.depositAmount
  const displayAmount = amount ? krw(amount, lang) : c.responseNone
  const hasTenantWallet = Boolean(app.tenantAddress)
  const hasLandlordWallet = Boolean(app.landlordAddress)
  const hasTerms = isContractDraftReady(app.contractDraft)
  const canRunEscrow = Boolean(contract) && hasTenantWallet && hasLandlordWallet && hasTerms
  const realDemoTx = isDemoMode() && isRealDemoTxMode()
  const mockDemoTx = isDemoMode() && !isRealDemoTxMode()
  return (
    <Page>
      <Hero title={c.escrowTitle} desc={c.escrowDesc} />
      <Card tone="soft">
        <Info label={c.depositAmount} value={displayAmount} strong={Boolean(amount)} />
        <Info label={c.stake} value={contract?.stakeAmount ?? c.responseNone} />
        <Info label={c.tenantWallet} value={app.tenantAddress ? shortHash(app.tenantAddress) : c.walletNeeded} mono={hasTenantWallet} />
        <Info label={c.landlordWallet} value={app.landlordAddress ? shortHash(app.landlordAddress) : c.walletNeeded} mono={hasLandlordWallet} />
      </Card>
      <ListItem icon={<WalletIcon />} title={c.internalWallet} desc={canRunEscrow ? c.walletBothReady : !hasTerms ? c.missingContractTerms : c.walletBothNeeded} />
      {realDemoTx && <Card tone="blue"><strong>{c.realTxMode}</strong><span>{c.realTxModeDesc}</span></Card>}
      {mockDemoTx && <Card tone="yellow"><strong>{c.mockTxMode}</strong><span>{c.mockTxModeDesc}</span></Card>}
      <BackendInline error={error} />
      <BottomCTA disabled={!canRunEscrow || busy} label={busy ? c.creatingEscrow : c.createEscrow} onClick={async () => { try { await actions.lockDeposit(); next() } catch { return } }} />
    </Page>
  )
}

function T08Receipt({ next, app, lang }: NavProps) {
  const c = copy[lang]
  const chainContract = app.xrplContract ?? app.contract
  const txHash = chainContract?.depositEscrowTxHash
  const explorerUrl = chainContract?.explorerUrl ?? (txHash ? `https://testnet.xrpl.org/transactions/${txHash}` : undefined)
  const txSubmitted = Boolean(txHash && (!isDemoMode() || isRealDemoTxMode()))
  return (
    <Page>
      <Hero title={c.receiptTitle} desc={c.receiptDesc} />
      <Card tone="soft">
        <Info label="BE1" value={app.xrplContract?.id ?? c.responseNone} mono={Boolean(app.xrplContract?.id)} />
        <Info label={c.contractId} value={app.contract?.id ?? c.responseNone} mono={Boolean(app.contract?.id)} />
        <Info label={c.txKind} value={chainContract?.txKind ?? (txHash ? 'EscrowCreate' : c.responseNone)} />
        <Info label={c.network} value={chainContract?.network ?? (txHash ? 'XRPL Testnet' : c.responseNone)} />
        <Info label={c.tx} value={txHash ? shortHash(txHash) : c.responseNone} mono={Boolean(txHash)} />
        <Info label={c.status} value={statusText(chainContract?.status, lang)} />
        {explorerUrl && <a className="explorer-link" href={explorerUrl} target="_blank" rel="noreferrer">{c.explorer}</a>}
      </Card>
      <Card tone={txSubmitted ? 'blue' : 'yellow'}>
        <strong>{txSubmitted ? c.realTxDone : c.mockTxMode}</strong>
        <span>{txSubmitted ? c.realTxDoneDesc : c.mockTxModeDesc}</span>
      </Card>
      <Card tone="soft">
        <strong>{c.featureCheck}</strong>
        <div className="chain-check-list">
          <ChainCheckRow title={c.escrowFeature} desc={c.escrowFeatureDesc} state={txSubmitted ? c.realTx : txHash ? c.txNotSubmitted : c.waiting} active={Boolean(txHash)} />
          <ChainCheckRow title={c.rentFeature} desc={c.rentFeatureDesc} state={app.chainActions.rentPayment ? c.realTx : c.serviceReady} active />
          <ChainCheckRow title={c.autoReturnFeature} desc={c.autoReturnFeatureDesc} state={app.chainActions.autoReturn ? c.realTx : c.serviceReady} active />
          <ChainCheckRow title={c.sbtFeature} desc={c.sbtFeatureDesc} state={app.chainActions.sbt ? c.realTx : c.serviceReady} active />
          <ChainCheckRow title={c.remittanceFeature} desc={c.remittanceFeatureDesc} state={app.chainActions.remittance ? c.realTx : c.serviceReady} active />
        </div>
      </Card>
      <BottomCTA label={c.home} secondary={c.share} onClick={next} />
    </Page>
  )
}

function T09Home({ go, app, error, lang }: NavProps) {
  const c = copy[lang]
  const contract = getPreparedContract(app) ?? app.xrplContract
  const metrics = getLeaseMetrics(app)
  const deposit = contract?.depositAmount ? krw(contract.depositAmount, lang) : c.responseNone
  const daysLeft = metrics ? `${metrics.daysLeft}` : c.responseNone
  const livedDays = metrics ? `${metrics.livedDays}${lang === 'ko' ? '일차' : ' days'}` : c.responseNone
  const txHash = app.xrplContract?.depositEscrowTxHash ?? app.contract?.depositEscrowTxHash
  const progressStyle = { '--progress': `${metrics?.progress ?? 0}%` } as CSSProperties
  const actionTitle = lang === 'ko' ? '바로가기' : 'Shortcuts'
  return (
    <Page bottomNav>
      <div className="home-head"><span>BlueSafe</span></div>
      <BackendStatus app={app} error={error} lang={lang} />
      <div className="home-summary">
        <div className="deposit-card"><span>{c.homeDeposit}</span><strong>{deposit}</strong><p>{c.safeMultisig}</p></div>
        <div className="progress-card"><div className="progress-ring" style={progressStyle}><strong>{daysLeft}</strong><span>{c.daysLeft}</span></div><p>{c.untilExpiry}</p></div>
        <div className="living-card"><span>{c.living}</span><strong>{livedDays}</strong></div>
        <div className="quick-grid"><button onClick={() => go('t11')}>{c.report}</button><button onClick={() => go('t06')}>{c.contract}</button><button onClick={() => go('t10')}>{c.return}</button><button onClick={() => go('t12')}>{c.profile}</button></div>
      </div>
      <div className="home-actions">
        <SectionTitle>{actionTitle}</SectionTitle>
        <div className="action-grid">
          <HomeActionButton title={c.rentFeature} onClick={() => go('t14')} />
          <HomeActionButton title={c.autoReturnFeature} onClick={() => go('t10')} />
          <HomeActionButton title={c.sbtFeature} onClick={() => go('t12')} />
          <HomeActionButton title={c.remittanceFeature} onClick={() => go('t19')} />
        </div>
      </div>
      <div className="home-tasks">
        <SectionTitle right={c.all}>{c.todayTodo}</SectionTitle>
        {contract ? <>
          <ListItem icon={<AlertIcon />} title={statusText(contract.status, lang)} desc={txHash ? c.escrowCreated : c.escrowPending} />
          <ListItem icon={<img src={reputationMascot} alt="" className="mini-asset" />} title={c.be1EscrowResponse} desc={txHash ? shortHash(txHash) : c.responseWaiting} />
        </> : <Card tone="soft"><strong>{c.noTodo}</strong><span>{c.noTodoDesc}</span></Card>}
      </div>
      <BottomSpace />
    </Page>
  )
}

function T10Countdown({ go, app, actions, busy, error, lang }: NavProps) {
  const c = copy[lang]
  const demoFastReturn = isDemoMode()
  const [demoReturnMs, setDemoReturnMs] = useState(() => demoFastReturn ? demoReturnCompressionMs : 0)
  const [demoSpinTick, setDemoSpinTick] = useState(0)
  const contract = getPreparedContract(app)
  const metrics = getLeaseMetrics(app, 'return')
  const finishAfter = metrics?.finishAfter
  const left = demoFastReturn ? getDemoRollingDuration(metrics?.returnLeft, demoReturnMs, demoSpinTick) : metrics?.returnLeft
  const settlement = app.settlements[0]
  // actions is recreated by App each render; this screen only needs an enter-time refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void actions.loadSettlements() }, [])
  useEffect(() => {
    if (!demoFastReturn) return
    const readyAt = Date.now() + demoReturnCompressionMs
    const timer = window.setInterval(() => {
      setDemoReturnMs(Math.max(0, readyAt - Date.now()))
      setDemoSpinTick((tick) => tick + 1)
    }, 90)
    return () => window.clearInterval(timer)
  }, [demoFastReturn])
  const hasContractDates = Boolean(contract?.startsAt && contract?.endsAt)
  const hasTx = Boolean(app.xrplContract?.depositEscrowTxHash)
  const returnWindowOpen = demoFastReturn ? demoReturnMs <= 0 : Boolean(left && left.totalMs <= 0)
  const returnTxCandidate = app.chainActions.autoReturn
  const returnTx = returnWindowOpen ? returnTxCandidate : undefined
  const progressItems: TimelineItem[] = settlement
    ? [
        { title: c.settlementResponse, desc: statusText(settlement.status, lang), state: 'done' },
        { title: returnTx ? (lang === 'ko' ? '반환 완료' : 'Return complete') : c.returnPrep, desc: settlement.id, state: returnTx ? 'done' : 'pending' },
      ]
    : [
        { title: c.period, desc: dateRange(contract?.startsAt, contract?.endsAt, lang), state: hasContractDates ? 'done' : 'pending' },
        { title: c.tx, desc: hasTx ? shortHash(app.xrplContract!.depositEscrowTxHash!) : c.responseNone, state: hasTx ? 'done' : 'pending' },
        { title: c.settlementStatus, desc: c.responseNone, state: 'pending' },
      ]
  const canReturn = returnWindowOpen && Boolean(app.xrplContract?.depositEscrowTxHash && app.xrplContract?.depositEscrowSequence)
  const runReturn = async () => {
    if (!canReturn) return
    try { await actions.finishEscrow() } catch { return }
  }
  const returnButtonLabel = returnTx ? c.home : !returnWindowOpen ? c.waiting : busy ? c.runningAutoReturn : c.runAutoReturn
  const returnCardTitle = returnTx
    ? c.autoReturnDone
    : demoFastReturn && returnWindowOpen
      ? c.returnPrep
      : demoFastReturn
        ? c.waiting
        : finishAfter ? c.noAction : c.contractWaiting
  const returnCardDesc = returnTx
    ? shortHash(returnTx.txHash)
    : demoFastReturn && returnWindowOpen
      ? (lang === 'ko' ? '데모 반환 조건이 열렸어요. 이제 자동 반환을 실행할 수 있어요.' : 'Demo return window is open. You can run auto return now.')
      : demoFastReturn
        ? (lang === 'ko' ? '데모에서는 5초 뒤 자동 반환 조건이 열려요.' : 'In demo mode, auto return opens after 5 seconds.')
        : finishAfter ? `${formatDate(finishAfter)} ${c.returnPrepDesc}` : c.noActionDesc
  return (
    <Page>
      <Hero title={c.countdownTitle} desc={c.countdownDesc} />
      <div className={demoFastReturn ? `time-grid demo-fast${returnWindowOpen ? '' : ' is-spinning'}` : 'time-grid'}>
        <TimeBox value={left ? pad2(left.days) : c.responseNone} label={c.day} />
        <TimeBox value={left ? pad2(left.hours) : c.responseNone} label={c.hour} />
        <TimeBox value={left ? pad2(left.minutes) : c.responseNone} label={c.minute} />
        {demoFastReturn && <TimeBox value={left ? pad2(left.seconds) : c.responseNone} label={lang === 'ko' ? '초' : 'sec'} />}
      </div>
      <Card tone="blue"><strong>{returnCardTitle}</strong><span>{returnCardDesc}</span></Card>
      {returnTx && <ChainReceiptCard receipt={returnTx} lang={lang} />}
      <SectionTitle>{c.progress}</SectionTitle>
      <Timeline items={returnTx ? [{ title: c.autoReturnFeature, desc: shortHash(returnTx.txHash), state: 'done' }, ...progressItems] : progressItems} />
      <BackendInline error={returnTx ? undefined : error} />
      <BottomCTA disabled={!returnTx && (!canReturn || busy)} label={returnButtonLabel} onClick={returnTx ? () => go('t09') : runReturn} />
    </Page>
  )
}

function T11Report({ go, app, lang }: NavProps) {
  const c = copy[lang]
  const hasContract = Boolean(app.contract || app.xrplContract)
  const hasSettlement = app.settlements.length > 0
  if (isDemoMode()) {
    return (
      <Page>
        <Hero title={lang === 'ko' ? '8월 안전 리포트' : 'August safety report'} desc="2026.08 · BlueSafe Trust" />
        <div className="report-summary">
          <div className="score-card"><span>{lang === 'ko' ? '안전 점수' : 'Safety score'}</span><strong>97</strong><p>/100</p></div>
          <div className="score-delta"><span>{lang === 'ko' ? '지난달보다' : 'From last month'}</span><strong>+3 ↑</strong><p>{lang === 'ko' ? '좋아졌어요' : 'Improved'}</p></div>
        </div>
        <SectionTitle>{lang === 'ko' ? '항목별 점수' : 'Signals'}</SectionTitle>
        <Card tone="soft">
          <Info label={lang === 'ko' ? '월세 정시 납부' : 'On-time rent'} value="6/6" strong />
          <Info label={lang === 'ko' ? '공과금 적정성' : 'Utility fit'} value={lang === 'ko' ? '평균 대비 +12%' : '+12% vs avg'} />
          <Info label={lang === 'ko' ? '집주인 응답성' : 'Landlord response'} value={lang === 'ko' ? '평균 4시간' : '4h avg'} />
          <Info label={lang === 'ko' ? '문서 보관' : 'Documents'} value={lang === 'ko' ? '모두 완료' : 'Complete'} />
        </Card>
        <BottomCTA label={c.home} onClick={() => go('t09')} />
      </Page>
    )
  }
  return <Page><Hero title={c.reportTitle} desc={c.reportDesc} /><Card tone="soft"><strong>{c.noScore}</strong><span>{c.noScoreDesc}</span></Card><SectionTitle>{c.signals}</SectionTitle><ListItem icon={<ReceiptIcon />} title={c.contract} desc={hasContract ? statusText(app.contract?.status ?? app.xrplContract?.status, lang) : c.responseNone} action={hasContract ? c.complete : c.waiting} /><ListItem icon={<WalletIcon />} title={c.settlement} desc={hasSettlement ? statusText(app.settlements[0]?.status, lang) : c.responseNone} action={hasSettlement ? c.complete : c.waiting} /><BottomCTA label={c.home} onClick={() => go('t09')} /></Page>
}

function T12Reputation({ go, app, actions, busy, error, lang, setLang }: NavProps) {
  const c = copy[lang]
  const hasContract = Boolean(app.contract || app.xrplContract)
  if (isDemoMode()) {
    const sbtTx = app.chainActions.sbt
    const mint = async () => { try { await actions.mintSbt() } catch { return } }
    const stages = [
      ['🌊', lang === 'ko' ? '바다' : 'Ocean', 'Ocean', '99-100'],
      ['💧', lang === 'ko' ? '샘' : 'Spring', 'Spring', '80-98'],
      ['🏞️', lang === 'ko' ? '시내' : 'Stream', 'Stream', '60-79'],
      ['💦', lang === 'ko' ? '한 방울' : 'Drop', 'Drop', '36.5-59'],
    ]
    return (
      <Page>
        <Hero title={c.reputationTitle} desc={c.reputationDesc} />
        <div className="reputation-card stage-spring">
          <img src={reputationMascot} alt="" className="reputation-mascot" />
          <small>SPRING</small>
          <strong>{lang === 'ko' ? '지금은 샘' : 'Spring now'}</strong>
          <span>{lang === 'ko' ? '97점 · 다음 바다까지 +2' : '97 pts · +2 to Ocean'}</span>
          <div className="stage-meter"><i style={{ width: '97%' }} /></div>
        </div>
        <SectionTitle>{lang === 'ko' ? '차오르는 단계' : 'Reputation stages'}</SectionTitle>
        <div className="stage-list">
          {stages.map(([emoji, title, sub, range]) => <div key={sub} className={sub === 'Spring' ? 'active' : ''}><span>{emoji}</span><p><strong>{title}</strong><small>{sub}</small></p><em>{range}</em></div>)}
        </div>
        {sbtTx && <ChainReceiptCard receipt={sbtTx} lang={lang} />}
        <SectionTitle>{c.settings}</SectionTitle>
        <Card tone="soft"><div className="setting-row"><div><strong>{c.language}</strong><span>{lang === 'ko' ? c.korean : c.english}</span></div><LanguageSegment lang={lang} onChange={setLang} /></div></Card>
        <BackendInline error={error} />
        <BottomCTA label={sbtTx ? c.home : busy ? c.mintingSbt : c.mintSbt} secondary={sbtTx ? c.share : undefined} onClick={sbtTx ? () => go('t09') : mint} />
      </Page>
    )
  }
  return <Page><Hero title={c.profile} desc={c.reputationDesc} /><Card tone="soft"><strong>{c.noGrade}</strong><span>{c.noGradeDesc}</span></Card><SectionTitle>{c.settings}</SectionTitle><Card tone="soft"><div className="setting-row"><div><strong>{c.language}</strong><span>{lang === 'ko' ? c.korean : c.english}</span></div><LanguageSegment lang={lang} onChange={setLang} /></div></Card><SectionTitle>{c.requiredSignals}</SectionTitle><ListItem icon={<ReceiptIcon />} title={c.contractHistory} desc={hasContract ? c.be2ContractResponse : c.responseNone} action={hasContract ? c.complete : c.waiting} /><ListItem icon={<ShieldIcon />} title={c.escrowHistory} desc={app.xrplContract ? c.be1EscrowResponse : c.responseNone} action={app.xrplContract ? c.complete : c.waiting} /><BottomCTA label={c.home} secondary={c.share} onClick={() => go('t09')} /></Page>
}

function T13Bills({ go, lang }: NavProps) {
  const c = copy[lang]
  if (isDemoMode()) {
    return (
      <Page bottomNav>
        <Hero title={lang === 'ko' ? '8월 공과금' : 'August utilities'} desc={lang === 'ko' ? '평년 데이터와 자동으로 비교해요' : 'Compared with normal usage.'} />
        <div className="total-bill"><span>{lang === 'ko' ? '청구 총액' : 'Total bill'}</span><strong>{krw(127400, lang)}</strong><p>{lang === 'ko' ? '평소 대비 +14,200원 (12.5%↑)' : '+14,200 KRW vs usual (12.5%↑)'}</p></div>
        <SectionTitle>{lang === 'ko' ? '항목별' : 'By item'}</SectionTitle>
        <div className="bill"><span className="bill-icon"><CheckIcon /></span><div><strong>{lang === 'ko' ? '전기' : 'Electricity'}</strong><small>{lang === 'ko' ? '8월 청구' : 'August bill'}</small></div><div className="bill-tail"><strong>{krw(48200, lang)}</strong><em>+3.1%</em></div></div>
        <div className="bill"><span className="bill-icon warn">!</span><div><strong>{lang === 'ko' ? '가스' : 'Gas'}</strong><small>{lang === 'ko' ? '8월 청구' : 'August bill'}</small></div><div className="bill-tail"><strong>{krw(31000, lang)}</strong><em className="warn">+12.5%</em></div></div>
        <div className="bill"><span className="bill-icon"><CheckIcon /></span><div><strong>{lang === 'ko' ? '수도' : 'Water'}</strong><small>{lang === 'ko' ? '8월 청구' : 'August bill'}</small></div><div className="bill-tail"><strong>{krw(18200, lang)}</strong><em>-2.0%</em></div></div>
        <div className="bill"><span className="bill-icon"><CheckIcon /></span><div><strong>{lang === 'ko' ? '인터넷' : 'Internet'}</strong><small>{lang === 'ko' ? '8월 청구' : 'August bill'}</small></div><div className="bill-tail"><strong>{krw(30000, lang)}</strong><em>0%</em></div></div>
        <BottomCTA label={c.confirm} secondary={c.later} onClick={() => go('t09')} />
      </Page>
    )
  }
  return <Page bottomNav><Hero title={c.utilityTitle} desc={c.utilityDesc} /><Card tone="soft"><strong>{c.utilityDisabled}</strong><span>{c.utilityDisabledDesc}</span></Card><BottomCTA label={c.home} secondary={c.later} onClick={() => go('t09')} /></Page>
}

function T14RentPayment({ app, actions, busy, error, lang }: NavProps) {
  const c = copy[lang]
  const [visibleRentReceipt, setVisibleRentReceipt] = useState<ChainTxReceipt>()
  const rentTx = visibleRentReceipt ?? app.chainActions.rentPayment ?? undefined
  const canSendRent = Boolean(app.tenantAddress && app.landlordAddress && !busy)
  const sendRent = async () => {
    try {
      const receipt = await actions.runRentPayment()
      setVisibleRentReceipt(receipt)
    } catch { return }
  }
  return (
    <Page>
      <Hero title={c.rentFeature} desc={lang === 'ko' ? '이번 달 월세를 XRPL Payment TX로 송금해요.' : 'Send this month rent as an XRPL Payment TX.'} />
      <Card tone="soft">
        <Info label={c.amount} value={krw(680000, lang)} strong />
        <Info label={c.tenantWallet} value={app.tenantAddress ? shortHash(app.tenantAddress) : c.walletNeeded} mono={Boolean(app.tenantAddress)} />
        <Info label={c.landlordWallet} value={app.landlordAddress ? shortHash(app.landlordAddress) : c.walletNeeded} mono={Boolean(app.landlordAddress)} />
        <Info label={c.status} value={rentTx ? c.rentPaymentDone : (lang === 'ko' ? '송금 전' : 'Ready to send')} />
      </Card>
      {rentTx && <ChainReceiptCard receipt={rentTx} lang={lang} />}
      <BackendInline error={error} />
      <BottomCTA disabled={!canSendRent} label={busy ? c.runningRentPayment : rentTx ? (lang === 'ko' ? '다시 송금하기' : 'Send again') : c.runRentPayment} onClick={sendRent} />
    </Page>
  )
}

function T17Moveout({ next, app, lang }: NavProps) {
  const c = copy[lang]
  const hasSettlement = app.settlements.length > 0
  return <Page><Hero title={c.moveoutTitle} desc={c.moveoutDesc} /><ListItem icon={<WalletIcon />} title={c.settlementResponse} desc={hasSettlement ? statusText(app.settlements[0]?.status, lang) : c.responseNone} action={hasSettlement ? c.complete : c.waiting} /><Card tone="soft"><strong>{c.returnPrep}</strong><span>{c.returnPrepDesc}</span></Card><BottomCTA label={c.checkSettlement} onClick={next} /></Page>
}

function T18Returned({ next, app, lang }: NavProps) {
  const c = copy[lang]
  const settlement = app.settlements[0]
  return <Page><Hero title={c.returnedTitle} desc={c.returnedDesc} />{settlement ? <Card><Info label={c.settlementId} value={settlement.id} mono /><Info label={c.status} value={statusText(settlement.status, lang)} /><Info label={c.amount} value={settlement.amountMinor ? krw(settlement.amountMinor, lang) : c.noAmount} strong /></Card> : <Card tone="soft"><strong>{c.noReturnData}</strong><span>{c.noReturnDataDesc}</span></Card>}<BottomCTA label={c.prepareRemittance} secondary={c.onchainReceipt} onClick={next} /></Page>
}

function T19Fx({ app, actions, busy, error, lang }: NavProps) {
  const c = copy[lang]
  const settlement = app.settlements[0]
  const [visibleRemittanceHash, setVisibleRemittanceHash] = useState<string>()
  const destinationAddress = app.remittanceAddress
  const amountXrp = app.remittanceAmountXrp || '0.1'
  const amountDrops = xrpToDrops(amountXrp)
  const remittanceTxCandidate = app.chainActions.remittance
  const remittanceTx = remittanceTxCandidate && remittanceTxCandidate.txHash === visibleRemittanceHash && remittanceTxCandidate.destinationAddress === destinationAddress && remittanceTxCandidate.amountDrops === amountDrops
    ? remittanceTxCandidate
    : undefined
  const canSend = Boolean(destinationAddress && amountDrops && app.tenantAddress && !busy)
  const send = async () => {
    try {
      const receipt = await actions.runRemittance(destinationAddress, amountXrp)
      setVisibleRemittanceHash(receipt.txHash)
    } catch { return }
  }
  return (
    <Page>
      <Hero title={c.fxTitle} desc={c.fxDesc} />
      <Card tone="soft">
        <strong>{remittanceTx ? c.remittanceDone : settlement ? c.settlementFound : c.noFxData}</strong>
        <span>{remittanceTx ? shortHash(remittanceTx.txHash) : settlement?.amountMinor ? krw(settlement.amountMinor, lang) : c.noReturnDataDesc}</span>
        <label className="flow-field">
          <span>{lang === 'ko' ? '받는 XRPL 지갑주소' : 'Recipient XRPL wallet'}</span>
          <input value={destinationAddress} placeholder="r..." onChange={(event) => actions.updateRemittanceAddress(event.currentTarget.value)} />
        </label>
        <label className="flow-field">
          <span>{lang === 'ko' ? '송금 수량 (XRP)' : 'Amount (XRP)'}</span>
          <input value={amountXrp} inputMode="decimal" placeholder="0.1" onChange={(event) => actions.updateRemittanceAmount(event.currentTarget.value)} />
        </label>
        <Info label={lang === 'ko' ? '전송 단위' : 'Network amount'} value={amountDrops ? `${amountDrops} drops` : c.responseNone} mono={Boolean(amountDrops)} />
        <Info label={c.tenantWallet} value={app.tenantAddress ? shortHash(app.tenantAddress) : c.walletNeeded} mono={Boolean(app.tenantAddress)} />
        <Info label={c.recipient} value={destinationAddress || c.responseNone} mono={Boolean(destinationAddress)} />
      </Card>
      {remittanceTx && <ChainReceiptCard receipt={remittanceTx} lang={lang} />}
      <SectionTitle>{c.requiredSignals}</SectionTitle>
      <ListItem icon={<WalletIcon />} title={c.settlementTotal} desc={settlement ? statusText(settlement.status, lang) : c.responseNone} action={settlement ? c.complete : c.waiting} />
      <ListItem icon={<UserIcon />} title={c.recipient} desc={remittanceTx ? c.remittanceDone : destinationAddress || c.recipientWaiting} action={remittanceTx ? c.complete : c.waiting} />
      <BackendInline error={error} />
      <BottomCTA disabled={!canSend} label={busy ? c.runningRemittance : remittanceTx ? (lang === 'ko' ? '다시 송금하기' : 'Send again') : c.runRemittance} onClick={send} />
    </Page>
  )
}

function T20Activity({ app, lang }: NavProps) {
  const c = copy[lang]
  const rows = buildTenantRows(app, lang)
  return <Page bottomNav><Hero title={c.activityTitle} desc={c.activityDesc} /><div className="chip-wrap compact"><span className="chip selected">{c.all}</span><span className="chip">{c.walletCreated}</span><span className="chip">{c.contract}</span></div>{rows.length > 0 ? <ActivityRows rows={rows} /> : <Card tone="soft"><strong>{c.activityEmpty}</strong><span>{c.activityEmptyDesc}</span></Card>}<BottomSpace /></Page>
}

function L01Invited({ next, app, actions, busy, error, lang }: NavProps) {
  const c = copy[lang]
  const tenantReady = Boolean(app.tenantAddress)
  const sharedContractId = getSharedContractId(app)
  const inviteUrl = buildInviteUrl(sharedContractId, lang)
  const connect = async () => { try { await actions.connectCounterpartyWallet() } catch { return } }
  return <Page><div className="home-head"><span>BlueSafe</span></div><Hero title={c.lStartTitle} desc={c.lStartDesc} /><Card tone="soft"><div className="invite-card"><IconBox><ReceiptIcon /></IconBox><div><strong>{c.inviteLink}</strong><span className="invite-url">{inviteUrl}</span></div></div></Card><Card tone="soft"><Info label={c.landlordWallet} value={app.landlordAddress ? shortHash(app.landlordAddress) : c.walletNeeded} mono={Boolean(app.landlordAddress)} /><Info label={c.tenantWallet} value={app.tenantAddress ? shortHash(app.tenantAddress) : c.walletNeeded} mono={Boolean(app.tenantAddress)} /><Info label={c.contractId} value={sharedContractId} mono={Boolean(sharedContractId)} /></Card><BackendInline error={error} /><BottomCTA label={tenantReady ? c.viewContract : busy ? c.walletConnecting : c.connectTenantWallet} secondary={tenantReady ? c.later : undefined} onClick={tenantReady ? next : connect} /></Page>
}

function L02Verify({ next, lang }: NavProps) {
  const c = copy[lang]
  const [open, setOpen] = useState(false)
  return <Page><StepperHeader current={0} /><Hero title={c.lVerifyTitle} desc={c.lVerifyDesc} /><ListItem icon="1" title={c.personal} desc={lang === 'ko' ? '주민등록증 본인 명의' : 'Personal ID in your name'} /><ListItem icon="2" title={c.business} desc={lang === 'ko' ? '사업자등록증 + 본인 명의' : 'Business certificate and personal verification'} /><ListItem icon="3" title={c.corporation} desc={lang === 'ko' ? '법인 인감 + 대표자 인증' : 'Corporate seal and representative verification'} /><p className="notice">{c.lVerifyNotice}</p><BottomCTA label={c.tossAuth} onClick={() => setOpen(true)} /><ActionModal open={open} title={c.authDone} onClose={() => setOpen(false)} primaryLabel={c.next} onPrimary={next}><p>{c.lVerifyNotice}</p></ActionModal></Page>
}

function L03Property({ next, app, lang }: NavProps) {
  const c = copy[lang]
  return <Page><Hero title={c.propertyTitle} desc={c.propertyDesc} /><Card tone="soft"><strong>{c.noProperty}</strong><span>{app.contract?.id ? `${c.contractId}: ${app.contract.id}` : c.propertyNeeded}</span></Card><BottomCTA label={c.reviewContract} onClick={next} /></Page>
}

function L04Review({ next, actions, busy, error, app, lang }: NavProps) {
  const c = copy[lang]
  const [open, setOpen] = useState(false)
  const participantsReady = Boolean(getParticipantIds(app))
  const termsReady = isContractDraftReady(app.contractDraft)
  const canSign = participantsReady && termsReady && !busy
  const sign = async () => { try { await actions.landlordSignContract(); setOpen(true) } catch { return } }
  return <Page><Hero title={c.reviewContract} desc={c.reviewContractDesc} /><Card tone="soft"><Info label={c.contractId} value={app.contract?.id ?? c.responseNone} mono={Boolean(app.contract?.id)} /><Info label={c.status} value={statusText(app.contract?.status, lang)} /><Info label={c.tenantWallet} value={app.tenantAddress ? shortHash(app.tenantAddress) : c.walletNeeded} mono={Boolean(app.tenantAddress)} /></Card><ContractTermsForm draft={app.contractDraft} onChange={actions.updateContractDraft} lang={lang} /><BackendInline label={!participantsReady ? c.walletBothNeeded : !termsReady ? c.missingContractTerms : c.flowReady} error={error} /><BottomCTA disabled={!canSign} label={busy ? c.savingSignature : c.agreeSign} secondary={c.requestEdit} onClick={sign} /><ActionModal open={open} title={c.agreementSaved} onClose={() => setOpen(false)} primaryLabel={c.continue} onPrimary={next}><p>{c.agreementSavedDesc}</p></ActionModal></Page>
}

function L05Signed({ next, app, lang }: NavProps) {
  const c = copy[lang]
  return <Page><Hero title={c.contractStatusTitle} desc={c.contractStatusDesc} /><Card tone="soft"><Info label={c.contractId} value={app.contract?.id ?? c.responseNone} mono={Boolean(app.contract?.id)} /><Info label={c.status} value={statusText(app.contract?.status, lang)} /></Card><BottomCTA label={c.dashboard} secondary={c.contract} onClick={next} /></Page>
}

function L06Home({ go, app, lang }: NavProps) {
  const c = copy[lang]
  const hasContract = Boolean(app.contract || app.xrplContract)
  return <Page bottomNav><div className="home-head"><span>BlueSafe</span></div><Hero title={c.landlordDashboard} desc={c.landlordDashboardDesc} /><div className="landlord-summary"><div className="income-card"><span>{c.contractStatusTitle}</span><strong>{statusText(app.contract?.status, lang)}</strong><p>{app.contract?.id ?? c.responseNone}</p></div><div className="rent-status-card"><span>{c.settlement}</span><strong>{app.settlements.length}</strong><p>{c.records}</p></div><div className="vacancy-card"><span>XRPL</span><strong>{app.xrplContract ? c.complete : c.waiting}</strong></div><div className="quick-grid"><button onClick={() => go('l07')}>{c.property}</button><button onClick={() => go('l08')}>{c.rent}</button><button onClick={() => go('l11')}>{c.settlement}</button><button onClick={() => go('l10')}>{c.report}</button></div></div><div className="home-tasks landlord-properties"><SectionTitle right={c.all}>{c.contracts}</SectionTitle>{hasContract ? <ListItem icon={<HomeIcon />} title={c.be2ContractResponse} desc={app.contract?.id ?? app.xrplContract?.id} action={statusText(app.contract?.status ?? app.xrplContract?.status, lang)} onClick={() => go('l07')} /> : <Card tone="soft"><strong>{c.noContractData}</strong><span>{c.noContractDataDesc}</span></Card>}</div><BottomSpace /></Page>
}

function L07Detail({ app, lang }: NavProps) {
  const c = copy[lang]
  return <Page><Hero title={c.propertyDetail} desc={c.propertyDetailDesc} /><Card tone="soft"><Info label="BE2" value={app.contract?.id ?? c.responseNone} mono={Boolean(app.contract?.id)} /><Info label="BE1" value={app.xrplContract?.id ?? c.responseNone} mono={Boolean(app.xrplContract?.id)} /><Info label={c.status} value={statusText(app.contract?.status ?? app.xrplContract?.status, lang)} /></Card><SectionTitle>{c.tenant}</SectionTitle><ListItem icon={<UserIcon />} title={c.tenantId} desc={app.tenantId || (app.tenantAddress ? shortHash(app.tenantAddress) : c.responseNone)} action={app.tenantAddress ? c.walletLinked : c.waiting} /></Page>
}

function L08LateRent({ next, app, actions, busy, error, lang }: NavProps) {
  const c = copy[lang]
  const rentTx = app.chainActions.rentPayment
  const sendRent = async () => { try { await actions.runRentPayment() } catch { return } }
  return <Page><Hero title={c.rentStatus} desc={c.rentStatusDesc} /><Card tone="soft"><strong>{rentTx ? c.rentPaymentDone : c.noRentEvent}</strong><span>{rentTx ? shortHash(rentTx.txHash) : app.settlements.length ? c.settlementResponse : c.noReturnDataDesc}</span></Card>{rentTx && <ChainReceiptCard receipt={rentTx} lang={lang} />}<BackendInline error={error} /><BottomCTA label={rentTx ? c.confirm : busy ? c.runningRentPayment : c.runRentPayment} secondary={rentTx ? undefined : c.later} onClick={rentTx ? next : sendRent} /></Page>
}

function L10Earnings({ next, app, lang }: NavProps) {
  const c = copy[lang]
  const total = app.settlements.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0)
  return <Page bottomNav><Hero title={c.earningsReport} desc={c.earningsDesc} /><div className="earnings-summary"><div className="earnings-total"><span>{c.settlementTotal}</span><strong>{total ? krw(total, lang) : c.responseNone}</strong><p>{app.settlements.length} {c.records}</p></div><div className="earnings-mini"><span>{c.contract}</span><strong>{app.contract ? '1' : '0'}</strong></div><div className="earnings-mini"><span>XRPL</span><strong>{app.xrplContract ? '1' : '0'}</strong></div></div><SectionTitle>{c.byProperty}</SectionTitle>{app.contract ? <ListItem icon={<HomeIcon />} title={c.be2ContractResponse} desc={app.contract.id} action={statusText(app.contract.status, lang)} /> : <Card tone="soft"><strong>{c.noEarnings}</strong><span>{c.noEarningsDesc}</span></Card>}<BottomCTA label={c.viewSettlement} onClick={next} /></Page>
}

function L11DepositRelease({ next, actions, busy, error, app, lang }: NavProps) {
  const c = copy[lang]
  const [open, setOpen] = useState(false)
  const settlement = app.settlements[0]
  const approve = async () => { try { await actions.landlordApproveSettlement(); setOpen(true) } catch { return } }
  return <Page><Hero title={c.depositSettlement} desc={c.depositSettlementDesc} /><Card tone="soft"><Info label={c.settlementId} value={settlement?.id ?? c.responseNone} mono={Boolean(settlement?.id)} /><Info label={c.status} value={statusText(settlement?.status, lang)} /><Info label={c.amount} value={settlement?.amountMinor ? krw(settlement.amountMinor, lang) : c.noAmount} /></Card><BackendInline error={error} /><BottomCTA label={busy ? c.approvingSettlement : c.approveSettlement} secondary={c.reject} onClick={approve} /><ActionModal open={open} title={c.settlementApproved} onClose={() => setOpen(false)} primaryLabel={c.continue} onPrimary={next}><p>{c.agreementSavedDesc}</p></ActionModal></Page>
}

function L12Activity({ app, lang }: NavProps) {
  const c = copy[lang]
  const rows = buildLandlordRows(app, lang)
  return <Page bottomNav><Hero title={c.transactionHistory} desc={c.transactionHistoryDesc} /><div className="chip-wrap compact"><span className="chip selected">{c.all}</span><span className="chip">{c.contract}</span><span className="chip">{c.settlement}</span></div>{rows.length ? <ActivityRows rows={rows} /> : <Card tone="soft"><strong>{c.noTransactionHistory}</strong><span>{c.noTransactionHistoryDesc}</span></Card>}<BottomSpace /></Page>
}

function L13Profile({ app, lang, setLang }: NavProps) {
  const c = copy[lang]
  const contractStatus = statusText(app.contract?.status ?? app.xrplContract?.status, lang)
  const rentTx = app.chainActions.rentPayment
  return (
    <Page bottomNav>
      <Hero title={c.profile} desc={lang === 'ko' ? '임대인 계정과 연결된 계약 상태를 확인해요.' : 'Review the landlord account and linked contract state.'} />
      <Card tone="soft">
        <Info label={c.landlordWallet} value={app.landlordAddress ? shortHash(app.landlordAddress) : c.walletNeeded} mono={Boolean(app.landlordAddress)} />
        <Info label={c.tenantWallet} value={app.tenantAddress ? shortHash(app.tenantAddress) : c.walletNeeded} mono={Boolean(app.tenantAddress)} />
        <Info label={c.contractId} value={getSharedContractId(app)} mono />
        <Info label={c.status} value={contractStatus} />
      </Card>
      <SectionTitle>{c.settings}</SectionTitle>
      <Card tone="soft"><div className="setting-row"><div><strong>{c.language}</strong><span>{lang === 'ko' ? c.korean : c.english}</span></div><LanguageSegment lang={lang} onChange={setLang} /></div></Card>
      <SectionTitle>{c.requiredSignals}</SectionTitle>
      <ListItem icon={<ReceiptIcon />} title={c.contractHistory} desc={app.contract ? app.contract.id : c.responseNone} action={app.contract ? c.complete : c.waiting} />
      <ListItem icon={<ShieldIcon />} title={c.escrowHistory} desc={app.xrplContract ? app.xrplContract.id : c.responseNone} action={app.xrplContract ? c.complete : c.waiting} />
      <ListItem icon={<WalletIcon />} title={c.rentPaymentDone} desc={rentTx ? shortHash(rentTx.txHash) : c.responseNone} action={rentTx ? c.complete : c.waiting} />
      <BottomSpace />
    </Page>
  )
}

function Page({ children, bottomNav = false }: { children: ReactNode; bottomNav?: boolean }) {
  return <section className={bottomNav ? 'page has-bottom-nav' : 'page'}>{children}</section>
}

function LanguageSegment({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return <div className="language-segment" aria-label="Language"><button className={lang === 'ko' ? 'active' : ''} onClick={() => onChange('ko')}>KO</button><button className={lang === 'en' ? 'active' : ''} onClick={() => onChange('en')}>EN</button></div>
}

function Hero({ title, desc }: { title: string; desc?: string }) {
  return <div className="hero"><h1>{lines(title)}</h1>{desc && <p>{lines(desc)}</p>}</div>
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="topbar"><button onClick={onBack} aria-label="back"><ChevronLeftIcon /></button><strong>{title}</strong><span /></header>
}

function StatusBar() {
  return <div className="status"><span>9:41</span><span>5G 100%</span></div>
}

function HomeIndicator() {
  return <div className="home-indicator"><span /></div>
}

function BottomCTA({ label, secondary, disabled = false, onClick }: { label: string; secondary?: string; disabled?: boolean; onClick: () => void }) {
  return <div className={secondary ? 'bottom-cta has-secondary' : 'bottom-cta'}>{secondary && <button className="secondary" type="button">{secondary}</button>}<button className="primary" type="button" disabled={disabled} onClick={disabled ? undefined : onClick}>{label}</button></div>
}

function Card({ children, tone = 'white' }: { children: ReactNode; tone?: 'white' | 'soft' | 'blue' | 'yellow' }) {
  return <div className={`card ${tone}`}>{children}</div>
}

function SectionTitle({ children, right }: { children: ReactNode; right?: string }) {
  return <div className="section-title"><h2>{children}</h2>{right && <span>{right}</span>}</div>
}

function ListItem({ icon, title, desc, action, onClick }: { icon: ReactNode; title: string; desc?: string; action?: string; onClick?: () => void }) {
  return <button className="list-item" onClick={onClick}><span className="list-icon">{icon}</span><span className="list-copy"><strong>{title}</strong>{desc && <small>{desc}</small>}</span>{action && <em>{action}</em>}</button>
}

function ChainCheckRow({ title, desc, state, active = false }: { title: string; desc: string; state: string; active?: boolean }) {
  return <div className="chain-check-row"><span className={active ? 'active' : ''}>{active ? <CheckIcon /> : '•'}</span><div><strong>{title}</strong><small>{desc}</small></div><em>{state}</em></div>
}

function HomeActionButton({ title, onClick }: { title: string; onClick: () => void }) {
  return <button className="home-action" type="button" onClick={onClick}><span>{title}</span></button>
}

function ChainReceiptCard({ receipt, lang }: { receipt: ChainTxReceipt; lang: Lang }) {
  const c = copy[lang]
  return (
    <Card tone="soft">
      <strong>{c.txReceipt}</strong>
      <Info label={c.txKind} value={receipt.txType} />
      <Info label={c.network} value={receipt.network} />
      <Info label={c.tx} value={shortHash(receipt.txHash)} mono />
      {receipt.amountDrops && <Info label={c.amount} value={dropsToXrpLabel(receipt.amountDrops)} />}
      {receipt.explorerUrl && <a className="explorer-link" href={receipt.explorerUrl}>{c.explorer}</a>}
    </Card>
  )
}

function Info({ label, value, strong = false, mono = false }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return <div className="info"><span>{label}</span><strong className={`${strong ? 'strong' : ''} ${mono ? 'mono' : ''}`}>{value}</strong></div>
}

function ContractTermsForm({ draft, onChange, lang }: { draft: ContractDraft; onChange: (patch: Partial<ContractDraft>) => void; lang: Lang }) {
  const c = copy[lang]
  const lockupAmount = deriveStakeAmount(draft.depositAmount)
  return (
    <Card tone="soft">
      <div className="form-head">
        <strong>{c.contractTerms}</strong>
        <span>{c.contractTermsDesc}</span>
      </div>
      <label className="flow-field">
        <span>{c.depositAmount}</span>
        <input inputMode="numeric" value={draft.depositAmount} placeholder="0" onChange={(event) => onChange({ depositAmount: onlyDigits(event.currentTarget.value) })} />
      </label>
      <Info label={c.estimatedLockup} value={lockupAmount ? `≈ ${formatPlainNumber(lockupAmount)} XRP` : c.responseNone} />
      <p className="form-note">{c.autoCalculated}</p>
      <div className="date-grid">
        <label className="flow-field">
          <span>{c.startDate}</span>
          <input inputMode="numeric" value={draft.startsAt} placeholder="YYYY-MM-DD" onChange={(event) => onChange({ startsAt: normalizeDateInput(event.currentTarget.value) })} />
        </label>
        <label className="flow-field">
          <span>{c.endDate}</span>
          <input inputMode="numeric" value={draft.endsAt} placeholder="YYYY-MM-DD" onChange={(event) => onChange({ endsAt: normalizeDateInput(event.currentTarget.value) })} />
        </label>
      </div>
    </Card>
  )
}

function Checklist({ items }: { items: string[] }) {
  return <>{items.map((item) => <ListItem key={item} icon={<CheckIcon />} title={item} />)}</>
}

function VaultDiagram({ lang }: { lang: Lang }) {
  const c = copy[lang]
  return <div className="onboarding-visual vault"><svg className="vault-lines" viewBox="0 0 327 232" preserveAspectRatio="none" aria-hidden="true"><path d="M 68 92 C 68 132, 110 150, 140 158" /><path d="M 259 92 C 259 132, 217 150, 187 158" /></svg><div className="party-card tenant"><UserIcon /><span>{c.tenant}</span></div><div className="party-card landlord"><KeyIcon /><span>{c.landlord}</span></div><div className="vault-core"><LockIcon /><strong>VAULT</strong><small>XRPL Escrow</small></div></div>
}

function ExamplePanel({ kind, lang }: { kind: 'return' | 'bills' | 'proof'; lang: Lang }) {
  const c = copy[lang]
  if (kind === 'return') return <div className="example-panel"><div className="example-calendar"><span>{c.autoReturn}</span><strong>{c.waiting}</strong><small>{c.countdownDesc}</small></div><div className="example-chip">{c.responseWaiting}</div></div>
  if (kind === 'bills') return <div className="example-panel list-preview"><div><CheckIcon /><span>{c.utilityTitle}</span><b>{c.utilityDisabled}</b></div><div><ReceiptIcon /><span>{c.contract}</span><b>{c.waiting}</b></div><div><CheckIcon /><span>{c.settlement}</span><b>{c.waiting}</b></div></div>
  return <div className="example-panel proof-preview"><div><span>{c.tx}</span><strong>{c.waiting}</strong><small>{c.receiptDesc}</small></div><ShieldIcon /></div>
}

function Dots({ active, count }: { active: number; count: number }) {
  return <div className="dots">{Array.from({ length: count }, (_, i) => <button key={i} className={i === active ? 'active' : ''} />)}</div>
}

function StepperHeader({ current }: { current: number }) {
  return <div className="stepper-head">{[0, 1, 2].map((n) => <span key={n} className={n <= current ? 'active' : ''}>{n + 1}</span>)}</div>
}

function Timeline({ items }: { items: TimelineItem[] }) {
  return <Card tone="soft">{items.map((item, i) => {
    const done = item.state === 'done'
    return <div className="step-row" key={`${item.title}-${i}`}><span className={done ? 'done' : ''}>{done ? <CheckIcon /> : i + 1}</span><div><strong>{item.title}</strong><small>{item.desc}</small></div></div>
  })}</Card>
}

function ActivityRows({ rows }: { rows: string[][] }) {
  return <>{rows.map(([section, date, title, desc, value], i) => <div key={`${date}-${title}-${i}`}>{section && <SectionTitle>{section}</SectionTitle>}<div className="activity-row"><span>{date}</span><div><strong>{title}</strong><small>{desc}</small></div><b>{value}</b></div></div>)}</>
}

function BackendStatus({ app, error, lang }: { app: AppModel; error: string; lang: Lang }) {
  const c = copy[lang]
  const status = statusText(app.xrplContract?.status ?? app.contract?.status, lang)
  const contractLabel = app.contract?.id ? `BE2 ${app.contract.id}` : `BE2 ${c.responseNone}`
  const xrplLabel = app.xrplContract?.id ? `BE1 ${app.xrplContract.id}` : `BE1 ${c.responseNone}`
  return <div className="backend-status"><div><span>{c.backendStatus}</span><strong>{status}</strong></div><p>{contractLabel} · {xrplLabel}</p>{error && <em>{error}</em>}</div>
}

function BackendInline({ label, error }: { label?: string; error?: string }) {
  if (!label && !error) return null
  return <div className={error ? 'backend-inline error' : 'backend-inline'}>{label && <span>{label}</span>}{error && <span>{error}</span>}</div>
}

function ActionModal({ open, title, children, primaryLabel, onPrimary, onClose }: { open: boolean; title: string; children: ReactNode; primaryLabel: string; onPrimary: () => void; onClose: () => void }) {
  if (!open) return null
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}><div className="modal-sheet"><button className="modal-close" onClick={onClose} aria-label="close">×</button><h2>{title}</h2><div className="modal-body">{children}</div><button className="modal-primary" onClick={onPrimary}>{primaryLabel}</button></div></div>
}

function TenantNav({ active, go, lang }: { active: ScreenId; go: (id: ScreenId) => void; lang: Lang }) {
  const c = copy[lang]
  return <nav className="bottom-nav four-tabs">{[['t09', c.home, <HomeIcon />], ['t20', c.history, <HistoryIcon />], ['t06', c.contract, <ReceiptIcon />], ['t12', c.profile, <UserIcon />]].map(([id, label, icon]) => <button key={id as string} className={active === id ? 'active' : ''} onClick={() => go(id as ScreenId)}>{icon}<span>{label as string}</span></button>)}</nav>
}

function LandlordNav({ active, go, lang }: { active: ScreenId; go: (id: ScreenId) => void; lang: Lang }) {
  const c = copy[lang]
  return <nav className="bottom-nav four-tabs">{[['l06', c.home, <HomeIcon />], ['l10', c.revenue, <ChartIcon />], ['l12', c.contract, <ReceiptIcon />], ['l13', c.profile, <UserIcon />]].map(([id, label, icon]) => <button key={id as string} className={active === id ? 'active' : ''} onClick={() => go(id as ScreenId)}>{icon}<span>{label as string}</span></button>)}</nav>
}

function TimeBox({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>
}

function IconBox({ children }: { children: ReactNode }) {
  return <span className="icon-box">{children}</span>
}

function BottomSpace() {
  return <div className="bottom-space" />
}

function lines(value: string) {
  return value.split('\n').map((line, index) => <span key={`${line}-${index}`}>{line}{index < value.split('\n').length - 1 && <br />}</span>)
}

function krw(value: number | string, lang: Lang) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(numberValue)) return `${numberValue.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US')}원`
  return String(value)
}

function xrpToDrops(value: string) {
  const normalized = value.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{0,6})?$/.test(normalized)) return undefined
  const [whole, fraction = ''] = normalized.split('.')
  const drops = BigInt(whole) * 1_000_000n + BigInt((fraction + '000000').slice(0, 6))
  return drops > 0n ? drops.toString() : undefined
}

function dropsToXrpLabel(value: string) {
  if (!/^\d+$/.test(value)) return `${value} drops`
  const drops = BigInt(value)
  const whole = drops / 1_000_000n
  const fraction = (drops % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return `${whole.toString()}${fraction ? `.${fraction}` : ''} XRP (${value} drops)`
}

function shortHash(value: string) {
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function statusText(status: ContractStatus | SettlementRecord['status'] | string | undefined, lang: Lang) {
  const c = copy[lang]
  if (!status) return c.responseNone
  const map: Record<string, Record<Lang, string>> = {
    draft: { ko: '계약 작성 중', en: 'Draft' },
    escrow_pending: { ko: '에스크로 대기', en: 'Escrow pending' },
    escrow_validated: { ko: '에스크로 확인 완료', en: 'Escrow validated' },
    active: { ko: '계약 진행 중', en: 'Active' },
    closed: { ko: '종료됨', en: 'Closed' },
    cancelled: { ko: '취소됨', en: 'Cancelled' },
    collecting: { ko: '정산 수집 중', en: 'Collecting' },
    accrued: { ko: '정산 발생', en: 'Accrued' },
    confirmed: { ko: '정산 확정', en: 'Confirmed' },
    archived: { ko: '보관됨', en: 'Archived' },
  }
  return map[status]?.[lang] ?? status
}

function dateRange(start?: string, end?: string, lang: Lang = 'ko') {
  const c = copy[lang]
  const startsAt = parseDate(start)
  const endsAt = parseDate(end)
  if (!startsAt || !endsAt) return c.responseNone
  return `${formatDate(startsAt)}–${formatDate(endsAt)}`
}

function localizeError(message: string, lang: Lang) {
  if (lang === 'en') {
    if (message.includes('Cannot POST /contracts')) return 'Full BE1 escrow API is not running'
    if (message.includes('Destination wallet address') || message.includes('destinationAddress')) return 'Recipient XRPL wallet address is required'
    return message || 'Request failed'
  }
  if (!message) return '요청 처리에 실패했어요'
  if (message.includes('Cannot POST /contracts')) return '전체 BE1 에스크로 API가 실행 중이어야 해요'
  if (message.includes('Failed to fetch')) return '서버에 연결하지 못했어요'
  if (message.includes('Wallet API URL is not configured')) return '지갑 API 주소가 설정되지 않았어요'
  if (message.includes('URL is not configured')) return '백엔드 주소가 설정되지 않았어요'
  if (message.includes('wallet addresses are required')) return '임차인과 임대인 지갑 주소가 모두 필요해요'
  if (message.includes('Destination wallet address') || message.includes('destinationAddress')) return '받는 XRPL 지갑주소가 필요해요'
  if (message.includes('identifiers are required')) return '임차인과 임대인 식별자가 모두 필요해요'
  if (message.includes('depositAmount') || message.includes('stakeAmount')) return '계약의 보증금 또는 락업 수량 응답이 필요해요'
  if (message.includes('startsAt') || message.includes('endsAt')) return '계약 시작일과 종료일 응답이 필요해요'
  if (message.includes('transaction hash')) return '에스크로 트랜잭션 해시 응답이 필요해요'
  if (message.includes('settlement exists')) return '백엔드 정산 응답이 아직 없어요'
  return message
}

function buildTenantRows(app: AppModel, lang: Lang) {
  const c = copy[lang]
  const rows: string[][] = []
  const today = formatDate(new Date()).slice(5).replace('-', '.')
  if (app.tenantAddress) rows.push([c.walletCreated, today, c.tenantWalletCreated, shortHash(app.tenantAddress), 'XRPL'])
  if (app.landlordAddress) rows.push(['', today, c.landlordWalletCreated, shortHash(app.landlordAddress), 'XRPL'])
  if (app.contract) rows.push(['', today, c.be2ContractResponse, app.contract.id, statusText(app.contract.status, lang)])
  if (app.xrplContract) rows.push(['', today, c.be1EscrowResponse, app.xrplContract.id, statusText(app.xrplContract.status, lang)])
  if (app.xrplContract?.depositEscrowTxHash) rows.push(['', today, c.xrplTxCreated, shortHash(app.xrplContract.depositEscrowTxHash), 'XRPL'])
  if (app.chainActions.rentPayment) rows.push(['', today, c.rentPaymentDone, shortHash(app.chainActions.rentPayment.txHash), 'XRPL'])
  if (isAutoReturnDisplayable(app) && app.chainActions.autoReturn) rows.push(['', today, c.autoReturnFeature, shortHash(app.chainActions.autoReturn.txHash), 'XRPL'])
  if (app.chainActions.sbt) rows.push(['', today, c.sbtFeature, shortHash(app.chainActions.sbt.txHash), 'XRPL'])
  if (app.chainActions.remittance) rows.push(['', today, c.remittanceFeature, shortHash(app.chainActions.remittance.txHash), 'XRPL'])
  app.settlements.forEach((settlement, index) => rows.push([index === 0 ? c.settlementResponse : '', today, c.settlementStatus, settlement.id, statusText(settlement.status, lang)]))
  return rows
}

function buildLandlordRows(app: AppModel, lang: Lang) {
  const c = copy[lang]
  const rows: string[][] = []
  const today = formatDate(new Date()).slice(5).replace('-', '.')
  if (app.contract) rows.push([c.contract, today, c.be2ContractResponse, app.contract.id, statusText(app.contract.status, lang)])
  if (app.xrplContract) rows.push(['', today, c.be1EscrowResponse, app.xrplContract.id, statusText(app.xrplContract.status, lang)])
  if (app.chainActions.rentPayment) rows.push([c.rent, today, c.rentPaymentDone, shortHash(app.chainActions.rentPayment.txHash), 'XRPL'])
  if (isAutoReturnDisplayable(app) && app.chainActions.autoReturn) rows.push(['', today, c.autoReturnDone, shortHash(app.chainActions.autoReturn.txHash), 'XRPL'])
  app.settlements.forEach((item, index) => rows.push([index === 0 ? c.settlement : '', today, c.settlementStatus, item.id, statusText(item.status, lang)]))
  return rows
}

function isAutoReturnDisplayable(app: AppModel) {
  const metrics = getLeaseMetrics(app, 'return')
  return Boolean(metrics && metrics.returnLeft.totalMs <= 0)
}

function getParticipantIds(app: AppModel) {
  const tenantId = app.tenantId || app.tenantAddress
  const landlordId = app.landlordId || app.landlordAddress
  if (!tenantId || !landlordId) return undefined
  return { tenantId, landlordId }
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeContractDraft(draft: ContractDraft): ContractDraft {
  return {
    ...draft,
    stakeAmount: deriveStakeAmount(draft.depositAmount),
  }
}

function deriveStakeAmount(depositAmount: string) {
  const deposit = Number(onlyDigits(depositAmount))
  if (!Number.isFinite(deposit) || deposit <= 0) return ''
  return String(Math.round(deposit / 850))
}

function formatPlainNumber(value: string) {
  return Number(value).toLocaleString('en-US')
}

function normalizeDateInput(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

function isContractDraftReady(draft: ContractDraft) {
  const startsAt = parseDate(draft.startsAt)
  const endsAt = parseDate(draft.endsAt)
  return Boolean(
    Number(draft.depositAmount) > 0
    && Number(draft.stakeAmount) > 0
    && startsAt
    && endsAt
    && endsAt.getTime() > startsAt.getTime(),
  )
}

function withContractDraft(contract: BackendContract, draft: ContractDraft): BackendContract {
  const normalized = normalizeContractDraft(draft)
  return {
    ...contract,
    depositAmount: contract.depositAmount || normalized.depositAmount || undefined,
    stakeAmount: normalized.stakeAmount || contract.stakeAmount || undefined,
    startsAt: contract.startsAt || normalized.startsAt || undefined,
    endsAt: contract.endsAt || normalized.endsAt || undefined,
  }
}

function persistDemoContractPayload(payload: DemoContractPayload) {
  if (!isDemoMode()) return
  localStorage.setItem(demoContractPayloadKey, JSON.stringify(payload))
}

function getPreparedContract(app: AppModel) {
  return app.contract ? withContractDraft(app.contract, app.contractDraft) : undefined
}

function getLeaseMetrics(app: AppModel, phase: 'living' | 'return' = 'living') {
  const contract = getPreparedContract(app) ?? app.xrplContract
  const startsAt = parseDate(contract?.startsAt)
  const endsAt = parseDate(contract?.endsAt)
  if (!startsAt || !endsAt) return undefined
  const finishAfter = addDays(endsAt, 7)
  const now = isDemoMode() ? getDemoNow(phase) : new Date()
  const totalMs = Math.max(1, endsAt.getTime() - startsAt.getTime())
  const elapsedMs = clamp(now.getTime() - startsAt.getTime(), 0, totalMs)
  const effectiveNowMs = clamp(now.getTime(), startsAt.getTime(), endsAt.getTime())
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - effectiveNowMs) / dayMs))
  const livedDays = Math.max(0, Math.min(Math.floor((now.getTime() - startsAt.getTime()) / dayMs) + 1, Math.ceil(totalMs / dayMs)))
  const progress = clamp(Math.round((elapsedMs / totalMs) * 100), 0, 100)
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
  const seconds = Math.floor((totalMs % 60_000) / 1_000)
  return { totalMs, days, hours, minutes, seconds }
}

function getDemoRollingDuration(source: ReturnType<typeof splitDuration> | undefined, remainingMs: number, tick: number) {
  if (!source) return splitDuration(remainingMs)
  if (remainingMs <= 220) return splitDuration(0)

  const ratio = clamp(remainingMs / demoReturnCompressionMs, 0, 1)
  const noise = pseudoRandom(tick)
  const jitterWindow = Math.min(dayMs, source.totalMs * 0.035)
  const jitterMs = (noise - 0.5) * jitterWindow * ratio
  return splitDuration(clamp(source.totalMs * ratio + jitterMs, 0, source.totalMs))
}

function pseudoRandom(seed: number) {
  const raw = Math.sin((seed + 1) * 12.9898) * 43758.5453
  return raw - Math.floor(raw)
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

function getBackTarget(id: ScreenId): ScreenId | undefined {
  if ([
    't06', 't10', 't11', 't12', 't13', 't14', 't17', 't18', 't19', 't20',
  ].includes(id)) return 't09'
  if (['l07', 'l08', 'l10', 'l11', 'l12', 'l13'].includes(id)) return 'l06'
  return undefined
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
