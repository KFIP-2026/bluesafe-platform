import { Injectable } from '@nestjs/common';
import type { IssuedCurrencyAmount, TrustSet, TxResponse, Wallet } from 'xrpl';
import { XrplClientService } from './xrpl-client.service';

@Injectable()
export class TrustSetService {
  constructor(private readonly xrplClient: XrplClientService) {}

  async submitTrustSet(
    owner: Wallet,
    limitAmount: IssuedCurrencyAmount,
  ): Promise<{ txHash: string }> {
    const client = this.xrplClient.getClient();
    const tx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: owner.classicAddress,
      LimitAmount: limitAmount,
    };
    const response = await client.submitAndWait(tx, { wallet: owner });
    const meta = response.result.meta;
    if (typeof meta !== 'object' || meta === null) {
      throw new Error('TrustSet response meta missing or string');
    }
    if (meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`TrustSet failed: ${meta.TransactionResult}`);
    }
    return { txHash: response.result.hash };
  }

  static assertTxSuccess(response: TxResponse): void {
    const meta = response.result.meta;
    if (typeof meta !== 'object' || meta === null) {
      throw new Error('XRPL tx meta missing');
    }
    if (meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`XRPL tx failed: ${meta.TransactionResult}`);
    }
  }
}
