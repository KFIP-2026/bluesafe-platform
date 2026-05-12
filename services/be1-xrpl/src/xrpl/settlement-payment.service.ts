import { Injectable, Logger } from '@nestjs/common';
import type { Payment, TxResponse } from 'xrpl';
import { Wallet } from 'xrpl';
import { XrplClientService } from './xrpl-client.service';

export interface SubmitXrpPaymentParams {
  sourceAddress: string;
  destinationAddress: string;
  sourceSeed: string;
  /** XRP drops 정수 문자열 */
  amountDrops: string;
  Memos?: Payment['Memos'];
}

/**
 * 월별 정산 등 **계약 계정 → 임대인** XRP Payment.
 * Reconciler가 KEPCO 대조 후 호출 — XRPL Payment “기둥” 구현을 한곳에 모음.
 */
@Injectable()
export class SettlementPaymentService {
  private readonly logger = new Logger(SettlementPaymentService.name);

  constructor(private readonly xrplClient: XrplClientService) {}

  async submitXrpPayment(params: SubmitXrpPaymentParams): Promise<string> {
    const wallet = Wallet.fromSeed(params.sourceSeed);
    if (wallet.classicAddress !== params.sourceAddress) {
      throw new Error(
        `sourceSeed 주소(${wallet.classicAddress})가 sourceAddress(${params.sourceAddress})와 일치하지 않습니다.`,
      );
    }
    if (!/^\d+$/.test(params.amountDrops)) {
      throw new Error('amountDrops must be a non-negative integer drops string');
    }

    const tx: Payment = {
      TransactionType: 'Payment',
      Account: params.sourceAddress,
      Destination: params.destinationAddress,
      Amount: params.amountDrops,
      ...(params.Memos?.length ? { Memos: params.Memos } : {}),
    };

    const client = this.xrplClient.getClient();
    const response = await client.submitAndWait(tx, { wallet });
    const hash = this.assertPaymentSuccess(response);
    this.logger.log(
      `Settlement Payment OK: ${params.sourceAddress} → ${params.destinationAddress} drops=${params.amountDrops} tx=${hash}`,
    );
    return hash;
  }

  private assertPaymentSuccess(response: TxResponse<Payment>): string {
    const meta = response.result.meta;
    if (typeof meta !== 'object' || meta === null) {
      throw new Error('Payment response meta missing or string');
    }
    if (meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Payment failed: ${meta.TransactionResult}`);
    }
    return response.result.hash;
  }
}
