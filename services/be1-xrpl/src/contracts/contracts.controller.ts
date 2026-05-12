import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Wallet } from 'xrpl';
import { XrplClientService } from '../xrpl/xrpl-client.service';
import { normalizeIouCurrencyCode } from '../xrpl/iou-lines.util';
import { ContractsService } from './contracts.service';
import { IouContractSetupService } from './iou-contract-setup.service';
import type { ContractBalanceResponseDto } from './dto/contract-balance.response.dto';
import {
  type ContractResponseDto,
  toContractResponse,
} from './dto/contract.response.dto';
import { CreateContractDto } from './dto/create-contract.dto';

@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly xrplClient: XrplClientService,
    private readonly cfg: ConfigService,
    private readonly iouSetup: IouContractSetupService,
  ) {}

  /**
   * 계약 생성 + lockTenantDeposit(보증금 Escrow + Stake Escrow + SignerListSet).
   * 동기 호출(faucet + 다수 트랜잭션) — 보통 10-60초 소요.
   */
  @Post()
  async create(@Body() dto: CreateContractDto): Promise<ContractResponseDto> {
    const operatorSeed = this.cfg.get<string>('XRPL_OPERATOR_SEED') ?? '';
    if (!operatorSeed) {
      throw new BadRequestException(
        'XRPL_OPERATOR_SEED 미설정 — 계약 생성 불가',
      );
    }
    const operatorWallet = Wallet.fromSeed(operatorSeed);
    const assetMode = dto.assetMode ?? 'XRP';

    let iouIssuer = dto.iouIssuer?.trim() ?? '';
    let iouCurrency = dto.iouCurrency?.trim() ?? '';
    if (assetMode === 'IOU') {
      iouIssuer ||= this.cfg.get<string>('XRPL_IOU_ISSUER')?.trim() ?? '';
      iouCurrency ||= this.cfg.get<string>('XRPL_IOU_CURRENCY')?.trim() ?? '';
      if (!iouIssuer || !iouCurrency) {
        throw new BadRequestException(
          'IOU 모드: 요청에 iouIssuer/iouCurrency를 넣거나, 환경변수 XRPL_IOU_ISSUER / XRPL_IOU_CURRENCY를 설정하세요.',
        );
      }
      iouCurrency = normalizeIouCurrencyCode(iouCurrency);
      await this.iouSetup.assertCounterpartyTrustLines({
        tenantAddress: dto.tenantAddress,
        landlordAddress: dto.landlordAddress,
        issuer: iouIssuer,
        currency: iouCurrency,
        depositValue: dto.depositAmount,
        stakeValue: dto.stakeAmount,
      });
    }

    const contractWallet = await this.xrplClient.generateAndFundWallet();

    if (assetMode === 'IOU') {
      await this.iouSetup.ensureTrustLineAndFundFromOperator({
        contractWallet,
        operatorWallet,
        issuer: iouIssuer,
        currency: iouCurrency,
        depositValue: dto.depositAmount,
        stakeValue: dto.stakeAmount,
      });
    }

    const locked = await this.contractsService.lockTenantDeposit({
      tenantAddress: dto.tenantAddress,
      landlordAddress: dto.landlordAddress,
      depositAmount: dto.depositAmount,
      stakeAmount: dto.stakeAmount,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      finishAfter: dto.finishAfter,
      cancelAfter: dto.cancelAfter,
      tenantPii: dto.tenantPii,
      landlordPii: dto.landlordPii,
      tenantEmail: dto.tenantEmail ?? null,
      assetMode,
      iouIssuer: assetMode === 'IOU' ? iouIssuer : null,
      iouCurrency: assetMode === 'IOU' ? iouCurrency : null,
      contractWallet,
      operatorAddress: operatorWallet.classicAddress,
    });
    return toContractResponse(locked);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContractResponseDto> {
    const found = await this.contractsService.findById(id);
    if (!found) {
      throw new NotFoundException(`Contract ${id} not found`);
    }
    return toContractResponse(found);
  }

  @Get(':id/balance')
  async balance(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContractBalanceResponseDto> {
    const found = await this.contractsService.findById(id);
    if (!found) {
      throw new NotFoundException(`Contract ${id} not found`);
    }
    if (!found.contractAccountAddress) {
      throw new BadRequestException(
        `Contract ${id} has no contractAccountAddress (locked 전?)`,
      );
    }
    const balanceXrp = await this.xrplClient.getXrpBalance(
      found.contractAccountAddress,
    );
    if (
      found.assetMode === 'IOU' &&
      found.iouIssuer &&
      found.iouCurrency
    ) {
      const balanceIou = await this.xrplClient.getIouBalance(
        found.contractAccountAddress,
        found.iouIssuer,
        found.iouCurrency,
      );
      return {
        contractId: found.id,
        address: found.contractAccountAddress,
        balanceXrp,
        balanceIou,
      };
    }
    return {
      contractId: found.id,
      address: found.contractAccountAddress,
      balanceXrp,
    };
  }
}
