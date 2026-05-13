import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class DemoPaymentDto {
  @IsOptional()
  @Matches(/^\d+$/, { message: 'amountDrops must be a non-negative integer string' })
  amountDrops?: string;

  @IsOptional()
  @IsIn(['tenant', 'landlord'])
  fromRole?: 'tenant' | 'landlord';

  @IsOptional()
  @IsIn(['tenant', 'landlord'])
  toRole?: 'tenant' | 'landlord';

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsString()
  destinationAddress?: string;
}

export class DemoEscrowFinishDto {
  @IsString()
  owner!: string;

  @Matches(/^\d+$/, { message: 'offerSequence must be a positive integer string' })
  offerSequence!: string;
}

export class DemoSbtDto {
  @IsOptional()
  @IsIn(['tenant', 'landlord'])
  role?: 'tenant' | 'landlord';

  @IsOptional()
  @Matches(/^\d+$/, { message: 'taxon must be a non-negative integer string' })
  taxon?: string;

  @IsOptional()
  @IsString()
  uriUtf8?: string;
}
