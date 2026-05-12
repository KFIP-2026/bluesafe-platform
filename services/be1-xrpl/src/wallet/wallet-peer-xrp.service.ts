import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Payment } from 'xrpl';
import { TrustSetService } from '../xrpl/trust-set.service';
import { XrplClientService } from '../xrpl/xrpl-client.service';
import { WalletService } from './wallet.service';

/**
 * 내부 임차인/임대인 지갑으로 테스트넷 XRP Payment를 서로 한 번씩 제출 (PoC 히스토리용).
 * 시드는 응답에 포함하지 않음.
 */
@Injectable()
export class WalletPeerXrpService {
  constructor(
    private readonly walletService: WalletService,
    private readonly xrplClient: XrplClientService,
    private readonly config: ConfigService,
  ) {}

  private assertTestnet(): void {
    const url = (
      this.config.get<string>('XRPL_NETWORK_URL') ??
      'wss://s.altnet.rippletest.net:51233'
    ).toLowerCase();
    if (!url.includes('altnet.rippletest')) {
      throw new ForbiddenException(
        'peer-xrp-roundtrip is only allowed when XRPL_NETWORK_URL points at XRPL Testnet (altnet.rippletest).',
      );
    }
  }

  async roundtrip(amountDrops: string): Promise<{
    tenantAddress: string;
    landlordAddress: string;
    amountDrops: string;
    tenantToLandlordTxHash: string;
    landlordToTenantTxHash: string;
    explorerBase: string;
    links: {
      tenantToLandlord: string;
      landlordToTenant: string;
      tenantAccount: string;
      landlordAccount: string;
    };
  }> {
    this.assertTestnet();
    if (!/^\d+$/.test(amountDrops)) {
      throw new BadRequestException(
        'amountDrops must be a non-negative integer drops string',
      );
    }

    const tenant = this.walletService.getWalletForRole('tenant');
    const landlord = this.walletService.getWalletForRole('landlord');
    const client = this.xrplClient.getClient();

    const submitPay = async (
      from: typeof tenant,
      to: typeof landlord,
    ): Promise<string> => {
      const tx: Payment = {
        TransactionType: 'Payment',
        Account: from.classicAddress,
        Destination: to.classicAddress,
        Amount: amountDrops,
      };
      const res = await client.submitAndWait(tx, { wallet: from });
      TrustSetService.assertTxSuccess(res);
      return res.result.hash;
    };

    const tenantToLandlordTxHash = await submitPay(tenant, landlord);
    const landlordToTenantTxHash = await submitPay(landlord, tenant);

    const explorerBase = (
      this.config.get<string>('XRPL_EXPLORER_URL') ?? 'https://testnet.xrpl.org'
    ).replace(/\/$/, '');

    return {
      tenantAddress: tenant.classicAddress,
      landlordAddress: landlord.classicAddress,
      amountDrops,
      tenantToLandlordTxHash,
      landlordToTenantTxHash,
      explorerBase,
      links: {
        tenantToLandlord: `${explorerBase}/transactions/${tenantToLandlordTxHash}`,
        landlordToTenant: `${explorerBase}/transactions/${landlordToTenantTxHash}`,
        tenantAccount: `${explorerBase}/accounts/${tenant.classicAddress}`,
        landlordAccount: `${explorerBase}/accounts/${landlord.classicAddress}`,
      },
    };
  }
}
