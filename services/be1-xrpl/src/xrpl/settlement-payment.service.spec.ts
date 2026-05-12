import type { Client, TxResponse } from 'xrpl';
import { Wallet } from 'xrpl';
import { SettlementPaymentService } from './settlement-payment.service';
import { XrplClientService } from './xrpl-client.service';

describe('SettlementPaymentService', () => {
  let service: SettlementPaymentService;
  let mockSubmitAndWait: jest.Mock;
  let wallet: Wallet;

  beforeEach(() => {
    mockSubmitAndWait = jest.fn();
    const mockClient = {
      submitAndWait: mockSubmitAndWait,
    } as unknown as Client;
    const mockXrpl = {
      getClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as XrplClientService;
    wallet = Wallet.generate();
    service = new SettlementPaymentService(mockXrpl);
  });

  it('submits Payment with Memos', async () => {
    mockSubmitAndWait.mockResolvedValue({
      result: {
        hash: 'E'.repeat(64),
        meta: { TransactionResult: 'tesSUCCESS', AffectedNodes: [] },
      },
    } as unknown as TxResponse);

    const hash = await service.submitXrpPayment({
      sourceAddress: wallet.classicAddress,
      destinationAddress: 'rDestXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      sourceSeed: wallet.seed!,
      amountDrops: '1000',
      Memos: [
        {
          Memo: {
            MemoType: '414243',
            MemoFormat: '',
            MemoData: '7B7D',
          },
        },
      ],
    });

    expect(hash).toBe('E'.repeat(64));
    const [tx] = mockSubmitAndWait.mock.calls[0] as [Record<string, unknown>];
    expect(tx.TransactionType).toBe('Payment');
    expect(tx.Amount).toBe('1000');
    expect((tx.Memos as unknown[]).length).toBe(1);
  });

  it('throws when seed does not match sourceAddress', async () => {
    const other = Wallet.generate();
    await expect(
      service.submitXrpPayment({
        sourceAddress: wallet.classicAddress,
        destinationAddress: 'rDestXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        sourceSeed: other.seed!,
        amountDrops: '1',
      }),
    ).rejects.toThrow(/일치하지 않습니다/);
    expect(mockSubmitAndWait).not.toHaveBeenCalled();
  });
});
