import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Wallet, dropsToXrp } from 'xrpl';
import { findTrustLine } from './iou-lines.util';

@Injectable()
export class XrplClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XrplClientService.name);
  private client?: Client;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.getOrThrow<string>('XRPL_NETWORK_URL');
    this.client = new Client(url);
    await this.client.connect();
    this.logger.log(`Connected to XRPL: ${url}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
      this.logger.log('Disconnected from XRPL');
    }
  }

  /**
   * Live xrpl.js Client 인스턴스 반환. 미연결 시 throw.
   * 호출자는 client.submitAndWait / client.request 등을 직접 사용.
   */
  getClient(): Client {
    if (!this.client?.isConnected()) {
      throw new Error('XRPL client is not connected');
    }
    return this.client;
  }

  /**
   * 신규 contract account용 wallet 생성 + Testnet faucet으로 fund.
   * 동기 호출이라 응답 시간 길어짐(보통 5-15초) — BullMQ 워커 도입 시 비동기 분리 예정.
   */
  async generateAndFundWallet(): Promise<Wallet> {
    const client = this.getClient();
    const wallet = Wallet.generate();
    const funded = await client.fundWallet(wallet);
    this.logger.log(
      `Wallet funded: address=${funded.wallet.classicAddress} balance=${funded.balance}XRP`,
    );
    return funded.wallet;
  }

  /**
   * Testnet에서 TrustSet/Payment 수수료용 XRP가 부족하면 faucet으로 보충.
   * 계정이 없거나 잔액이 min 미만이면 fundWallet 호출.
   */
  async ensureTestnetXrpForFees(wallet: Wallet): Promise<void> {
    const client = this.getClient();
    const minDrops = 3_000_000n;
    try {
      const r = await client.request({
        command: 'account_info',
        account: wallet.classicAddress,
        ledger_index: 'validated',
      });
      const drops = BigInt(r.result.account_data.Balance);
      if (drops >= minDrops) return;
    } catch {
      /* account 없음 */
    }
    await client.fundWallet(wallet);
  }

  /** account의 XRP 잔액(소수점 표기) 반환 */
  async getXrpBalance(address: string): Promise<string> {
    const client = this.getClient();
    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    });
    const balanceDrops = response.result.account_data.Balance;
    return dropsToXrp(balanceDrops).toString();
  }

  /** 계약 계정이 보유한 IOU 잔액(없으면 null). */
  async getIouBalance(
    account: string,
    issuer: string,
    currency: string,
  ): Promise<{ currency: string; issuer: string; value: string } | null> {
    const line = await findTrustLine(
      this.getClient(),
      account,
      issuer,
      currency,
    );
    if (!line) return null;
    return {
      currency: line.currency,
      issuer,
      value: line.balance,
    };
  }
}
