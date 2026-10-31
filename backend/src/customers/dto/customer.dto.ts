import { CustomerStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  /** Empty string clears the value. */
  @ValidateIf((o: CreateCustomerDto) => o.email !== undefined && o.email !== '')
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** Values for CRM Fields, keyed by field key: { city: "Hyderabad", ltv: 50000 } */
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
