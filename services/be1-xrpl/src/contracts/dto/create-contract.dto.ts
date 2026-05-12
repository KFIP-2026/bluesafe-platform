import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export type ContractAssetMode = 'XRP' | 'IOU';

@ValidatorConstraint({ name: 'contractDepositStakeShape', async: false })
export class ContractDepositStakeShapeConstraint
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as CreateContractDto;
    const mode = o.assetMode ?? 'XRP';
    if (mode === 'XRP') {
      return (
        /^[0-9]+$/.test(o.depositAmount) && /^[0-9]+$/.test(o.stakeAmount)
      );
    }
    return (
      /^\d+(\.\d{1,16})?$/.test(o.depositAmount) &&
      /^\d+(\.\d{1,16})?$/.test(o.stakeAmount)
    );
  }

  defaultMessage(): string {
    return 'XRP 모드에서는 deposit/stake가 drops 정수, IOU 모드에서는 소수 value 문자열이어야 합니다.';
  }
}

/**
 * POST /contracts 입력 DTO.
 * tenantPii/landlordPii는 평문으로 받으며 ContractsService 내부에서 AES-256-GCM 암호화.
 *
 * - assetMode 기본 `XRP`: depositAmount/stakeAmount는 drops 정수 문자열.
 * - assetMode `IOU`: 금액은 IssuedCurrency `value` 소수 문자열; 임차인·임대인은 사전 TrustSet 필요.
 *   iouIssuer/iouCurrency 생략 시 서버 환경변수 XRPL_IOU_ISSUER / XRPL_IOU_CURRENCY 사용.
 */
export class CreateContractDto {
  @IsOptional()
  @IsIn(['XRP', 'IOU'])
  assetMode?: ContractAssetMode;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsString()
  @Matches(/^r[a-zA-Z0-9]{24,34}$/, { message: 'iouIssuer 형식 오류' })
  iouIssuer?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsString()
  @Matches(/^[A-Za-z0-9]{3}$|^[A-Fa-f0-9]{40}$/, {
    message: 'iouCurrency는 3자 코드 또는 40자리 hex',
  })
  iouCurrency?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^r[a-zA-Z0-9]{24,34}$/, { message: 'tenantAddress 형식 오류' })
  tenantAddress!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^r[a-zA-Z0-9]{24,34}$/, { message: 'landlordAddress 형식 오류' })
  landlordAddress!: string;

  @Validate(ContractDepositStakeShapeConstraint)
  @IsString()
  @IsNotEmpty()
  depositAmount!: string;

  @IsString()
  @IsNotEmpty()
  stakeAmount!: string;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @Type(() => Date)
  @IsDate()
  endsAt!: Date;

  @Type(() => Date)
  @IsDate()
  finishAfter!: Date;

  @Type(() => Date)
  @IsDate()
  cancelAfter!: Date;

  @IsString()
  @IsNotEmpty()
  tenantPii!: string;

  @IsString()
  @IsNotEmpty()
  landlordPii!: string;

  @IsOptional()
  @IsEmail()
  tenantEmail?: string;
}
