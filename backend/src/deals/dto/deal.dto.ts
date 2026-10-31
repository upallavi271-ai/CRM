import { PartialType, OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value!: number;

  /** Defaults to the default pipeline. */
  @IsOptional()
  @IsUUID()
  pipelineId?: string;

  /** Defaults to the first open stage. */
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  /** Needs Deal.ReadAll to give a deal to someone else. */
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  lostReason?: string;
}

export class UpdateDealDto extends PartialType(
  OmitType(CreateDealDto, ['pipelineId'] as const),
) {}

export class MoveDealDto {
  @IsUUID()
  stageId!: string;

  /** Required when moving to a Lost stage. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lostReason?: string;
}
