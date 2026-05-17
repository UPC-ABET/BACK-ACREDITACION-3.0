// no-override
import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateIfcFindingDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	ifc_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	finding_id: number;
}

export class UpdateIfcFindingDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	ifc_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	finding_id?: number;
}

export class FilterIfcFindingDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	ifc_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	finding_id?: number;
}

// %% OTHERS DTO

export class ListIfcFindingsDto {
	@ApiProperty({ example: [310, 311, 312], required: true, description: 'IDs de nodos chart (todos a nivel COURSE_COORDINATOR)' })
	@IsArray()
	@ArrayNotEmpty()
	@IsInt({ each: true })
	chart_ids: number[];

	@ApiProperty({ example: 5, required: true })
	@IsInt()
	@IsPositive()
	period_id: number;
}

export class IfcFindingRowDto {
	@ApiProperty() id: number;
	@ApiProperty() ifc_id: number;
	@ApiProperty() course_id: number;
	@ApiProperty() criticality_code: string;
	@ApiProperty({ type: Object }) criticality_name: I18nText;
	@ApiProperty() criticality_order: number;
	@ApiProperty() finding_code: string;
	@ApiProperty() academic_period_code: string;
	@ApiProperty({ type: Object }) description: I18nText;
}

// --- Request: PATCH /:id ----------------------------------------------------

export class PatchIfcFindingDto {
	@ApiProperty({ example: { es: 'Descripción actualizada', en: 'Updated description' }, required: true })
	@IsObject()
	description: I18nText;
}

// --- Response: GET /get-by-id/:id ------------------------------------------

export class IfcFindingActionDetailDto {
	@ApiProperty() id: number;
	@ApiProperty() action_code: string;
	@ApiProperty({ type: Object }) description: I18nText;
	@ApiProperty() completeness_code: string;
	@ApiProperty({ type: Object }) completeness_name: I18nText;
}

export class IfcFindingCriticalityDto {
	@ApiProperty() code: string;
	@ApiProperty({ type: Object }) name: I18nText;
}

export class IfcFindingDetailDto {
	@ApiProperty() id: number;
	@ApiProperty() finding_code: string;
	@ApiProperty() academic_period_code: string;
	@ApiProperty({ type: Object }) description: I18nText;
	@ApiProperty({ type: () => IfcFindingCriticalityDto }) criticality: IfcFindingCriticalityDto;
}

export class IfcFindingDetailResponseDto {
	@ApiProperty({ type: () => IfcFindingDetailDto }) finding: IfcFindingDetailDto;
	@ApiProperty({ type: [IfcFindingActionDetailDto] }) actions: IfcFindingActionDetailDto[];
}
