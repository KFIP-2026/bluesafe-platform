import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Payment } from 'xrpl';
import { convertStringToHex, isValidClassicAddress } from 'xrpl';
import { EscrowService } from '../xrpl/escrow.service';
import { SoulboundNftService } from '../xrpl/soulbound-nft.service';
import { TrustSetService } from '../xrpl/trust-set.service';
import { XrplClientService } from '../xrpl/xrpl-client.service';
import { WalletService } from './wallet.service';

type WalletRole = 'tenant' | 'landlord';

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
    private readonly escrowService: EscrowService,
    private readonly soulboundNftService: SoulboundNftService,
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
    await Promise.all([
      this.xrplClient.ensureTestnetXrpForFees(tenant),
      this.xrplClient.ensureTestnetXrpForFees(landlord),
    ]);

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

  async submitDemoPayment(params: {
    fromRole: WalletRole;
    toRole: WalletRole;
    amountDrops: string;
    destinationAddress?: string;
    memo?: string;
  }): Promise<{
    fromRole: WalletRole;
    toRole: WalletRole;
    sourceAddress: string;
    destinationAddress: string;
    amountDrops: string;
    txHash: string;
    txType: 'Payment';
    network: 'XRPL Testnet';
    explorerBase: string;
    links: {
      payment: string;
      sourceAccount: string;
      destinationAccount: string;
    };
  }> {
    this.assertTestnet();
    if (!/^\d+$/.test(params.amountDrops)) {
      throw new BadRequestException(
        'amountDrops must be a non-negative integer drops string',
      );
    }
    if (params.fromRole === params.toRole) {
      throw new BadRequestException('fromRole and toRole must be different');
    }

    const source = this.walletService.getWalletForRole(params.fromRole);
    const destination = params.destinationAddress?.trim();
    if (destination && !isValidClassicAddress(destination)) {
      throw new BadRequestException('destinationAddress must be a valid XRPL classic address');
    }
    const destinationWallet = destination
      ? undefined
      : this.walletService.getWalletForRole(params.toRole);
    const destinationAddress = destination ?? destinationWallet!.classicAddress;
    const client = this.xrplClient.getClient();
    await this.xrplClient.ensureTestnetXrpForFees(source);
    if (destinationWallet) await this.xrplClient.ensureTestnetXrpForFees(destinationWallet);

    const tx: Payment = {
      TransactionType: 'Payment',
      Account: source.classicAddress,
      Destination: destinationAddress,
      Amount: params.amountDrops,
      ...(params.memo
        ? {
            Memos: [
              {
                Memo: {
                  MemoType: convertStringToHex('bluesafe.demo'),
                  MemoData: convertStringToHex(params.memo),
                },
              },
            ],
          }
        : {}),
    };
    const response = await client.submitAndWait(tx, { wallet: source });
    TrustSetService.assertTxSuccess(response);
    const txHash = response.result.hash;
    const explorerBase = this.explorerBase();

    return {
      fromRole: params.fromRole,
      toRole: params.toRole,
      sourceAddress: source.classicAddress,
      destinationAddress,
      amountDrops: params.amountDrops,
      txHash,
      txType: 'Payment',
      network: 'XRPL Testnet',
      explorerBase,
      links: {
        payment: `${explorerBase}/transactions/${txHash}`,
        sourceAccount: `${explorerBase}/accounts/${source.classicAddress}`,
        destinationAccount: `${explorerBase}/accounts/${destinationAddress}`,
      },
    };
  }

  async finishDemoEscrow(params: {
    owner: string;
    offerSequence: number;
  }): Promise<{
    submitterAddress: string;
    owner: string;
    offerSequence: number;
    txHash: string;
    txType: 'EscrowFinish';
    network: 'XRPL Testnet';
    explorerBase: string;
    links: {
      transaction: string;
      submitterAccount: string;
      ownerAccount: string;
    };
  }> {
    this.assertTestnet();
    if (!Number.isFinite(params.offerSequence) || params.offerSequence <= 0) {
      throw new BadRequestException('offerSequence must be a positive integer');
    }

    const submitter = this.walletService.getWalletForRole('landlord');
    await this.xrplClient.ensureTestnetXrpForFees(submitter);
    const out = await this.escrowService.finishEscrow({
      submitter,
      owner: params.owner,
      offerSequence: params.offerSequence,
    });
    const explorerBase = this.explorerBase();

    return {
      submitterAddress: submitter.classicAddress,
      owner: params.owner,
      offerSequence: params.offerSequence,
      txHash: out.txHash,
      txType: 'EscrowFinish',
      network: 'XRPL Testnet',
      explorerBase,
      links: {
        transaction: `${explorerBase}/transactions/${out.txHash}`,
        submitterAccount: `${explorerBase}/accounts/${submitter.classicAddress}`,
        ownerAccount: `${explorerBase}/accounts/${params.owner}`,
      },
    };
  }

  async mintDemoSbt(params: {
    role: WalletRole;
    taxon: number;
    uriUtf8: string;
  }): Promise<{
    role: WalletRole;
    minterAddress: string;
    txHash: string;
    txType: 'NFTokenMint';
    ledgerIndex: number;
    validated: boolean;
    network: 'XRPL Testnet';
    explorerBase: string;
    links: {
      transaction: string;
      minterAccount: string;
    };
  }> {
    this.assertTestnet();
    const minter = this.walletService.getWalletForRole(params.role);
    await this.xrplClient.ensureTestnetXrpForFees(minter);
    const out = await this.soulboundNftService.mintSoulboundNft({
      minter,
      taxon: params.taxon,
      uriUtf8: params.uriUtf8,
    });
    const explorerBase = this.explorerBase();

    return {
      role: params.role,
      minterAddress: minter.classicAddress,
      txHash: out.txHash,
      txType: 'NFTokenMint',
      ledgerIndex: out.ledgerIndex,
      validated: out.validated,
      network: 'XRPL Testnet',
      explorerBase,
      links: {
        transaction: `${explorerBase}/transactions/${out.txHash}`,
        minterAccount: `${explorerBase}/accounts/${minter.classicAddress}`,
      },
    };
  }

  async createDemoEscrow(amountDrops: string): Promise<{
    tenantAddress: string;
    landlordAddress: string;
    amountDrops: string;
    escrowTxHash: string;
    escrowSequence: number;
    explorerBase: string;
    links: {
      escrow: string;
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
    await Promise.all([
      this.xrplClient.ensureTestnetXrpForFees(tenant),
      this.xrplClient.ensureTestnetXrpForFees(landlord),
    ]);

    const now = Date.now();
    const escrow = await this.escrowService.createEscrow({
      account: tenant,
      destination: landlord.classicAddress,
      amount: amountDrops,
      finishAfter: new Date(now + 5_000),
      cancelAfter: new Date(now + 7 * 24 * 60 * 60 * 1000),
    });

    const explorerBase = this.explorerBase();

    return {
      tenantAddress: tenant.classicAddress,
      landlordAddress: landlord.classicAddress,
      amountDrops,
      escrowTxHash: escrow.txHash,
      escrowSequence: escrow.escrowSequence,
      explorerBase,
      links: {
        escrow: `${explorerBase}/transactions/${escrow.txHash}`,
        tenantAccount: `${explorerBase}/accounts/${tenant.classicAddress}`,
        landlordAccount: `${explorerBase}/accounts/${landlord.classicAddress}`,
      },
    };
  }

  private explorerBase(): string {
    return (
      this.config.get<string>('XRPL_EXPLORER_URL') ?? 'https://testnet.xrpl.org'
    ).replace(/\/$/, '');
  }
}
