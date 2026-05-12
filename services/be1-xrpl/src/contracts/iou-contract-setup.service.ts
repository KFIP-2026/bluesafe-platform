import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Wallet } from 'xrpl';
import type { Payment } from 'xrpl';
import { Wallet as XrplWallet } from 'xrpl';
import { TrustSetService } from '../xrpl/trust-set.service';
import { XrplClientService } from '../xrpl/xrpl-client.service';
import {
  buildIouAmount,
  findTrustLine,
  iouValueGte,
  normalizeIouCurrencyCode,
  sumIouValueStrings,
} from '../xrpl/iou-lines.util';

/**
 * IOU(RLUSD 등) 계약 전 — 당사자 trust line 검증, 계약 계정 trust + 운영자에서 입금.
 * 임차인/임대인 주소는 외부 지갑일 수 있으므로, 사전에 해당 issuer에 대한 trust line이 있어야 함.
 */
@Injectable()
export class IouContractSetupService {
  private readonly logger = new Logger(IouContractSetupService.name);

  constructor(
    private readonly xrplClient: XrplClientService,
    private readonly trustSetService: TrustSetService,
    private readonly config: ConfigService,
  ) {}

  async assertCounterpartyTrustLines(params: {
    tenantAddress: string;
    landlordAddress: string;
    issuer: string;
    currency: string;
    depositValue: string;
    stakeValue: string;
  }): Promise<void> {
    const client = this.xrplClient.getClient();
    const { issuer, currency } = params;
    const cur = normalizeIouCurrencyCode(currency);

    const tenantLine = await findTrustLine(
      client,
      params.tenantAddress,
      issuer,
      cur,
    );
    if (!tenantLine || !iouValueGte(tenantLine.limit, params.depositValue)) {
      throw new BadRequestException(
        `임차인(${params.tenantAddress}) 계정에 issuer ${issuer} 통화 ${cur} trust line이 없거나 limit이 depositAmount(${params.depositValue})보다 작습니다. 지갑에서 TrustSet을 먼저 설정하세요.`,
      );
    }

    const landlordLine = await findTrustLine(
      client,
      params.landlordAddress,
      issuer,
      cur,
    );
    if (!landlordLine || !iouValueGte(landlordLine.limit, params.stakeValue)) {
      throw new BadRequestException(
        `임대인(${params.landlordAddress}) 계정에 issuer ${issuer} 통화 ${cur} trust line이 없거나 limit이 stakeAmount(${params.stakeValue})보다 작습니다.`,
      );
    }
  }

  /**
   * 계약 계정에 issuer 통화 trust line을 넉넉히 열고, 운영자 지갑에서 deposit+stake 만큼 입금.
   */
  async ensureTrustLineAndFundFromOperator(params: {
    contractWallet: Wallet;
    operatorWallet: Wallet;
    issuer: string;
    currency: string;
    depositValue: string;
    stakeValue: string;
  }): Promise<void> {
    const client = this.xrplClient.getClient();
    const { issuer, currency, contractWallet, operatorWallet } = params;
    const cur = normalizeIouCurrencyCode(currency);
    const total = sumIouValueStrings(params.depositValue, params.stakeValue);

    const issuerSeed = this.config.get<string>('XRPL_IOU_ISSUER_SEED')?.trim();
    let fundingWallet: XrplWallet;
    if (issuerSeed) {
      fundingWallet = XrplWallet.fromSeed(issuerSeed);
      if (fundingWallet.classicAddress !== issuer) {
        throw new BadRequestException(
          `XRPL_IOU_ISSUER_SEED 주소가 XRPL_IOU_ISSUER 와 일치하지 않습니다.`,
        );
      }
      await this.xrplClient.ensureTestnetXrpForFees(fundingWallet);
    } else {
      fundingWallet = operatorWallet;
      const opLine = await findTrustLine(
        client,
        operatorWallet.classicAddress,
        issuer,
        cur,
      );
      if (!opLine || parseFloat(opLine.balance) < parseFloat(total)) {
        throw new BadRequestException(
          `XRPL_OPERATOR_SEED 지갑의 ${cur}(issuer ${issuer}) 잔액이 부족합니다. 필요: ${total}, 보유: ${opLine?.balance ?? '0'}. (발행 직접 시 XRPL_IOU_ISSUER_SEED 설정)`,
        );
      }
    }

    const trustLimit = '1000000000';
    const limitAmount = buildIouAmount(issuer, cur, trustLimit);
    await this.trustSetService.submitTrustSet(contractWallet, limitAmount);
    this.logger.log(
      `TrustSet OK for contract ${contractWallet.classicAddress} → ${cur}`,
    );

    const amount = buildIouAmount(issuer, cur, total);
    const pay: Payment = {
      TransactionType: 'Payment',
      Account: fundingWallet.classicAddress,
      Destination: contractWallet.classicAddress,
      Amount: amount,
    };
    const payRes = await client.submitAndWait(pay, {
      wallet: fundingWallet,
    });
    TrustSetService.assertTxSuccess(payRes);
    this.logger.log(
      `Operator IOU funding OK: ${total} ${cur} → ${contractWallet.classicAddress} tx=${payRes.result.hash}`,
    );
  }
}
