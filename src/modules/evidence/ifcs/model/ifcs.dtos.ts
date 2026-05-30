// no-override

import {
	ArrayMaxSize,
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsIn,
	IsInt,
	IsNumber,
	IsObject,
	IsOptional,
	IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateIfcDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	courseId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academicPeriodId: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'informationValue' }, required: false })
	information?: any;
}

export class UpdateIfcDto {
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
	courseId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'informationValue' }, required: false })
	information?: any;
}

export class FilterIfcDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	courseId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'informationValue' }, required: false })
	information?: any;
}

// %% OTHER DTOS

export class ListIfcsDto {
	@IsArray()
	@ArrayNotEmpty()
	@IsInt({ each: true })
	@ApiProperty({
		example: [1, 2, 3],
		required: true,
		description: 'IDs de nodos de chart (todos nivel Coordinador de Curso)',
	})
	chartIds: number[];

	@IsInt()
	@IsPositive()
	@ApiProperty({ example: 1, required: true, description: 'ID del período académico' })
	periodId: number;
}

// --- Request DTO for /reject -------------------------------------------------

export class IfcPdfQueryDto {
	@ApiProperty({ example: 'es', required: false, enum: ['es', 'en'] })
	@IsOptional()
	@IsIn(['es', 'en'])
	lang?: 'es' | 'en';
}

export class IfcPdfBulkDto {
	@ApiProperty({ example: [1, 2, 3], required: true })
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(50)
	@IsInt({ each: true })
	@Type(() => Number)
	ifcIds: number[];

	@ApiProperty({ example: 'es', required: true, enum: ['es', 'en'] })
	@IsIn(['es', 'en'])
	lang: 'es' | 'en';
}

export class IfcStatusReportDto {
	@ApiProperty({ example: [1, 2, 3], required: true })
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(500)
	@IsInt({ each: true })
	@Type(() => Number)
	chartIds: number[];

