/**
 * 테스트넷: 임차인 ↔ 임대인 XRP Payment (서로에게 한 번씩).
 *
 * 필수: 두 지갑의 **시드** (해당 classic 주소와 반드시 일치해야 함)
 *   환경변수 TENANT_SEED, LANDLORD_SEED
 *   또는 .env 에 TENANT_SEED= / LANDLORD_SEED= (이 스크립트가 루트 .env를 읽음)
 *
 * 기대 주소 검증(권장, 오타 방지):
 *   EXPECTED_TENANT=r4A89... EXPECTED_LANDLORD=rMGD...
 *
 * 선택: AMOUNT_DROPS (기본 1_000_000 = 1 XRP), XRPL_NETWORK_URL
 *
 * 사용 예:
 *   cd services/be1-xrpl
 *   EXPECTED_TENANT=r4A89Qf68hUUPTDUtE967TnujjriPsnBmw \
 *   EXPECTED_LANDLORD=rMGDkanDxkS7WMncAkYASEba2J1KeVdVfV \
 *   TENANT_SEED='s...' LANDLORD_SEED='s...' \
 *   node scripts/testnet-peer-xrp.cjs
 */

const fs = require('fs');
const path = require('path');
const { Client, Wallet } = require('xrpl');

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function explorerBase() {
  return (
    process.env.XRPL_EXPLORER_URL || 'https://testnet.xrpl.org'
  ).replace(/\/$/, '');
}

async function main() {
  loadDotEnv();

  const tenantSeed = (process.env.TENANT_SEED || '').trim();
  const landlordSeed = (process.env.LANDLORD_SEED || '').trim();
  const expectedTenant = (process.env.EXPECTED_TENANT || '').trim();
  const expectedLandlord = (process.env.EXPECTED_LANDLORD || '').trim();
  const amountDrops = (process.env.AMOUNT_DROPS || '1000000').trim();
  const ws = (
    process.env.XRPL_NETWORK_URL || 'wss://s.altnet.rippletest.net:51233'
  ).trim();

  if (!tenantSeed || !landlordSeed) {
    console.error(
      'TENANT_SEED / LANDLORD_SEED 가 필요합니다. (해당 r... 주소를 만든 시드)\n' +
        'BE1 내부 지갑 시드를 저장하지 않았다면, XUMM 등에서 같은 주소로 가져오거나 새 지갑으로 다시 PoC 해야 합니다.',
    );
    process.exit(1);
  }

  const tenant = Wallet.fromSeed(tenantSeed);
  const landlord = Wallet.fromSeed(landlordSeed);

  if (expectedTenant && tenant.classicAddress !== expectedTenant) {
    console.error(
      `TENANT_SEED 주소(${tenant.classicAddress})가 EXPECTED_TENANT(${expectedTenant})와 다릅니다.`,
    );
    process.exit(1);
  }
  if (expectedLandlord && landlord.classicAddress !== expectedLandlord) {
    console.error(
      `LANDLORD_SEED 주소(${landlord.classicAddress})가 EXPECTED_LANDLORD(${expectedLandlord})와 다릅니다.`,
    );
    process.exit(1);
  }

  const client = new Client(ws);
  await client.connect();

  const base = explorerBase();

  const pay = async (from, to, label) => {
    const tx = {
      TransactionType: 'Payment',
      Account: from.classicAddress,
      Destination: to.classicAddress,
      Amount: amountDrops,
    };
    const res = await client.submitAndWait(tx, { wallet: from });
    const meta = res.result.meta;
    const ok =
      typeof meta === 'object' &&
      meta !== null &&
      meta.TransactionResult === 'tesSUCCESS';
    if (!ok) {
      throw new Error(
        `${label} failed: ${typeof meta === 'object' && meta ? meta.TransactionResult : 'unknown'}`,
      );
    }
    const hash = res.result.hash;
    console.log(`${label}`);
    console.log(`  tx: ${hash}`);
    console.log(`  ${base}/transactions/${hash}`);
    return hash;
  };

  console.log('임차인:', tenant.classicAddress);
  console.log('임대인:', landlord.classicAddress);
  console.log('금액(drops):', amountDrops);
  console.log('');

  await pay(tenant, landlord, '임차인 → 임대인');
  await pay(landlord, tenant, '임대인 → 임차인');

  await client.disconnect();
  console.log('');
  console.log('계정 페이지:');
  console.log(`  임차인  ${base}/accounts/${tenant.classicAddress}`);
  console.log(`  임대인  ${base}/accounts/${landlord.classicAddress}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
