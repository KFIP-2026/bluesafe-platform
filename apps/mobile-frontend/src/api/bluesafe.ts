import { demoAddresses, demoIds, demoIso, isDemoMode, isRealDemoTxMode } from '../demoMode'

export type ContractStatus =
  | 'draft'
  | 'escrow_pending'
  | 'escrow_validated'
  | 'active'
  | 'closed'
  | 'cancelled'

export type BackendContract = {
  id: string
  status: ContractStatus
  tenantId?: string
  landlordId?: string
  tenantAddress?: string
  landlordAddress?: string
  contractAccountAddress?: string | null
  depositAmount?: string
  stakeAmount?: string
  depositEscrowTxHash?: string | null
  depositEscrowSequence?: number | null
  signerListTxHash?: string | null
  explorerUrl?: string | null
  txKind?: string | null
  network?: string | null
  startsAt?: string
  endsAt?: string
  updatedAt?: string
}

export type SettlementRecord = {
  id: string
  contractId: string
  status: 'collecting' | 'accrued' | 'confirmed' | 'archived'
  amountMinor?: number
  currencyCode?: string
  periodYear?: number
  periodMonth?: number
}

export type ChainTxReceipt = {
  txHash: string
  txType: string
  network: string
  explorerUrl?: string
  amountDrops?: string
  sourceAddress?: string
  destinationAddress?: string
  owner?: string
  offerSequence?: number
  ledgerIndex?: number
}

export type DemoSessionResponse<T> = {
  sessionId: string
  state: T
  updatedAt: string
} | null

export type CreateBe1ContractInput = {
  tenantAddress: string
  landlordAddress: string
  depositAmount: string
  stakeAmount: string
  startsAt: string
  endsAt: string
  finishAfter: string
  cancelAfter: string
  tenantPii: string
  landlordPii: string
  tenantEmail?: string
  /** 기본 XRP(drops). IOU면 소수 value + 사전 trust line 필요 */
  assetMode?: 'XRP' | 'IOU'
  iouIssuer?: string
  iouCurrency?: string
}

type DemoEscrowResponse = {
  tenantAddress: string
  landlordAddress: string
  amountDrops: string
  escrowTxHash: string
  escrowSequence: number
  explorerBase: string
  links: {
    escrow: string
    tenantAccount: string
    landlordAccount: string
  }
}

type DemoPaymentResponse = {
  sourceAddress: string
  destinationAddress: string
  amountDrops: string
  txHash: string
  txType: 'Payment'
  network: 'XRPL Testnet'
  links: {
    payment: string
  }
}

type DemoEscrowFinishResponse = {
  owner: string
  offerSequence: number
  txHash: string
  txType: 'EscrowFinish'
  network: 'XRPL Testnet'
  links: {
    transaction: string
  }
}

type DemoSbtResponse = {
  minterAddress: string
  txHash: string
  txType: 'NFTokenMint'
  ledgerIndex: number
  network: 'XRPL Testnet'
  links: {
    transaction: string
  }
}

const be1Url = trimSlash(import.meta.env.VITE_BE1_URL)
const be2Url = trimSlash(import.meta.env.VITE_BE2_URL)
const authToken = import.meta.env.VITE_BLUESAFE_AUTH_TOKEN?.trim()
const xrplNetwork = parseXrplNetwork(import.meta.env.VITE_XRPL_NETWORK)
const demoContractPayloadKey = 'bluesafe-demo-contract-payload'

export const backendConfig = {
  be1Url,
  be2Url,
  hasBe1: true,
  hasBe2: true,
}

function trimSlash(value: unknown) {
  return typeof value === 'string' ? value.replace(/\/$/, '') : ''
}

function parseXrplNetwork(value: unknown) {
  return value === 'testnet' || value === 'mainnet' ? value : undefined
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  const text = await response.text()
  const data = parseResponseBody(text)

  if (!response.ok) {
    const message = typeof data === 'string'
      ? data
      : data?.message || data?.errorCode || `${response.status} ${response.statusText}`
    throw new Error(message)
  }
  return data as T
}