	@ApiProperty({ example: 1, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	periodId: number;

	@ApiProperty({ example: 'es', required: true, enum: ['es', 'en'] })
	@IsIn(['es', 'en'])
	lang: 'es' | 'en';
}

export class IfcNotifyDto {
	@ApiProperty({ example: 1, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	chartId: number;

	@ApiProperty({ example: 1, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	periodId: number;
}

export class IfcNotifyAllDto {
	@ApiProperty({ example: [1, 2, 3], required: true })
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(500)
	@IsInt({ each: true })
	@Type(() => Number)
	chartIds: number[];

	@ApiProperty({ example: 1, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	periodId: number;
}

export class NotificationDispatchResultDto {
	@ApiProperty({ example: true }) sent: boolean;
	@ApiProperty({ example: 1 }) recipientsCount: number;
	@ApiProperty({ example: 1 }) ccCount: number;
	@ApiProperty({ example: 'reasonExample', nullable: true }) reason: string | null;
}

export class NotifyAllResultDto {
	@ApiProperty({ example: [1, 2, 3] }) sent: number[];
	@ApiProperty({ example: [1, 2, 3] }) skipped: number[];
	@ApiProperty({ example: [] }) errors: Array<{ chartId: number; message: string }>;
}

export class RejectIfcDto {
	@ApiProperty({
		example: { es: 'commentEs', en: 'commentEn' },
		required: true,
		description: 'Motivo de rechazo (jsonb i18n) — el frontend llena al menos el idioma activo',
	})
	@IsObject()
	comment: I18nText;
}

// --- Response DTOs (Swagger documentation only) ------------------------------

export class IfcCoordinatorDto {
	@ApiProperty({ example: 1 }) userId: number | null;
	@ApiProperty({ example: 'codeExample', nullable: true }) code: string | null;
	@ApiProperty({ example: 'nameExample' }) name: string | null;
}

export class IfcStatusInfoDto {
	@ApiProperty({ example: 'codeExample' }) code: string;
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, type: Object }) name: I18nText;
	@ApiProperty({ nullable: true, example: 'colorExample' }) color: string | null;
	@ApiProperty({ example: 'atExample' }) at: string;
	@ApiProperty({ example: { es: 'commentEs', en: 'commentEn' }, type: Object, nullable: true }) comment: I18nText | null;
	@ApiProperty({ example: 'byExample', nullable: true }) by: string | null;
}

export class IfcHeaderDto {
	@ApiProperty({ example: 1 }) id: number;
	@ApiProperty({ example: { key: 'informationValue' }, type: Object }) information: Record<string, unknown>;
	@ApiProperty({ example: { key: 'extraValue' }, type: Object }) extra: Record<string, unknown>;
	@ApiProperty({ example: 'createdAtExample' }) createdAt: string;
	@ApiProperty({ example: 'academic_period_codeExample' }) academic_period_code: string;
	@ApiProperty({ example: { es: 'program_labelEs', en: 'program_labelEn' }, type: Object }) program_label: I18nText;
	@ApiProperty({ example: { es: 'area_labelEs', en: 'area_labelEn' }, type: Object }) area_label: I18nText;
	@ApiProperty({ example: { es: 'subarea_labelEs', en: 'subarea_labelEn' }, type: Object }) subarea_label: I18nText;
	@ApiProperty({ example: 'course_codeExample', nullable: true }) course_code: string | null;
	@ApiProperty({ example: { es: 'courseNameEs', en: 'courseNameEn' }, type: Object }) courseName: I18nText;
	@ApiProperty({ example: { es: 'course_learning_outcomeEs', en: 'course_learning_outcomeEn' }, type: Object }) course_learning_outcome: I18nText;
	@ApiProperty({ example: {}, type: () => IfcCoordinatorDto }) coordinator: IfcCoordinatorDto;
	@ApiProperty({ example: {}, type: () => IfcStatusInfoDto, nullable: true }) status: IfcStatusInfoDto | null;
	@ApiProperty({
		example: true,
		description:
			'True when the requester is the own coordinator OR any ancestor of the course in the chart tree. Drives the Edit button on the view page.',
	})
	requesterInChain: boolean;
}

export class IfcOutcomeItemDto {
	@ApiProperty({ example: 'outcomeCodeExample' }) outcomeCode: string;
	@ApiProperty({ example: { es: 'outcomeNameEs', en: 'outcomeNameEn' }, type: Object }) outcomeName: I18nText;
	@ApiProperty({ example: { es: 'outcomeDescriptionEs', en: 'outcomeDescriptionEn' }, type: Object }) outcomeDescription: I18nText;
}

export class IfcCommissionGroupDto {
	@ApiProperty({ example: 'commission_codeExample' }) commission_code: string;
	@ApiProperty({ example: { es: 'commission_nameEs', en: 'commission_nameEn' }, type: Object }) commission_name: I18nText;
	@ApiProperty({ example: {}, type: [IfcOutcomeItemDto] }) outcomes: IfcOutcomeItemDto[];
}

export class IfcProgramGroupDto {
	@ApiProperty({ example: 'program_codeExample' }) program_code: string;
	@ApiProperty({ example: { es: 'program_nameEs', en: 'program_nameEn' }, type: Object }) program_name: I18nText;
	@ApiProperty({ example: {}, type: [IfcCommissionGroupDto] }) commissions: IfcCommissionGroupDto[];
}

export class IfcFindingOutcomeDto extends IfcOutcomeItemDto {
	@ApiProperty({ example: { es: 'Ejemplo', en: 'Example' }, type: Object }) commission: { code: string; name: I18nText };
}

export class IfcCompletenessDto {
	@ApiProperty({ example: 'codeExample' }) code: string;
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, type: Object }) name: I18nText;
	@ApiProperty({ nullable: true, example: 'colorExample' }) color: string | null;
}

export class IfcFindingActionDto {
	@ApiProperty({ example: 1 }) id: number;
	@ApiProperty({ example: 'codeExample' }) code: string;
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, type: Object }) description: I18nText;
	@ApiProperty({ example: 1 }) correlative: number;
	@ApiProperty({ example: {}, type: () => IfcCompletenessDto }) completeness: IfcCompletenessDto;
}

export class IfcFindingDto {
	@ApiProperty({ example: 1 }) id: number;
	@ApiProperty({ example: 'codeExample' }) code: string;
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, type: Object }) description: I18nText;
	@ApiProperty({ example: 1 }) correlative: number;
	@ApiProperty({ example: true }) isAutomatic: boolean;
	@ApiProperty({ example: { es: 'Ejemplo', en: 'Example' }, type: Object }) criticality: {
		code: string;
		name: I18nText;
		color: string | null;
	};
	@ApiProperty({ example: {}, type: [IfcFindingOutcomeDto] }) outcomes: IfcFindingOutcomeDto[];
	@ApiProperty({ example: {}, type: [IfcFindingActionDto] }) actions: IfcFindingActionDto[];
}

export class IfcViewResponseDto {
	@ApiProperty({ example: {}, type: () => IfcHeaderDto }) ifc: IfcHeaderDto;
	@ApiProperty({ example: {}, type: [IfcProgramGroupDto] }) outcomeCourseResult: IfcProgramGroupDto[];
	@ApiProperty({ example: {}, type: [IfcFindingDto] }) findings: IfcFindingDto[];
}
