import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ConnectWalletDto } from './dto/connect-wallet.dto';
import { DemoSessionService } from './demo-session.service';
import {
  DemoEscrowFinishDto,
  DemoPaymentDto,
  DemoSbtDto,
} from './dto/demo-chain-action.dto';
import { FundIouWalletDto } from './dto/fund-iou-wallet.dto';
import { PeerXrpRoundtripDto } from './dto/peer-xrp-roundtrip.dto';
import { WalletIouFundService } from './wallet-iou-fund.service';
import { WalletPeerXrpService } from './wallet-peer-xrp.service';
import { WalletService } from './wallet.service';

@Controller('api/wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly walletIouFundService: WalletIouFundService,
    private readonly walletPeerXrpService: WalletPeerXrpService,
    private readonly demoSessionService: DemoSessionService,
  ) {}

  @Post('connect')
  connect(@Body() dto: ConnectWalletDto) {
    return this.walletService.connect(dto.role ?? 'tenant', dto.approve ?? true);
  }

  @Post('disconnect')
  disconnect(@Body() dto: ConnectWalletDto) {
    return this.walletService.disconnect(dto.role ?? 'tenant');
  }

  /**
   * 내부 지갑에 IOU(RLUSD 등) 입금 — 테스트넷에서 트랜잭션 히스토리를 남길 때 사용.
   * `XRPL_IOU_ISSUER_SEED`가 있으면 발행자에서 직접 Payment(권장). 없으면 `XRPL_OPERATOR_SEED` 보유분 전송(경로 제약으로 실패할 수 있음).
   */
  @Post('fund-iou')
  fundIou(@Body() dto: FundIouWalletDto) {
    return this.walletIouFundService.fundInternalWallet(dto);
  }

  /**
   * 테스트넷 전용: 내부 임차인 → 임대인, 임대인 → 임차인 XRP Payment 각 1건 (체인 히스토리).
   * `XRPL_NETWORK_URL`이 altnet.rippletest 일 때만 허용.
   */
  @Post('peer-xrp-roundtrip')
  peerXrpRoundtrip(@Body() dto: PeerXrpRoundtripDto) {
    const amountDrops = dto.amountDrops?.trim() || '1000000';
    return this.walletPeerXrpService.roundtrip(amountDrops);
  }

  /**
   * 데모 전용: 내부 임차인 지갑에서 임대인 지갑으로 실제 XRPL Testnet EscrowCreate 1건.
   * DB/BE2 없이 영상에서 검증 가능한 트랜잭션 해시를 만들 때 사용.
   */
  @Post('demo-escrow')
  demoEscrow(@Body() dto: PeerXrpRoundtripDto) {
    const amountDrops = dto.amountDrops?.trim() || '1000000';
    return this.walletPeerXrpService.createDemoEscrow(amountDrops);
  }

  /** 데모 전용: 실제 XRPL Testnet 월세 Payment 1건. */
  @Post('demo-rent-payment')
  demoRentPayment(@Body() dto: DemoPaymentDto) {
    return this.walletPeerXrpService.submitDemoPayment({
      fromRole: 'tenant',
      toRole: 'landlord',
      amountDrops: dto.amountDrops?.trim() || '100000',
      memo: dto.memo ?? 'BlueSafe monthly rent',
    });
  }

  /** 데모 전용: 실제 XRPL Testnet 송금 Payment 1건. */
  @Post('demo-remittance')
  demoRemittance(@Body() dto: DemoPaymentDto) {
    return this.walletPeerXrpService.submitDemoPayment({
      fromRole: dto.fromRole ?? 'tenant',
      toRole: dto.toRole ?? 'landlord',
      amountDrops: dto.amountDrops?.trim() || '100000',
      destinationAddress: dto.destinationAddress,
      memo: dto.memo ?? 'BlueSafe remittance demo',
    });
  }

  /** 데모 전용: 실제 XRPL Testnet EscrowFinish 1건. */
  @Post('demo-escrow-finish')
  demoEscrowFinish(@Body() dto: DemoEscrowFinishDto) {
    return this.walletPeerXrpService.finishDemoEscrow({
      owner: dto.owner,
      offerSequence: Number(dto.offerSequence),
    });
  }

  /** 데모 전용: 실제 XRPL Testnet NFTokenMint(SBT 유사) 1건. */
  @Post('demo-sbt')
  demoSbt(@Body() dto: DemoSbtDto) {
    return this.walletPeerXrpService.mintDemoSbt({
      role: dto.role ?? 'tenant',
      taxon: Number(dto.taxon ?? '20260513'),
      uriUtf8: dto.uriUtf8 ?? 'bluesafe://reputation/spring/97',
    });
  }

  @Get('demo-session/:sessionId')
  getDemoSession(@Param('sessionId') sessionId: string) {
    return this.demoSessionService.get(sessionId);
  }

  @Post('demo-session/:sessionId')
  saveDemoSession(
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.demoSessionService.save(sessionId, body);
  }

  @Delete('demo-session/:sessionId')
  clearDemoSession(@Param('sessionId') sessionId: string) {
    return this.demoSessionService.clear(sessionId);
  }
}