function parseResponseBody(text: string) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function demoOperationalContract(input: {
  tenantId: string
  landlordId: string
  depositAmount?: string
  stakeAmount?: string
  startsAt?: string
  endsAt?: string
  status?: ContractStatus
  txHash?: string | null
}): BackendContract {
  const persisted = readDemoContractPayload()
  return {
    id: demoIds.be2Contract,
    status: input.status ?? 'draft',
    tenantId: input.tenantId,
    landlordId: input.landlordId,
    tenantAddress: demoAddresses.tenant,
    landlordAddress: demoAddresses.landlord,
    contractAccountAddress: input.txHash ? demoIds.contractAccount : null,
    depositAmount: input.depositAmount ?? persisted.depositAmount ?? '15000000',
    stakeAmount: input.stakeAmount ?? persisted.stakeAmount ?? '17647',
    startsAt: input.startsAt ?? persisted.startsAt ?? demoIso('2026-06-01'),
    endsAt: input.endsAt ?? persisted.endsAt ?? demoIso('2027-05-31'),
    depositEscrowTxHash: input.txHash ?? null,
    depositEscrowSequence: input.txHash ? 913 : null,
    signerListTxHash: input.txHash ? demoIds.signerTxHash : null,
    updatedAt: new Date().toISOString(),
  }
}

function readDemoContractPayload() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(demoContractPayloadKey)
    return raw ? JSON.parse(raw) as Partial<BackendContract> : {}
  } catch {
    return {}
  }
}

function demoXrplContract(input: CreateBe1ContractInput): BackendContract {
  return {
    id: demoIds.be1Contract,
    status: 'escrow_validated',
    tenantAddress: input.tenantAddress,
    landlordAddress: input.landlordAddress,
    contractAccountAddress: demoIds.contractAccount,
    depositAmount: input.depositAmount,
    stakeAmount: input.stakeAmount,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    depositEscrowTxHash: demoIds.txHash,
    depositEscrowSequence: 913,
    signerListTxHash: demoIds.signerTxHash,
    explorerUrl: `https://testnet.xrpl.org/transactions/${demoIds.txHash}`,
    txKind: 'EscrowCreate',
    network: 'XRPL Testnet',
    updatedAt: new Date().toISOString(),
  }
}

async function demoRealTxContract(input: CreateBe1ContractInput): Promise<BackendContract> {
  const tx = await request<DemoEscrowResponse>(be1Url, '/api/wallet/demo-escrow', {
    method: 'POST',
    body: JSON.stringify({ amountDrops: '100000' }),
  })
  return {
    id: `be1_real_${tx.escrowTxHash.slice(0, 10)}`,
    status: 'escrow_validated',
    tenantAddress: tx.tenantAddress,
    landlordAddress: tx.landlordAddress,
    contractAccountAddress: tx.tenantAddress,
    depositAmount: input.depositAmount,
    stakeAmount: input.stakeAmount,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    depositEscrowTxHash: tx.escrowTxHash,
    depositEscrowSequence: tx.escrowSequence,
    signerListTxHash: null,
    explorerUrl: tx.links.escrow,
    txKind: 'EscrowCreate',
    network: 'XRPL Testnet',
    updatedAt: new Date().toISOString(),
  }
}

function demoSettlement(contractId: string, status: SettlementRecord['status'] = 'accrued'): SettlementRecord {
  return {
    id: demoIds.settlement,
    contractId,
    status,
    amountMinor: 14956000,
    currencyCode: 'KRW',
    periodYear: 2027,
    periodMonth: 6,
  }
}

function demoMockTx(label: string, txType: string, meta: Partial<ChainTxReceipt> = {}): ChainTxReceipt {
  const txHash = `${demoIds.txHash.slice(0, 54)}${label.padEnd(10, '0').slice(0, 10)}`.slice(0, 64)
  return {
    txHash,
    txType,
    network: 'XRPL Testnet',
    amountDrops: '100000',
    ...meta,
  }
}

