import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Wallet } from 'xrpl';

type WalletRole = 'tenant' | 'landlord';

type WalletNetwork = {
  id: 'testnet' | 'mainnet' | 'devnet';
  label: string;
  rpcEndpoint: string;
};

@Injectable()
export class WalletService {
  private readonly wallets = new Map<WalletRole, Wallet>();
  private readonly connected = new Map<WalletRole, boolean>();

  constructor(private readonly config: ConfigService) {}

  connect(role: WalletRole = 'tenant', approve = true) {
    const wallet = this.getOrCreateWallet(role);

    if (!approve) {
      this.connected.set(role, false);
      return {
        message: 'Connection declined.',
        connected: false,
      };
    }

    const wasConnected = this.connected.get(role) === true;
    this.connected.set(role, true);

    return {
      message: wasConnected ? 'Wallet already connected.' : 'Connection approved.',
      connected: true,
      role,
      address: wallet.classicAddress,
      publicKey: wallet.publicKey,
      network: this.getWalletNetwork(),
    };
  }

  disconnect(role: WalletRole = 'tenant') {
    this.connected.set(role, false);
    return {
      message: 'Wallet disconnected.',
      connected: false,
      role,
    };
  }

  private getOrCreateWallet(role: WalletRole) {
    const existing = this.wallets.get(role);
    if (existing) return existing;

    const wallet = Wallet.generate();
    this.wallets.set(role, wallet);
    return wallet;
  }

  private getWalletNetwork(): WalletNetwork {
    const endpoint = this.config.get<string>('XRPL_NETWORK_URL') ?? '';

    if (endpoint.includes('xrplcluster') || endpoint.includes('mainnet')) {
      return { id: 'mainnet', label: 'XRPL Mainnet', rpcEndpoint: endpoint };
    }

    if (endpoint.includes('devnet')) {
      return { id: 'devnet', label: 'XRPL Devnet', rpcEndpoint: endpoint };
    }

    return {
      id: 'testnet',
      label: 'XRPL Testnet',
      rpcEndpoint: endpoint || 'wss://s.altnet.rippletest.net:51233',
    };
  }
}
