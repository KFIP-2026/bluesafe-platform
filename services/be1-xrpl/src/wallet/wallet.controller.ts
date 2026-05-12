import { Body, Controller, Post } from '@nestjs/common';
import { ConnectWalletDto } from './dto/connect-wallet.dto';
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
}
