export type DemoRole = 'tenant' | 'landlord'

export const demoContractTerms = {
  depositAmount: '15000000',
  stakeAmount: '17647',
  startsAt: '2026-06-01',
  endsAt: '2027-05-31',
}

export const demoAddresses: Record<DemoRole, string> = {
  tenant: 'rTenantBlueSafeDemo5Z9xV7K2QeF',
  landlord: 'rLandlordBlueSafeDemo8KQ91DLM2',
}

export const demoIds = {
  be2Contract: 'ctr_demo_8KQ91DLM2',
  be1Contract: 'be1_demo_8KQ91DLM2',
  settlement: 'settlement_demo_0607',
  txHash: 'F2A8D0E16C7E4A92B3C54D6F778899AABBCCDDEEFF00112233445566778891D3',
  signerTxHash: 'A8D1B8E77C90195A3388D56B909A4426C75EF3B211336CA0C10DD9A11C0E5B1A',
  contractAccount: 'rBlueSafeVaultDemo3A7kQ9mT2',
}

const demoNowByPhase = {
  living: '2026-08-22T09:00:00+09:00',
  return: '2027-05-31T09:28:00+09:00',
}

export function isDemoMode() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('demo') === '0') return false
  return params.get('demo') === '1' || localStorage.getItem('bluesafe-demo-mode') === '1'
}

export function isRealDemoTxMode() {
  if (!isDemoMode()) return false
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('tx') !== 'mock'
}

export function getDemoSessionId() {
  if (typeof window === 'undefined') return demoIds.be2Contract
  const params = new URLSearchParams(window.location.search)
  return params.get('demoSession') || params.get('contractId') || demoIds.be2Contract
}

export function getDemoNow(phase: keyof typeof demoNowByPhase = 'living') {
  if (typeof window === 'undefined') return new Date(demoNowByPhase[phase])
  const params = new URLSearchParams(window.location.search)
  return new Date(params.get('demoNow') || demoNowByPhase[phase])
}

export function enableDemoModeFromUrl() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get('demo') === '1') localStorage.setItem('bluesafe-demo-mode', '1')
  if (params.get('demo') === '0') localStorage.removeItem('bluesafe-demo-mode')
}

export function demoIso(date: string) {
  return new Date(`${date}T00:00:00+09:00`).toISOString()
}
