import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { XrplModule } from './xrpl/xrpl.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      ignoreEnvFile: false,
    }),
    XrplModule,
    WalletModule,
  ],
})
export class WalletAppModule {}
