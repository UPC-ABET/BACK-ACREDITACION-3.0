// no-override
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsInt,
	IsNumber,
	IsObject,
	IsOptional,
	IsPositive,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateIfcFindingDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	ifcId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	findingId: number;
}

export class UpdateIfcFindingDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	ifcId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	findingId?: number;
}

export class FilterIfcFindingDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	ifcId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	findingId?: number;
}

// %% OTHER DTOS

export class ListIfcFindingsDto {
	@ApiProperty({
		example: [310, 311, 312],
		required: true,
		description: 'IDs de nodos chart (todos a nivel COURSE_COORDINATOR)',
	})
	@IsArray()
	@ArrayNotEmpty()
	@IsInt({ each: true })
	chartIds: number[];

	@ApiProperty({ example: 5, required: true })
	@IsInt()
	@IsPositive()
	periodId: number;
}

export class IfcFindingRowDto {
	@ApiProperty() id: number;
	@ApiProperty() ifcId: number;
	@ApiProperty() courseId: number;
	@ApiProperty() criticalityCode: string;
	@ApiProperty({ type: Object }) criticalityName: I18nText;
	@ApiProperty() criticalityOrder: number;
	@ApiProperty() findingCode: string;
	@ApiProperty() academicPeriodCode: string;
	@ApiProperty({ type: Object }) description: I18nText;
}

// --- Request: PATCH /:id ----------------------------------------------------

export class PatchIfcFindingDto {
	@ApiProperty({
		example: { es: 'Descripción actualizada', en: 'Updated description' },
		required: true,
	})
	@IsObject()
	description: I18nText;
}

// --- Response: GET /get-by-id/:id ------------------------------------------

export class IfcFindingActionCompletenessDto {
	@ApiProperty() code: string;
	@ApiProperty({ type: Object }) name: I18nText;
	@ApiProperty({ nullable: true, example: '#10B981' }) color: string | null;
}

export class IfcFindingActionDetailDto {
	@ApiProperty() id: number;
	@ApiProperty() actionCode: string;
	@ApiProperty({ type: Object }) description: I18nText;
	@ApiProperty({ type: () => IfcFindingActionCompletenessDto })
	completeness: IfcFindingActionCompletenessDto;
}

export class IfcFindingCriticalityDto {
	@ApiProperty() code: string;
	@ApiProperty({ type: Object }) name: I18nText;
}

export class IfcFindingDetailDto {
	@ApiProperty() id: number;
	@ApiProperty() findingCode: string;
	@ApiProperty() academicPeriodCode: string;
	@ApiProperty({ type: Object }) description: I18nText;
	@ApiProperty({ type: () => IfcFindingCriticalityDto }) criticality: IfcFindingCriticalityDto;
}

export class IfcFindingDetailResponseDto {
	@ApiProperty({ type: () => IfcFindingDetailDto }) finding: IfcFindingDetailDto;
	@ApiProperty({ type: [IfcFindingActionDetailDto] }) actions: IfcFindingActionDetailDto[];
}
