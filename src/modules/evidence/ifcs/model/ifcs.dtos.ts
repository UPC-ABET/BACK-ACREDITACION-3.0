// no-override

import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateIfcDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	course_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'information_value' }, required: false })
	information?: any;
}

export class UpdateIfcDto extends BaseDto {
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
	course_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'information_value' }, required: false })
	information?: any;
}

export class FilterIfcDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	course_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'information_value' }, required: false })
	information?: any;
}

// %% OTHERS DTO

export class ListIfcsDto {
	@IsArray()
	@ArrayNotEmpty()
	@IsInt({ each: true })
	@ApiProperty({
		example: [310, 311, 312],
		required: true,
		description: 'IDs de nodos de chart (todos nivel Coordinador de Curso)',
	})
	chart_ids: number[];

	@IsInt()
	@IsPositive()
	@ApiProperty({ example: 5, required: true, description: 'ID del período académico' })
	period_id: number;
}

// --- Request DTO for /reject -------------------------------------------------

export class IfcPdfQueryDto {
	@ApiProperty({ example: 'es', required: false, enum: ['es', 'en'] })
	@IsOptional()
	@IsIn(['es', 'en'])
	lang?: 'es' | 'en';
}

export class IfcPdfBulkDto {
	@ApiProperty({ example: [88, 91, 104], required: true })
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(50)
	@IsInt({ each: true })
	@Type(() => Number)
	ifc_ids: number[];

	@ApiProperty({ example: 'es', required: true, enum: ['es', 'en'] })
	@IsIn(['es', 'en'])
	lang: 'es' | 'en';
}

export class IfcStatusReportDto {
	@ApiProperty({ example: [310, 311, 312], required: true })
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(500)
	@IsInt({ each: true })
	@Type(() => Number)
	chart_ids: number[];

	@ApiProperty({ example: 5, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	period_id: number;

	@ApiProperty({ example: 'es', required: true, enum: ['es', 'en'] })
	@IsIn(['es', 'en'])
	lang: 'es' | 'en';
}

export class IfcNotifyDto {
	@ApiProperty({ example: 310, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	chart_id: number;

	@ApiProperty({ example: 5, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	period_id: number;
}

export class IfcNotifyAllDto {
	@ApiProperty({ example: [310, 311, 312], required: true })
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(500)
	@IsInt({ each: true })
	@Type(() => Number)
	chart_ids: number[];

	@ApiProperty({ example: 5, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	period_id: number;
}

export class NotificationDispatchResultDto {
	@ApiProperty({ example: true }) sent: boolean;
	@ApiProperty({ example: 1 }) recipients_count: number;
	@ApiProperty({ example: 2 }) cc_count: number;
	@ApiProperty({ nullable: true }) reason: string | null;
}

export class NotifyAllResultDto {
	@ApiProperty({ example: [310, 312] }) sent: number[];
	@ApiProperty({ example: [311] }) skipped: number[];
	@ApiProperty({ example: [] }) errors: Array<{ chart_id: number; message: string }>;
}

export class RejectIfcDto {
	@ApiProperty({
		example: { es: 'Faltan evidencias en la sección 3', en: 'Missing evidence in section 3' },
		required: true,
		description: 'Motivo de rechazo (jsonb i18n) — el frontend llena al menos el idioma activo',
	})
	@IsObject()
	comment: I18nText;
}

// --- Response DTOs (Swagger documentation only) ------------------------------

export class IfcCoordinatorDto {
	@ApiProperty() user_id: number | null;
	@ApiProperty({ nullable: true }) code: string | null;
	@ApiProperty() name: string | null;
}

export class IfcStatusInfoDto {
	@ApiProperty() code: string;
	@ApiProperty({ type: Object }) name: I18nText;
	@ApiProperty({ nullable: true, example: '#22c55e' }) color: string | null;
	@ApiProperty() at: string;
	@ApiProperty({ type: Object, nullable: true }) comment: I18nText | null;
	@ApiProperty({ nullable: true }) by: string | null;
}

export class IfcHeaderDto {
	@ApiProperty() id: number;
	@ApiProperty({ type: Object }) information: Record<string, unknown>;
	@ApiProperty({ type: Object }) extra: Record<string, unknown>;
	@ApiProperty() created_at: string;
	@ApiProperty() academic_period_code: string;
	@ApiProperty({ type: Object }) program_label: I18nText;
	@ApiProperty({ type: Object }) area_label: I18nText;
	@ApiProperty({ type: Object }) subarea_label: I18nText;
	@ApiProperty({ nullable: true }) course_code: string | null;
	@ApiProperty({ type: Object }) course_name: I18nText;
	@ApiProperty({ type: Object }) course_learning_outcome: I18nText;
	@ApiProperty({ type: () => IfcCoordinatorDto }) coordinator: IfcCoordinatorDto;
	@ApiProperty({ type: () => IfcStatusInfoDto, nullable: true }) status: IfcStatusInfoDto | null;
	@ApiProperty({ description: 'True when the requester is the own coordinator OR any ancestor of the course in the chart tree. Drives the Edit button on the view page.' })
	requester_in_chain: boolean;
}

export class IfcOutcomeItemDto {
	@ApiProperty() outcome_code: string;
	@ApiProperty({ type: Object }) outcome_name: I18nText;
	@ApiProperty({ type: Object }) outcome_description: I18nText;
}

export class IfcCommissionGroupDto {
	@ApiProperty() commission_code: string;
	@ApiProperty({ type: Object }) commission_name: I18nText;
	@ApiProperty({ type: [IfcOutcomeItemDto] }) outcomes: IfcOutcomeItemDto[];
}

export class IfcProgramGroupDto {
	@ApiProperty() program_code: string;
	@ApiProperty({ type: Object }) program_name: I18nText;
	@ApiProperty({ type: [IfcCommissionGroupDto] }) commissions: IfcCommissionGroupDto[];
}

export class IfcFindingOutcomeDto extends IfcOutcomeItemDto {
	@ApiProperty({ type: Object }) commission: { code: string; name: I18nText };
}

export class IfcFindingActionDto {
	@ApiProperty() id: number;
	@ApiProperty() code: string;
	@ApiProperty({ type: Object }) description: I18nText;
	@ApiProperty() correlative: number;
	@ApiProperty() completeness_code: string;
	@ApiProperty({ type: Object }) completeness_name: I18nText;
}

export class IfcFindingDto {
	@ApiProperty() id: number;
	@ApiProperty() code: string;
	@ApiProperty({ type: Object }) description: I18nText;
	@ApiProperty() correlative: number;
	@ApiProperty() is_automatic: boolean;
	@ApiProperty({ type: Object }) criticality: { code: string; name: I18nText; color: string | null };
	@ApiProperty({ type: [IfcFindingOutcomeDto] }) outcomes: IfcFindingOutcomeDto[];
	@ApiProperty({ type: [IfcFindingActionDto] }) actions: IfcFindingActionDto[];
}

export class IfcViewResponseDto {
	@ApiProperty({ type: () => IfcHeaderDto }) ifc: IfcHeaderDto;
	@ApiProperty({ type: [IfcProgramGroupDto] }) outcome_course_result: IfcProgramGroupDto[];
	@ApiProperty({ type: [IfcFindingDto] }) findings: IfcFindingDto[];
}
