import { Global, Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SettlementPaymentService } from './settlement-payment.service';
import { SignerListService } from './signer-list.service';
import { SoulboundNftService } from './soulbound-nft.service';
import { TrustSetService } from './trust-set.service';
import { XrplClientService } from './xrpl-client.service';

/**
 * XRPL 트랜잭션 모듈 — PoC 핵심 4기둥
 * - **Escrow**: `EscrowService` — Create / Finish / Cancel
 * - **멀티시그**: `SignerListService` — 계약 계정 SignerListSet (quorum)
 * - **Payment**: `SettlementPaymentService` — 정산용 XRP Payment(+Memo)
 * - **SBT(유사)**: `SoulboundNftService` + `sbt-adapter.types` — NFTokenMint(비양도) / BE2 job 정합
 * - `TrustSetService`, `XrplClientService` — IOU·연결
 */
@Global()
@Module({
  providers: [
    XrplClientService,
    EscrowService,
    SignerListService,
    TrustSetService,
    SettlementPaymentService,
    SoulboundNftService,
  ],
  exports: [
    XrplClientService,
    EscrowService,
    SignerListService,
    TrustSetService,
    SettlementPaymentService,
    SoulboundNftService,
  ],
})
export class XrplModule {}
