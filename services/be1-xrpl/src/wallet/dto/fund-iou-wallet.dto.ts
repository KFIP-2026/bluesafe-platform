import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class FundIouWalletDto {
  @IsOptional()
  @IsIn(['tenant', 'landlord'])
  role?: 'tenant' | 'landlord';

  @IsOptional()
  @IsString()
  @Matches(/^r[a-zA-Z0-9]{24,34}$/, { message: 'issuer 형식 오류' })
  issuer?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{3}$|^[A-Fa-f0-9]{40}$/, {
    message: 'currency는 3자 코드 또는 40자리 hex',
  })
  currency?: string;

  /** 입금할 IOU 수량 (소수). 생략 시 XRPL_WALLET_IOU_FUND_AMOUNT 또는 1 */
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,16})?$/, { message: 'amount는 IOU value 소수 문자열' })
  amount?: string;
}