function mapPaymentTx(tx: DemoPaymentResponse): ChainTxReceipt {
  return {
    txHash: tx.txHash,
    txType: tx.txType,
    network: tx.network,
    explorerUrl: tx.links.payment,
    amountDrops: tx.amountDrops,
    sourceAddress: tx.sourceAddress,
    destinationAddress: tx.destinationAddress,
  }
}

function mapMutationTx(tx: DemoEscrowFinishResponse | DemoSbtResponse): ChainTxReceipt {
  return {
    txHash: tx.txHash,
    txType: tx.txType,
    network: tx.network,
    explorerUrl: tx.links.transaction,
    owner: 'owner' in tx ? tx.owner : undefined,
    offerSequence: 'offerSequence' in tx ? tx.offerSequence : undefined,
    ledgerIndex: 'ledgerIndex' in tx ? tx.ledgerIndex : undefined,
  }
}

export const bluesafeApi = {
  getDemoSession<T>(sessionId: string) {
    return request<DemoSessionResponse<T>>(be1Url, `/api/wallet/demo-session/${encodeURIComponent(sessionId)}`)
  },

  saveDemoSession<T>(sessionId: string, state: T) {
    return request<DemoSessionResponse<T>>(be1Url, `/api/wallet/demo-session/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: JSON.stringify(state),
    })
  },

  clearDemoSession(sessionId: string) {
    return request<{ sessionId: string; cleared: boolean }>(be1Url, `/api/wallet/demo-session/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    })
  },

  healthBe2() {
    if (isDemoMode()) return Promise.resolve({ ok: true, service: 'be2-demo' })
    return request<{ ok: boolean; service: string }> (be2Url, '/health')
  },

  createOperationalContract(input: {
    tenantId: string
    landlordId: string
    depositAmount?: string
    stakeAmount?: string
    startsAt?: string
    endsAt?: string
  }) {
    if (isDemoMode()) return Promise.resolve(demoOperationalContract(input))
    return request<BackendContract>(be2Url, '/v1/contracts', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateOperationalContractStatus(contractId: string, status: ContractStatus) {
    if (isDemoMode()) {
      return Promise.resolve(demoOperationalContract({
        tenantId: demoAddresses.tenant,
        landlordId: demoAddresses.landlord,
        status,
      }))
    }
    return request<BackendContract>(be2Url, `/v1/contracts/${contractId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  anchorEscrow(contractId: string, txHash: string) {
    if (isDemoMode()) {
      return Promise.resolve(demoOperationalContract({
        tenantId: demoAddresses.tenant,
        landlordId: demoAddresses.landlord,
        status: 'escrow_validated',
        txHash,
      }))
    }
    return request<BackendContract>(be2Url, `/v1/contracts/${contractId}/escrow-anchor`, {
      method: 'PATCH',
      body: JSON.stringify({ txHash }),
    })
  },

  listSettlements(contractId: string) {
    if (isDemoMode()) return Promise.resolve({ count: 1, items: [demoSettlement(contractId)] })
    return request<{ count: number; items: SettlementRecord[] }>(
      be2Url,
      `/v1/settlements?contractId=${encodeURIComponent(contractId)}`,
    )
  },

  updateSettlementStatus(
    settlementId: string,
    input: {
      status?: 'accrued' | 'confirmed' | 'archived'
      amountMinor?: number
      currencyCode?: string
      batchId?: string
    },
  ) {
    if (isDemoMode()) return Promise.resolve(demoSettlement(settlementId, input.status ?? 'confirmed'))
    return request<SettlementRecord>(be2Url, `/v1/settlements/${settlementId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  trackTx(input: { txHash: string; txType: string; account?: string; network?: 'testnet' | 'mainnet' }) {
    if (isDemoMode()) return Promise.resolve({ ok: true, ...input })
    const body = xrplNetwork && !input.network ? { network: xrplNetwork, ...input } : input
    return request(be2Url, '/v1/xrpl/track', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  createXrplContract(input: CreateBe1ContractInput) {
    if (isDemoMode()) return isRealDemoTxMode() ? demoRealTxContract(input) : Promise.resolve(demoXrplContract(input))
    return request<BackendContract>(be1Url, '/contracts', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getXrplContract(contractId: string) {
    if (isDemoMode()) {
      return Promise.resolve(demoXrplContract({
        tenantAddress: demoAddresses.tenant,
        landlordAddress: demoAddresses.landlord,
        depositAmount: '15000000',
        stakeAmount: '17647',
        startsAt: demoIso('2026-06-01'),
        endsAt: demoIso('2027-05-31'),
        finishAfter: demoIso('2027-06-07'),
        cancelAfter: demoIso('2027-06-30'),
        tenantPii: demoAddresses.tenant,
        landlordPii: demoAddresses.landlord,
      }))
    }
    return request<BackendContract>(be1Url, `/contracts/${contractId}`)
  },

  getXrplBalance(contractId: string) {
    if (isDemoMode()) {
      return Promise.resolve({
        contractId,
        address: demoIds.contractAccount,
        balanceXrp: '17647',
      })
    }
    return request<{
      contractId: string
      address: string
      balanceXrp: string
      balanceIou?: { currency: string; issuer: string; value: string } | null
    }>(be1Url, `/contracts/${contractId}/balance`)
  },

  createRentPayment(input?: { amountDrops?: string }) {
    if (isDemoMode() && !isRealDemoTxMode()) return Promise.resolve(demoMockTx('RENT', 'Payment', {
      sourceAddress: demoAddresses.tenant,
      destinationAddress: demoAddresses.landlord,
      amountDrops: input?.amountDrops ?? '100000',
    }))
    return request<DemoPaymentResponse>(be1Url, '/api/wallet/demo-rent-payment', {
      method: 'POST',
      body: JSON.stringify({
        amountDrops: input?.amountDrops ?? '100000',
        fromRole: 'tenant',
        toRole: 'landlord',
        memo: 'BlueSafe monthly rent',
      }),
    }).then(mapPaymentTx)
  },

  finishEscrow(input: { owner: string; offerSequence: number }) {
    if (isDemoMode() && !isRealDemoTxMode()) return Promise.resolve(demoMockTx('RETURN', 'EscrowFinish'))
    return request<DemoEscrowFinishResponse>(be1Url, '/api/wallet/demo-escrow-finish', {
      method: 'POST',
      body: JSON.stringify({
        owner: input.owner,
        offerSequence: String(input.offerSequence),
      }),
    }).then(mapMutationTx)
  },

  mintReputationSbt() {
    if (isDemoMode() && !isRealDemoTxMode()) return Promise.resolve(demoMockTx('SBT', 'NFTokenMint'))
    return request<DemoSbtResponse>(be1Url, '/api/wallet/demo-sbt', {
      method: 'POST',
      body: JSON.stringify({
        role: 'tenant',
        taxon: '20260513',
        uriUtf8: 'bluesafe://reputation/spring/97',
      }),
    }).then(mapMutationTx)
  },

  createRemittance(input: { destinationAddress: string; amountDrops?: string }) {
    if (isDemoMode() && !isRealDemoTxMode()) return Promise.resolve(demoMockTx('FX', 'Payment', {
      sourceAddress: demoAddresses.tenant,
      destinationAddress: input.destinationAddress,
      amountDrops: input.amountDrops ?? '100000',
    }))
    return request<DemoPaymentResponse>(be1Url, '/api/wallet/demo-remittance', {
      method: 'POST',
      body: JSON.stringify({
        amountDrops: input.amountDrops ?? '100000',
        fromRole: 'tenant',
        destinationAddress: input.destinationAddress,
        memo: 'BlueSafe remittance demo',
      }),
    }).then(mapPaymentTx)
  },
}
