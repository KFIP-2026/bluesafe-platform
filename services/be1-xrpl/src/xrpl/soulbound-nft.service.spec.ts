import type { Client, TxResponse } from 'xrpl';
import { Wallet } from 'xrpl';
import { SoulboundNftService } from './soulbound-nft.service';
import { XrplClientService } from './xrpl-client.service';

describe('SoulboundNftService', () => {
  let service: SoulboundNftService;
  let mockSubmitAndWait: jest.Mock;
  let minter: Wallet;

  beforeEach(() => {
    mockSubmitAndWait = jest.fn();
    const mockClient = {
      submitAndWait: mockSubmitAndWait,
    } as unknown as Client;
    const mockXrpl = {
      getClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as XrplClientService;
    minter = Wallet.generate();
    service = new SoulboundNftService(mockXrpl);
  });

  it('submits NFTokenMint without tfTransferable flag', async () => {
    mockSubmitAndWait.mockResolvedValue({
      result: {
        hash: 'F'.repeat(64),
        ledger_index: 300,
        validated: true,
        meta: { TransactionResult: 'tesSUCCESS', AffectedNodes: [] },
      },
    } as unknown as TxResponse);

    const out = await service.mintSoulboundNft({
      minter,
      taxon: 42,
      uriUtf8: '{"v":1}',
    });

    expect(out.txHash).toBe('F'.repeat(64));
    expect(out.ledgerIndex).toBe(300);
    const [tx] = mockSubmitAndWait.mock.calls[0] as [Record<string, unknown>];
    expect(tx.TransactionType).toBe('NFTokenMint');
    expect(tx.NFTokenTaxon).toBe(42);
    expect(tx.Flags).toBeUndefined();
    expect(typeof tx.URI).toBe('string');
  });

  it('rejects empty uri', async () => {
    await expect(
      service.mintSoulboundNft({ minter, taxon: 0, uriUtf8: '   ' }),
    ).rejects.toThrow(/non-empty/);
    expect(mockSubmitAndWait).not.toHaveBeenCalled();
  });
});
