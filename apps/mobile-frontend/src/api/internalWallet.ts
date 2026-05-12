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

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `내부지갑 API 요청 실패 (${response.status})`)
  }

  return response.json() as Promise<T>
}

function normalizeWallet(data: WalletConnectResponse): InternalWalletSession {
  const account = data.address || data.account || data.classicAddress || data.wallet?.address || data.wallet?.account || data.wallet?.classicAddress
  if (!account) throw new Error('내부지갑 API 응답에 XRPL 주소가 없어요.')

  return {
    account,
    network: typeof data.network === 'string' ? data.network : data.network?.label || data.network?.id || 'testnet',
    provider: 'BlueSafe Wallet',
  }
}

export async function connectInternalWallet(role: WalletRole) {
  const data = await walletRequest<WalletConnectResponse>('/api/wallet/connect', {
    method: 'POST',
    body: JSON.stringify({ approve: true, role }),
  })

  return normalizeWallet(data)
}
