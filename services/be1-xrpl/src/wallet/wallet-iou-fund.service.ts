import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Client, Payment } from 'xrpl';
import { Wallet } from 'xrpl';
import { TrustSetService } from '../xrpl/trust-set.service';
import {
  buildIouAmount,
  findTrustLine,
  normalizeIouCurrencyCode,
} from '../xrpl/iou-lines.util';
import { XrplClientService } from '../xrpl/xrpl-client.service';
import type { FundIouWalletDto } from './dto/fund-iou-wallet.dto';
import { WalletService } from './wallet.service';

type WalletRole = 'tenant' | 'landlord';

@Injectable()
export class WalletIouFundService {
  private readonly logger = new Logger(WalletIouFundService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly xrplClient: XrplClientService,
    private readonly trustSetService: TrustSetService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 내부 지갑(role)에 IOU 입금: (필요 시) 테스트넷 XRP 보충 → TrustSet → Payment.
   * `XRPL_IOU_ISSUER_SEED`가 있으면 발행자 계정에서 직접 발행·전송(권장).
   * 없으면 `XRPL_OPERATOR_SEED` 지갑에서 전송 — XRPL Testnet(altnet)이면 RLUSD 등 잔액이 부족할 때 XRP로 DEX 자동 매입을 시도함.
   */
  async fundInternalWallet(dto: FundIouWalletDto) {
    const role: WalletRole = dto.role ?? 'tenant';
    const operatorSeed = this.config.get<string>('XRPL_OPERATOR_SEED')?.trim();
    const issuerSeed = this.config.get<string>('XRPL_IOU_ISSUER_SEED')?.trim();
    if (!operatorSeed && !issuerSeed) {
      throw new BadRequestException(
        'XRPL_IOU_ISSUER_SEED(발행 직접) 또는 XRPL_OPERATOR_SEED(보유분 전송) 중 하나는 필요합니다.',
      );
    }

    let issuer =
      dto.issuer?.trim() ||
      this.config.get<string>('XRPL_IOU_ISSUER')?.trim() ||
      '';
    let currency =
      dto.currency?.trim() ||
      this.config.get<string>('XRPL_IOU_CURRENCY')?.trim() ||
      '';
    if (!issuer || !currency) {
      throw new BadRequestException(
        'issuer/currency 를 요청에 넣거나 XRPL_IOU_ISSUER / XRPL_IOU_CURRENCY 를 설정하세요.',
      );
    }
    currency = normalizeIouCurrencyCode(currency);

    const amountRaw =
      dto.amount?.trim() ||
      this.config.get<string>('XRPL_WALLET_IOU_FUND_AMOUNT')?.trim() ||
      '1';
    if (!/^\d+(\.\d{1,16})?$/.test(amountRaw)) {
      throw new BadRequestException('amount 형식이 올바르지 않습니다.');
    }

    const recipient = this.walletService.getWalletForRole(role);
    const client = this.xrplClient.getClient();

    await this.xrplClient.ensureTestnetXrpForFees(recipient);

    let fundingWallet: Wallet;
    if (issuerSeed) {
      fundingWallet = Wallet.fromSeed(issuerSeed);
      if (fundingWallet.classicAddress !== issuer) {
        throw new BadRequestException(
          `XRPL_IOU_ISSUER_SEED 주소(${fundingWallet.classicAddress})가 XRPL_IOU_ISSUER(${issuer})와 일치하지 않습니다.`,
        );
      }
      await this.xrplClient.ensureTestnetXrpForFees(fundingWallet);
    } else {
      fundingWallet = Wallet.fromSeed(operatorSeed!);
      await this.xrplClient.ensureTestnetXrpForFees(fundingWallet);
      await this.ensureOperatorIouForPayment(
        client,
        fundingWallet,
        issuer,
        currency,
        amountRaw,
      );
    }

    const trustLimit = '1000000000';
    const limitAmount = buildIouAmount(issuer, currency, trustLimit);
    const trustRes = await this.trustSetService.submitTrustSet(
      recipient,
      limitAmount,
    );
    this.logger.log(
      `Internal wallet TrustSet: role=${role} addr=${recipient.classicAddress} tx=${trustRes.txHash}`,
    );

    const payAmount = buildIouAmount(issuer, currency, amountRaw);
    const pay: Payment = {
      TransactionType: 'Payment',
      Account: fundingWallet.classicAddress,
      Destination: recipient.classicAddress,
      Amount: payAmount,
    };
    const payRes = await client.submitAndWait(pay, { wallet: fundingWallet });
    TrustSetService.assertTxSuccess(payRes);
    const paymentTxHash = payRes.result.hash;
    this.logger.log(
      `Internal wallet IOU funded: role=${role} amount=${amountRaw} ${currency} tx=${paymentTxHash}`,
    );

    const explorerBase = (
      this.config.get<string>('XRPL_EXPLORER_URL') ?? 'https://testnet.xrpl.org'
    ).replace(/\/$/, '');

    return {
      message: 'IOU funded to internal wallet.',
      role,
      address: recipient.classicAddress,
      issuer,
      currency,
      amount: amountRaw,
      trustSetTxHash: trustRes.txHash,
      paymentTxHash,
      explorerPaymentUrl: `${explorerBase}/transactions/${paymentTxHash}`,
      network: this.walletService.getNetworkLabel(),
    };
  }

  /** 운영자에게 대상 issuer IOU trust + 잔액(테스트넷이면 DEX로 XRP→IOU 보충). */
  private async ensureOperatorIouForPayment(
    client: Client,
    operator: Wallet,
    issuer: string,
    currency: string,
    needValue: string,
  ): Promise<void> {
    const trustLimit = '1000000000';
    const limitAmount = buildIouAmount(issuer, currency, trustLimit);
    let line = await findTrustLine(
      client,
      operator.classicAddress,
      issuer,
      currency,
    );
    if (!line) {
      await this.trustSetService.submitTrustSet(operator, limitAmount);
      line = await findTrustLine(
        client,
        operator.classicAddress,
        issuer,
        currency,
      );
    }

    const need = parseFloat(needValue);
    if (!Number.isFinite(need) || need <= 0) {
      throw new BadRequestException('amount 가 올바르지 않습니다.');
    }

    let balance = parseFloat(line?.balance ?? '0');
    if (balance >= need) return;

    if (!this.isRippleAltnetTestnet()) {
      throw new BadRequestException(
        `운영자 지갑(${operator.classicAddress})의 IOU 잔액이 부족합니다. 필요 ${needValue}, 보유 ${line?.balance ?? '0'}. 메인넷은 자동 매입하지 않습니다. XRPL_IOU_ISSUER_SEED 또는 수동 입금을 사용하세요.`,
      );
    }

    for (let i = 0; i < 8 && balance < need; i++) {
      const shortfall = (need - balance).toFixed(10).replace(/\.?0+$/, '') || '0';
      await this.buyIouWithXrpViaPathFind(
        client,
        operator,
        issuer,
        currency,
        shortfall,
      );
      const again = await findTrustLine(
        client,
        operator.classicAddress,
        issuer,
        currency,
      );
      balance = parseFloat(again?.balance ?? '0');
    }

    if (balance < need) {
      throw new BadRequestException(
        `테스트넷 DEX로 IOU를 채우지 못했습니다. 필요 ${needValue}, 보유 ${balance}. tryrlusd.com 등으로 운영자 지갑(${operator.classicAddress})에 입금하거나 XRPL_IOU_ISSUER_SEED를 설정하세요.`,
      );
    }
  }

  private isRippleAltnetTestnet(): boolean {
    const u = (this.config.get<string>('XRPL_NETWORK_URL') ?? '').toLowerCase();
    return u.includes('altnet.rippletest.net');
  }

  /**
   * path_find로 필요 XRP(드롭)를 구한 뒤, 동일 계정으로 Payment(SendMax XRP → Amount IOU) 실행.
   * 테스트넷 RLUSD 오더북 유동 가정.
   */
  private async buyIouWithXrpViaPathFind(
    client: Client,
    buyer: Wallet,
    issuer: string,
    currency: string,
    iouValue: string,
  ): Promise<void> {
    const dest = buildIouAmount(issuer, currency, iouValue);
    let pathClose = false;
    try {
      const pf = await client.request({
        command: 'path_find',
        subcommand: 'create',
        source_account: buyer.classicAddress,
        destination_account: buyer.classicAddress,
        destination_amount: dest,
      });
      pathClose = true;
      const alt = pf.result.alternatives?.[0] as
        | { source_amount?: string }
        | undefined;
      const src = alt?.source_amount;
      if (!src) {
        throw new BadRequestException(
          'DEX 경로를 찾지 못했습니다. IOU issuer/통화를 확인하거나 수동으로 운영자 지갑에 입금하세요.',
        );
      }
      const sendMax = ((BigInt(src) * 110n) / 100n).toString();
      const pay: Payment = {
        TransactionType: 'Payment',
        Account: buyer.classicAddress,
        Destination: buyer.classicAddress,
        Amount: dest,
        SendMax: sendMax,
      };
      const payRes = await client.submitAndWait(pay, { wallet: buyer });
      TrustSetService.assertTxSuccess(payRes);
      this.logger.log(
        `Operator DEX buy IOU: ${iouValue} (issuer ${issuer}) tx=${payRes.result.hash}`,
      );
    } finally {
      if (pathClose) {
        try {
          await client.request({ command: 'path_find', subcommand: 'close' });
        } catch {
          /* ignore */
        }
      }
    }
  }
}
