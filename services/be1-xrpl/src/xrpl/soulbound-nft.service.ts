import { Injectable, Logger } from '@nestjs/common';
import type { NFTokenMint, TxResponse } from 'xrpl';
import { Wallet, convertStringToHex } from 'xrpl';
import { XrplClientService } from './xrpl-client.service';

export interface MintSoulboundNftParams {
  /** 발행자(민터) 지갑 — 성공 시 NFToken은 이 계정 소유로 생성 */
  minter: Wallet;
  /** 0 ~ 0x7fffffff-1 권장; 상위 비트는 예약 */
  taxon: number;
  /** 짧은 UTF-8 URI/메타(내부에서 hex 인코딩) */
  uriUtf8: string;
}

/**
 * XRPL NFTokenMint 기반 **비양도(SBT 유사)** 토큰.
 * `tfTransferable` 미설정 → 일반 사용자 간 이전 불가(issuer↔holder 경로만 허용되는 동작에 가깝게 사용).
 * BE2 큐(`SbtAdapterJob`)와 조합해 오프체인 평판 → 온체인 증명 파이프라인을 구성.
 */
@Injectable()
export class SoulboundNftService {
  private readonly logger = new Logger(SoulboundNftService.name);

  constructor(private readonly xrplClient: XrplClientService) {}

  async mintSoulboundNft(
    params: MintSoulboundNftParams,
  ): Promise<{ txHash: string; ledgerIndex: number; validated: boolean }> {
    const uri = params.uriUtf8.trim();
    if (!uri.length) {
      throw new Error('mintSoulboundNft: uriUtf8 must be non-empty');
    }
    if (
      !Number.isInteger(params.taxon) ||
      params.taxon < 0 ||
      params.taxon > 0x7fffffff
    ) {
      throw new Error('mintSoulboundNft: taxon out of supported range');
    }

    const tx: NFTokenMint = {
      TransactionType: 'NFTokenMint',
      Account: params.minter.classicAddress,
      NFTokenTaxon: params.taxon,
      URI: convertStringToHex(uri),
    };

    const client = this.xrplClient.getClient();
    const response = await client.submitAndWait(tx, { wallet: params.minter });
    const out = this.assertMintSuccess(response);
    this.logger.log(`Soulbound-like NFTokenMint OK: taxon=${params.taxon} tx=${out.txHash}`);
    return out;
  }

  private assertMintSuccess(
    response: TxResponse<NFTokenMint>,
  ): { txHash: string; ledgerIndex: number; validated: boolean } {
    const meta = response.result.meta;
    if (typeof meta !== 'object' || meta === null) {
      throw new Error('NFTokenMint response meta missing or string');
    }
    if (meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`NFTokenMint failed: ${meta.TransactionResult}`);
    }
    const ledger = Number(response.result.ledger_index);
    if (!Number.isFinite(ledger)) {
      throw new Error('NFTokenMint response missing ledger_index');
    }
    return {
      txHash: response.result.hash,
      ledgerIndex: ledger,
      validated: response.result.validated ?? false,
    };
  }
}
