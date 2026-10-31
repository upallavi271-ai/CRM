import { CustomFieldType } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';

export const FIELD_ENTITIES = ['customer'] as const;

export class CreateCustomFieldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  /** Optional; generated from name when missing. Can't be changed later. */
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]{0,49}$/, {
    message:
      'key must start with a letter and use only lowercase letters, numbers and _',
  })
  key?: string;

  @IsEnum(CustomFieldType)
  type!: CustomFieldType;

  @IsOptional()
  @IsIn(FIELD_ENTITIES)
  entity?: (typeof FIELD_ENTITIES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class UpdateCustomFieldDto extends PartialType(
  OmitType(CreateCustomFieldDto, ['key', 'entity'] as const),
) {}

export class ReorderCustomFieldsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  ids!: string[];
}
