import type { Client, TxResponse, Wallet } from 'xrpl';
import { EscrowService } from './escrow.service';
import { XrplClientService } from './xrpl-client.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let mockSubmitAndWait: jest.Mock;
  let mockWallet: Wallet;

  beforeEach(() => {
    mockSubmitAndWait = jest.fn();
    const mockClient = {
      submitAndWait: mockSubmitAndWait,
    } as unknown as Client;
    const mockXrplClient = {
      getClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as XrplClientService;
    mockWallet = { classicAddress: 'rExampleSender' } as unknown as Wallet;
    service = new EscrowService(mockXrplClient);
  });

  function makeSuccessResponse(seq = 12345): TxResponse {
    return {
      result: {
        hash: 'A'.repeat(64),
        Sequence: seq,
        ledger_index: 100,
        validated: true,
        meta: {
          TransactionResult: 'tesSUCCESS',
          AffectedNodes: [],
        },
      },
    } as unknown as TxResponse;
  }

  it('builds and submits a valid EscrowCreate', async () => {
    mockSubmitAndWait.mockResolvedValue(makeSuccessResponse());

    const finishAfter = new Date(Date.now() + 60_000);
    const result = await service.createEscrow({
      account: mockWallet,
      destination: 'rExampleReceiver',
      amount: '10000000',
      finishAfter,
    });

    expect(mockSubmitAndWait).toHaveBeenCalledTimes(1);
    const [tx, opts] = mockSubmitAndWait.mock.calls[0] as [
      Record<string, unknown>,
      { wallet: Wallet },
    ];
    expect(tx.TransactionType).toBe('EscrowCreate');
    expect(tx.Account).toBe('rExampleSender');
    expect(tx.Destination).toBe('rExampleReceiver');
    expect(tx.Amount).toBe('10000000');
    expect(typeof tx.FinishAfter).toBe('number');
    expect(opts.wallet).toBe(mockWallet);

    expect(result.txHash).toBe('A'.repeat(64));
    expect(result.escrowSequence).toBe(12345);
    expect(result.ledgerIndex).toBe(100);
    expect(result.validated).toBe(true);
  });

  it('throws when neither finishAfter, cancelAfter, nor condition is provided', async () => {
    await expect(
      service.createEscrow({
        account: mockWallet,
        destination: 'rDest',
        amount: '1000',
      }),
    ).rejects.toThrow(/at least one/);
    expect(mockSubmitAndWait).not.toHaveBeenCalled();
  });

  it('throws when cancelAfter is not later than finishAfter', async () => {
    await expect(
      service.createEscrow({
        account: mockWallet,
        destination: 'rDest',
        amount: '1000',
        finishAfter: new Date('2030-01-01'),
        cancelAfter: new Date('2029-01-01'),
      }),
    ).rejects.toThrow(/cancelAfter must be later/);
    expect(mockSubmitAndWait).not.toHaveBeenCalled();
  });

  it('throws when transaction result is not tesSUCCESS', async () => {
    mockSubmitAndWait.mockResolvedValue({
      result: {
        hash: 'B'.repeat(64),
        Sequence: 2,
        meta: {
          TransactionResult: 'tecINSUF_RESERVE_LINE',
          AffectedNodes: [],
        },
      },
    });

    await expect(
      service.createEscrow({
        account: mockWallet,
        destination: 'rDest',
        amount: '1000',
        finishAfter: new Date(Date.now() + 60_000),
      }),
    ).rejects.toThrow(/EscrowCreate failed: tecINSUF_RESERVE_LINE/);
  });

  it('submits EscrowCreate with IOU Amount object', async () => {
    mockSubmitAndWait.mockResolvedValue(makeSuccessResponse());
    const iouAmount = {
      currency: 'USD',
      issuer: 'rIssuerXXXXXXXXXXXXXXXXXXXXXXXXXX',
      value: '12.5',
    };
    const finishAfter = new Date(Date.now() + 60_000);
    const cancelAfter = new Date(Date.now() + 120_000);
    await service.createEscrow({
      account: mockWallet,
      destination: 'rDest',
      amount: iouAmount,
      finishAfter,
      cancelAfter,
    });
    const [tx] = mockSubmitAndWait.mock.calls[0] as [Record<string, unknown>];
    expect(tx.Amount).toEqual(iouAmount);
    expect(tx.CancelAfter).toBeGreaterThan(tx.FinishAfter as number);
  });

  it('passes optional fields (cancelAfter, condition, destinationTag) through', async () => {
    mockSubmitAndWait.mockResolvedValue(makeSuccessResponse());

    await service.createEscrow({
      account: mockWallet,
      destination: 'rDest',
      amount: '1000',
      finishAfter: new Date(Date.now() + 60_000),
      cancelAfter: new Date(Date.now() + 120_000),
      condition: 'A0258020' + 'F'.repeat(64) + '810120',
      destinationTag: 42,
    });

    const [tx] = mockSubmitAndWait.mock.calls[0] as [Record<string, unknown>];
    expect(tx.CancelAfter).toBeGreaterThan(tx.FinishAfter as number);
    expect(tx.Condition).toBeDefined();
    expect(tx.DestinationTag).toBe(42);
  });

  it('submits EscrowFinish with Owner and OfferSequence', async () => {
    mockSubmitAndWait.mockResolvedValue({
      result: {
        hash: 'C'.repeat(64),
        ledger_index: 200,
        validated: true,
        meta: { TransactionResult: 'tesSUCCESS', AffectedNodes: [] },
      },
    } as unknown as TxResponse);

    const out = await service.finishEscrow({
      submitter: mockWallet,
      owner: 'rOwnerXXXXXXXXXXXXXXXXXXXXXXXXXX',
      offerSequence: 99,
    });

    expect(out.txHash).toBe('C'.repeat(64));
    expect(out.ledgerIndex).toBe(200);
    const [tx] = mockSubmitAndWait.mock.calls[0] as [Record<string, unknown>];
    expect(tx.TransactionType).toBe('EscrowFinish');
    expect(tx.Owner).toBe('rOwnerXXXXXXXXXXXXXXXXXXXXXXXXXX');
    expect(tx.OfferSequence).toBe(99);
  });

  it('submits EscrowCancel', async () => {
    mockSubmitAndWait.mockResolvedValue({
      result: {
        hash: 'D'.repeat(64),
        ledger_index: 201,
        validated: true,
        meta: { TransactionResult: 'tesSUCCESS', AffectedNodes: [] },
      },
    } as unknown as TxResponse);

    const out = await service.cancelEscrow({
      submitter: mockWallet,
      owner: 'rOwnerXXXXXXXXXXXXXXXXXXXXXXXXXX',
      offerSequence: 100,
    });

    expect(out.txHash).toBe('D'.repeat(64));
    const [tx] = mockSubmitAndWait.mock.calls[0] as [Record<string, unknown>];
    expect(tx.TransactionType).toBe('EscrowCancel');
    expect(tx.OfferSequence).toBe(100);
  });
});
