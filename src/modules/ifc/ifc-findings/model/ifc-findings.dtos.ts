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
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
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
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
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
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
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
		example: [1, 2, 3],
		required: true,
		description: 'IDs de nodos chart (todos a nivel COURSE_COORDINATOR)',
	})
	@IsArray()
	@ArrayNotEmpty()
	@IsInt({ each: true })
	chartIds: number[];

	@ApiProperty({ example: 1, required: true })
	@IsInt()
	@IsPositive()
	periodId: number;
}

export class IfcFindingRowDto {
	@ApiProperty({ example: 1 }) id: number;
	@ApiProperty({ example: 1 }) ifcId: number;
	@ApiProperty({ example: 1 }) courseId: number;
	@ApiProperty({ example: 'criticalityCodeExample' }) criticalityCode: string;
	@ApiProperty({ example: { es: 'criticalityNameEs', en: 'criticalityNameEn' }, type: Object }) criticalityName: I18nText;
	@ApiProperty({ example: 1 }) criticalityOrder: number;
	@ApiProperty({ example: 'findingCodeExample' }) findingCode: string;
	@ApiProperty({ example: 'academicPeriodCodeExample' }) academicPeriodCode: string;
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, type: Object }) description: I18nText;
}

// --- Request: PATCH /:id ----------------------------------------------------

export class PatchIfcFindingDto {
	@ApiProperty({
		example: { es: 'descriptionEs', en: 'descriptionEn' },
		required: true,
	})
	@IsObject()
	description: I18nText;
}

// --- Response: GET /get-by-id/:id ------------------------------------------

export class IfcFindingActionCompletenessDto {
	@ApiProperty({ example: 'codeExample' }) code: string;
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, type: Object }) name: I18nText;
	@ApiProperty({ nullable: true, example: 'colorExample' }) color: string | null;
}

export class IfcFindingActionDetailDto {
	@ApiProperty({ example: 1 }) id: number;
	@ApiProperty({ example: 'actionCodeExample' }) actionCode: string;
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, type: Object }) description: I18nText;
	@ApiProperty({ example: {}, type: () => IfcFindingActionCompletenessDto })
	completeness: IfcFindingActionCompletenessDto;
}

export class IfcFindingCriticalityDto {
	@ApiProperty({ example: 'codeExample' }) code: string;
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, type: Object }) name: I18nText;
}

export class IfcFindingDetailDto {
	@ApiProperty({ example: 1 }) id: number;
	@ApiProperty({ example: 'findingCodeExample' }) findingCode: string;
	@ApiProperty({ example: 'academicPeriodCodeExample' }) academicPeriodCode: string;
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, type: Object }) description: I18nText;
	@ApiProperty({ example: {}, type: () => IfcFindingCriticalityDto }) criticality: IfcFindingCriticalityDto;
}

export class IfcFindingDetailResponseDto {
	@ApiProperty({ example: {}, type: () => IfcFindingDetailDto }) finding: IfcFindingDetailDto;
	@ApiProperty({ example: {}, type: [IfcFindingActionDetailDto] }) actions: IfcFindingActionDetailDto[];
}
