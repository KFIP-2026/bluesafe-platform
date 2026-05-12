type WalletRole = 'tenant' | 'landlord'

const walletBaseUrl = (
  (import.meta.env.VITE_WALLET_API_URL as string | undefined)
  || (import.meta.env.VITE_BE1_URL as string | undefined)
  || ''
).replace(/\/$/, '')

type WalletConnectResponse = {
  address?: string
  account?: string
  classicAddress?: string
  network?: string | {
    id?: string
    label?: string
    rpcEndpoint?: string
  }
  rpcEndpoint?: string
  connected?: boolean
  wallet?: {
    address?: string
    account?: string
    classicAddress?: string
  }
}

export type InternalWalletSession = {
  account: string
  network: string
  provider: string
}

async function walletRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${walletBaseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const text = await response.text()
  const data = parseResponseBody(text)

  if (!response.ok) {
    const message = typeof data === 'string' ? data : data?.message || data?.error || ''
    throw new Error(message || `Wallet API request failed (${response.status})`)
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

function normalizeWallet(data: WalletConnectResponse): InternalWalletSession {
  const account = data.address || data.account || data.classicAddress || data.wallet?.address || data.wallet?.account || data.wallet?.classicAddress
  if (!account) throw new Error('Wallet API response did not include an XRPL address')

  return {
    account,
    network: typeof data.network === 'string' ? data.network : data.network?.label || data.network?.id || 'testnet',
    provider: 'BlueSafe Wallet',
  }
}

export type InternalWalletIouFundResult = {
  message: string
  role: string
  address: string
  issuer: string
  currency: string
  amount: string
  trustSetTxHash: string
  paymentTxHash: string
  explorerPaymentUrl: string
  network: string
}

export async function connectInternalWallet(role: WalletRole) {
  const data = await walletRequest<WalletConnectResponse>('/api/wallet/connect', {
    method: 'POST',
    body: JSON.stringify({ approve: true, role }),
  })

  return normalizeWallet(data)
}

/** 내부 지갑에 IOU 입금 (BE1 `POST /api/wallet/fund-iou`). 운영자 시드에 IOU 잔액 필요. */
export async function fundInternalWalletIou(input?: {
  role?: WalletRole
  issuer?: string
  currency?: string
  amount?: string
}) {
  return walletRequest<InternalWalletIouFundResult>('/api/wallet/fund-iou', {
    method: 'POST',
    body: JSON.stringify({
      role: input?.role,
      issuer: input?.issuer,
      currency: input?.currency,
      amount: input?.amount,
    }),
  })
}
