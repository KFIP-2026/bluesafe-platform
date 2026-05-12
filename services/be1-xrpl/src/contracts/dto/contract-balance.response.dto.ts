export interface ContractBalanceResponseDto {
  contractId: string;
  address: string;
  /** XRP 소수점 표기 (drops → XRP 변환됨) */
  balanceXrp: string;
  /** assetMode=IOU 인 계약만 — escrow 후 계약 계정에 남은 IOU */
  balanceIou?: {
    currency: string;
    issuer: string;
    value: string;
  } | null;
}
