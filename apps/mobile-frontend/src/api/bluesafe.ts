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
  startsAt?: string
  endsAt?: string
  updatedAt?: string
}

export type EvidenceFile = {
  id: string
  contractId: string
  cid?: string
  sha256?: string
  category?: string
  version?: number
  createdAt?: string
}

type EvidenceUploadResponse = {
  evidenceId: string
  cid: string
  sha256: string
  version: number
  createdAt: string
  encryptionScheme?: string
  retainUntil?: string
  retentionClass?: string
}

export type DisputeCase = {
  id: string
  contractId: string
  status: 'filed' | 'under_review' | 'decided' | 'execution_pending' | 'executed' | 'closed' | 'rejected'
  reasonCode: string
  raisedBy: 'tenant' | 'landlord' | 'operator'
  decision?: string
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

const be1Url = trimSlash(import.meta.env.VITE_BE1_URL)
const be2Url = trimSlash(import.meta.env.VITE_BE2_URL)
const authToken = import.meta.env.VITE_BLUESAFE_AUTH_TOKEN?.trim()

export const backendConfig = {
  be1Url,
  be2Url,
  hasBe1: Boolean(be1Url),
  hasBe2: Boolean(be2Url),
}

function trimSlash(value: unknown) {
  return typeof value === 'string' ? value.replace(/\/$/, '') : ''
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  if (!baseUrl) {
    throw new Error('Backend URL is not configured')
  }

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

export const bluesafeApi = {
  healthBe2() {
    return request<{ ok: boolean; service: string }> (be2Url, '/health')
  },

  createOperationalContract(input: { tenantId: string; landlordId: string }) {
    return request<BackendContract>(be2Url, '/v1/contracts', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateOperationalContractStatus(contractId: string, status: ContractStatus) {
    return request<BackendContract>(be2Url, `/v1/contracts/${contractId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  anchorEscrow(contractId: string, txHash: string) {
    return request<BackendContract>(be2Url, `/v1/contracts/${contractId}/escrow-anchor`, {
      method: 'PATCH',
      body: JSON.stringify({ txHash }),
    })
  },

  listSettlements(contractId: string) {
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
    return request<SettlementRecord>(be2Url, `/v1/settlements/${settlementId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  uploadEvidence(input: {
    contractId: string
    category: 'contract_pdf' | 'utility_bill' | 'photo' | 'receipt' | 'other'
    uploaderId: string
    fileName: string
    content?: string
    file?: Blob
    disputeId?: string
    retentionDays?: number
  }) {
    const form = new FormData()
    form.set('contractId', input.contractId)
    form.set('category', input.category)
    form.set('uploaderId', input.uploaderId)
    if (input.disputeId) form.set('disputeId', input.disputeId)
    if (input.retentionDays) form.set('retentionDays', String(input.retentionDays))
    const file = input.file ?? new Blob([input.content ?? ''], { type: 'text/plain' })
    form.set('file', file, input.fileName)
    return request<EvidenceUploadResponse>(be2Url, '/v1/evidences', {
      method: 'POST',
      body: form,
    }).then((evidence) => ({
      id: evidence.evidenceId,
      contractId: input.contractId,
      cid: evidence.cid,
      sha256: evidence.sha256,
      category: input.category,
      version: evidence.version,
      createdAt: evidence.createdAt,
    }))
  },

  createDispute(input: {
    contractId: string
    raisedBy: 'tenant' | 'landlord' | 'operator'
    reasonCode: string
    evidenceIds: string[]
  }) {
    return request<DisputeCase>(be2Url, '/v1/disputes', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  decideDispute(disputeId: string, decision: 'finish_to_tenant' | 'finish_to_landlord' | 'cancel_to_owner' | 'partial_manual', memo?: string) {
    return request<DisputeCase>(be2Url, `/v1/disputes/${disputeId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, memo }),
    })
  },

  trackTx(input: { txHash: string; txType: string; account?: string; network?: 'testnet' | 'mainnet' }) {
    return request(be2Url, '/v1/xrpl/track', {
      method: 'POST',
      body: JSON.stringify({ network: 'testnet', ...input }),
    })
  },

  createXrplContract(input: CreateBe1ContractInput) {
    return request<BackendContract>(be1Url, '/contracts', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getXrplContract(contractId: string) {
    return request<BackendContract>(be1Url, `/contracts/${contractId}`)
  },

  getXrplBalance(contractId: string) {
    return request<{
      contractId: string
      address: string
      balanceXrp: string
      balanceIou?: { currency: string; issuer: string; value: string } | null
    }>(be1Url, `/contracts/${contractId}/balance`)
  },
}
