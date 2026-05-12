import { Injectable, Logger } from '@nestjs/common';
import type { Amount, EscrowCancel, EscrowFinish } from 'xrpl';
import {
  EscrowCreate,
  TxResponse,
  Wallet,
  isoTimeToRippleTime,
} from 'xrpl';
import { XrplClientService } from './xrpl-client.service';

export interface CreateEscrowParams {
  /** 송신자/서명자 — Account 필드와 서명에 사용됨 */
  account: Wallet;
  /** 수취 계정 classic address */
  destination: string;
  /** XRP drops 문자열 또는 IssuedCurrencyAmount(IOU). IOU 에스크로는 CancelAfter 필수(본 서비스는 항상 설정). */
  amount: Amount;
  /** 정상 해제 가능 시점 */
  finishAfter?: Date;
  /** 자동 환불 시점 */
  cancelAfter?: Date;
  /** PREIMAGE-SHA-256 condition (선택) */
  condition?: string;
  /** 수취 측 DestinationTag (필요 시) */
  destinationTag?: number;
}

export interface EscrowCreatedResult {
  /** EscrowCreate 트랜잭션 hash (64자 hex) */
  txHash: string;
  /** EscrowFinish/Cancel 시 OfferSequence로 사용할 값 */
  escrowSequence: number;
  /** 검증된 ledger index */
  ledgerIndex: number;
  /** XRPL이 검증 완료했는지 */
  validated: boolean;
}

/** EscrowFinish / EscrowCancel 공통 응답 */
export interface EscrowMutationResult {
  txHash: string;
  ledgerIndex: number;
  validated: boolean;
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(private readonly xrplClient: XrplClientService) {}

  async createEscrow(params: CreateEscrowParams): Promise<EscrowCreatedResult> {
    this.validateParams(params);

    const tx: EscrowCreate = {
      TransactionType: 'EscrowCreate',
      Account: params.account.classicAddress,
      Destination: params.destination,
      Amount: params.amount,
    };

    if (params.finishAfter) {
      tx.FinishAfter = isoTimeToRippleTime(params.finishAfter.toISOString());
    }
    if (params.cancelAfter) {
      tx.CancelAfter = isoTimeToRippleTime(params.cancelAfter.toISOString());
    }
    if (params.condition) {
      tx.Condition = params.condition;
    }
    if (params.destinationTag !== undefined) {
      tx.DestinationTag = params.destinationTag;
    }

    const client = this.xrplClient.getClient();
    const response = await client.submitAndWait(tx, { wallet: params.account });
    return this.assertCreateSuccess(response);
  }

  /**
   * EscrowFinish — FinishAfter 경과 후 또는 crypto-condition 충족 시 에스크로 해제.
   * `submitter`가 수수료를 내고 서명; `owner`는 EscrowCreate를 낸 계정(보통 계약 계정).
   */
  async finishEscrow(params: {
    submitter: Wallet;
    /** EscrowCreate.Account 과 동일한 classic address */
    owner: string;
    offerSequence: number;
    condition?: string;
    fulfillment?: string;
  }): Promise<EscrowMutationResult> {
    if (!Number.isFinite(params.offerSequence) || params.offerSequence <= 0) {
      throw new Error('finishEscrow: offerSequence must be a positive integer');
    }
    const tx: EscrowFinish = {
      TransactionType: 'EscrowFinish',
      Account: params.submitter.classicAddress,
      Owner: params.owner,
      OfferSequence: params.offerSequence,
    };
    if (params.condition) tx.Condition = params.condition;
    if (params.fulfillment) tx.Fulfillment = params.fulfillment;

    const client = this.xrplClient.getClient();
    const response = await client.submitAndWait(tx, {
      wallet: params.submitter,
    });
    return this.assertMutationSuccess(response, 'EscrowFinish');
  }

  /**
   * EscrowCancel — CancelAfter 이후 미해제 에스크로를 소유자(또는 허용된 주체)가 회수.
   * 제출자는 rippled 규칙상 Owner 또는 Destination 등 허용 계정이어야 함.
   */
  async cancelEscrow(params: {
    submitter: Wallet;
    owner: string;
    offerSequence: number;
  }): Promise<EscrowMutationResult> {
    if (!Number.isFinite(params.offerSequence) || params.offerSequence <= 0) {
      throw new Error('cancelEscrow: offerSequence must be a positive integer');
    }
    const tx: EscrowCancel = {
      TransactionType: 'EscrowCancel',
      Account: params.submitter.classicAddress,
      Owner: params.owner,
      OfferSequence: params.offerSequence,
    };
    const client = this.xrplClient.getClient();
    const response = await client.submitAndWait(tx, {
      wallet: params.submitter,
    });
    return this.assertMutationSuccess(response, 'EscrowCancel');
  }

  private validateParams(params: CreateEscrowParams): void {
    if (!params.finishAfter && !params.cancelAfter && !params.condition) {
      throw new Error(
        'EscrowCreate requires at least one of: finishAfter, cancelAfter, condition',
      );
    }
    if (
      params.finishAfter &&
      params.cancelAfter &&
      params.cancelAfter.getTime() <= params.finishAfter.getTime()
    ) {
      throw new Error('cancelAfter must be later than finishAfter');
    }
  }

  private assertMutationSuccess(
    response: TxResponse,
    label: string,
  ): EscrowMutationResult {
    const result = response.result;
    const meta = result.meta;
    if (typeof meta !== 'object' || meta === null) {
      throw new Error(`${label} not validated: meta missing or string`);
    }
    if (meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`${label} failed: ${meta.TransactionResult}`);
    }
    const ledger = Number(result.ledger_index);
    if (!Number.isFinite(ledger)) {
      throw new Error(`${label} response missing ledger_index`);
    }
    this.logger.log(`${label} OK: hash=${result.hash}`);
    return {
      txHash: result.hash,
      ledgerIndex: ledger,
      validated: result.validated ?? false,
    };
  }

  private assertCreateSuccess(
    response: TxResponse<EscrowCreate>,
  ): EscrowCreatedResult {
    const result = response.result;
    const meta = result.meta;
    if (typeof meta !== 'object' || meta === null) {
      throw new Error('EscrowCreate not validated: meta missing or string');
    }
    if (meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`EscrowCreate failed: ${meta.TransactionResult}`);
    }

    // 최신 rippled는 트랜잭션 필드를 tx_json에 감싸 반환, 구버전은 result에 평탄화.
    // 두 형태 모두 지원.
    const txJson = (result as { tx_json?: { Sequence?: number } }).tx_json;
    const seq = Number(
      txJson?.Sequence ?? (result as { Sequence?: number }).Sequence,
    );
    const ledger = Number(result.ledger_index);
    if (!Number.isFinite(seq)) {
      throw new Error('EscrowCreate response missing Sequence');
    }
    if (!Number.isFinite(ledger)) {
      throw new Error('EscrowCreate response missing ledger_index');
    }

    this.logger.log(`EscrowCreate OK: hash=${result.hash} seq=${seq}`);

    return {
      txHash: result.hash,
      escrowSequence: seq,
      ledgerIndex: ledger,
      validated: result.validated ?? false,
    };
  }
}
