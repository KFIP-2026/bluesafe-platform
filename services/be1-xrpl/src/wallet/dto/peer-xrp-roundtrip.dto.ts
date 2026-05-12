import { IsOptional, Matches } from 'class-validator';

export class PeerXrpRoundtripDto {
  /** 드롭 단위 정수 문자열. 기본 1_000_000 (1 XRP). */
  @IsOptional()
  @Matches(/^\d+$/, { message: 'amountDrops must be a non-negative integer string' })
  amountDrops?: string;
}
