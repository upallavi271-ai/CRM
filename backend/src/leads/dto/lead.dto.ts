import { LeadStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const LEAD_SOURCES = [
  'Website',
  'Google Ads',
  'Facebook',
  'Instagram',
  'Referral',
  'Walk-in',
  'Phone',
  'Other',
] as const;

/** CONVERTED is set only by the convert action. */
export const EDITABLE_LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'DISQUALIFIED',
] as const;

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ValidateIf((o: CreateLeadDto) => o.email !== undefined && o.email !== '')
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsIn(LEAD_SOURCES)
  source?: string;

  @IsOptional()
  @IsIn(EDITABLE_LEAD_STATUSES)
  status?: Exclude<LeadStatus, 'CONVERTED'>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requirement?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedValue?: number | null;

  /** null = unassigned. Needs Lead.Assign to set someone other than yourself. */
  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  disqualifyReason?: string;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class ConvertLeadDto {
  @IsBoolean()
  createDeal!: boolean;

  @ValidateIf((o: ConvertLeadDto) => o.createDeal)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  dealTitle?: string;

  @ValidateIf((o: ConvertLeadDto) => o.createDeal)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  dealValue?: number;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;
}
