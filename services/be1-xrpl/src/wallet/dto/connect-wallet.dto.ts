import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class ConnectWalletDto {
  @IsOptional()
  @IsBoolean()
  approve?: boolean;

  @IsOptional()
  @IsIn(['tenant', 'landlord'])
  role?: 'tenant' | 'landlord';
}
