import { Body, Controller, Post } from '@nestjs/common';
import { ConnectWalletDto } from './dto/connect-wallet.dto';
import { WalletService } from './wallet.service';

@Controller('api/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('connect')
  connect(@Body() dto: ConnectWalletDto) {
    return this.walletService.connect(dto.role ?? 'tenant', dto.approve ?? true);
  }

  @Post('disconnect')
  disconnect(@Body() dto: ConnectWalletDto) {
    return this.walletService.disconnect(dto.role ?? 'tenant');
  }
}
