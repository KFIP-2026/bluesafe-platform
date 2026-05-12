import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletIouFundService } from './wallet-iou-fund.service';
import { WalletPeerXrpService } from './wallet-peer-xrp.service';
import { WalletService } from './wallet.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, WalletIouFundService, WalletPeerXrpService],
  exports: [WalletService],
})
export class WalletModule {}
