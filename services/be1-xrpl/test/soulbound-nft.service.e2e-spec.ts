import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SoulboundNftService } from '../src/xrpl/soulbound-nft.service';
import { XrplClientService } from '../src/xrpl/xrpl-client.service';
import { XrplModule } from '../src/xrpl/xrpl.module';

/**
 * 실 XRPL Testnet — NFTokenMint(SBT 유사, tfTransferable 미설정).
 *
 * AppModule 전체를 쓰지 않음(BullMQ/TypeORM 등으로 `app.close()` 지연 방지).
 * `ConfigModule` + `XrplModule`만 로드.
 *
 * 실행: `npm run test:e2e -- test/soulbound-nft.service.e2e-spec.ts`
 */
describe('SoulboundNftService (Testnet integration)', () => {
  let app: INestApplication;
  let soulboundNftService: SoulboundNftService;
  let xrplClient: XrplClientService;

  jest.setTimeout(120_000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env'],
        }),
        XrplModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    soulboundNftService = app.get(SoulboundNftService);
    xrplClient = app.get(XrplClientService);
  }, 60_000);

  afterAll(async () => {
    await app.close();
  }, 30_000);

  it('mints a non-transferable-style NFToken and lists it via account_nfts', async () => {
    const client = xrplClient.getClient();
    const { wallet: minter } = await client.fundWallet();

    const taxon = Math.floor(Math.random() * 65_535);
    const uriUtf8 = JSON.stringify({
      v: 1,
      kind: 'bluesafe/sbt-e2e',
      at: new Date().toISOString(),
    });

    const result = await soulboundNftService.mintSoulboundNft({
      minter,
      taxon,
      uriUtf8,
    });

    expect(result.txHash).toMatch(/^[A-F0-9]{64}$/);
    expect(result.ledgerIndex).toBeGreaterThan(0);
    expect(result.validated).toBe(true);

    const nfts = await client.request({
      command: 'account_nfts',
      account: minter.classicAddress,
      ledger_index: 'validated',
    });

    const list = nfts.result.account_nfts ?? [];
    expect(list.length).toBeGreaterThan(0);

    const ours = list.find((n) => n.NFTokenTaxon === taxon);
    expect(ours).toBeDefined();
    expect(ours!.Issuer).toBe(minter.classicAddress);
  }, 120_000);
});
