// no-override

import { ApiProperty } from '@nestjs/swagger';
import {
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { I18nText } from 'src/shared/types/i18n';

export class IfcFindingPayloadDto {
	@ApiProperty({
		example: 'tempIdExample',
		required: true,
		description:
			'Cliente: UUID que identifica al hallazgo en la sesión actual (referenciado por acciones)',
	})
	@IsString()
	tempId: string;

	@ApiProperty({
		example: 1,
		nullable: true,
		required: true,
		description: 'null = nuevo; número = id existente a actualizar',
	})
	@IsOptional()
	@IsInt()
	id: number | null;

	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: true })
	@IsObject()
	description: I18nText;

	@ApiProperty({
		example: 'criticalityCodeExample',
		required: true,
		description: 'Código de TYPE_CODES.CRITICALITY.*',
	})
	@IsString()
	criticalityCode: string;
}

export class IfcActionPayloadDto {
	@ApiProperty({ example: 'tempIdExample', required: true })
	@IsString()
	tempId: string;

	@ApiProperty({ example: 1, nullable: true, required: true })
	@IsOptional()
	@IsInt()
	id: number | null;

	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: true })
	@IsObject()
	description: I18nText;

	@ApiProperty({
		example: 'findingTempIdExample',
		required: true,
		description: 'tempId del hallazgo al que pertenece (se resuelve a finding_id en el backend)',
	})
	@IsString()
	findingTempId: string;
}

export class IfcPreviousActionPayloadDto {
	@ApiProperty({
		example: 1,
		required: true,
		description:
			'id de improvement.finding_actions (rows previas reutilizadas). Solo se permiten ids devueltos por GET (previous_actions)',
	})
	@IsInt()
	findingActionId: number;

	@ApiProperty({
		example: { es: 'evidencesEs', en: 'evidencesEn' },
		nullable: true,
		required: true,
		description:
			'I18nText con la evidencia, o null para volver el estado a Pendiente (limpia evidencias)',
	})
	@ValidateIf((_, v) => v !== null)
	@IsObject()
	evidences: I18nText | null;
}

export class IfcContentDto {
	@ApiProperty({
		example: true,
		required: true,
		description: 'true = al guardar, transicionar a SUBMITTED; false = quedar en SAVED',
	})
	@IsBoolean()
	submit: boolean;

	@ApiProperty({
		example: { key: 'informationValue' },
		required: false,
		description:
			'Map keyed por `PARAMETER_IFC_FIELDS[].key` → valor I18nText. Almacenado tal cual en evidence.ifcs.information.',
	})
	@IsOptional()
	@IsObject()
	information?: Record<string, I18nText>;

	@ApiProperty({ example: {}, type: [IfcFindingPayloadDto], required: true })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IfcFindingPayloadDto)
	findings: IfcFindingPayloadDto[];

	@ApiProperty({ example: {}, type: [IfcActionPayloadDto], required: true })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IfcActionPayloadDto)
	actions: IfcActionPayloadDto[];

	@ApiProperty({ example: [1, 2, 3], required: false })
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ArrayUnique()
	deletedFindingIds?: number[];

	@ApiProperty({ example: [1, 2, 3], required: false })
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ArrayUnique()
	deletedActionIds?: number[];

	@ApiProperty({
		example: {},
		type: [IfcPreviousActionPayloadDto],
		required: false,
		description:
			'Actualiza el campo `evidences` (I18nText|null) de filas de improvement.finding_actions reutilizadas de periodos previos. Solo se aceptan ids del set devuelto por GET (previous_actions).',
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IfcPreviousActionPayloadDto)
	previousActions?: IfcPreviousActionPayloadDto[];
}

export class CreateIfcDto extends IfcContentDto {
	@ApiProperty({
		example: 1,
		required: true,
		description: 'id del nodo chart del coordinador del curso (level COURSE_COORDINATOR)',
	})
	@IsInt()
	chartId: number;

	@ApiProperty({ example: 1, required: true })
	@IsInt()
	periodId: number;
}

export class IfcPrefillQueryDto {
	@ApiProperty({ example: 1, required: true })
	@IsInt()
	@Type(() => Number)
	chartId: number;

	@ApiProperty({ example: 1, required: true })
	@IsInt()
	@Type(() => Number)
	periodId: number;
}

export class IfcPrefillResponseDto {
	@ApiProperty({ example: { es: 'courseNameEs', en: 'courseNameEn' }, type: Object })
	courseName: I18nText;
	@ApiProperty({
		example: { es: 'course_learning_outcomeEs', en: 'course_learning_outcomeEn' },
		type: Object,
	})
	course_learning_outcome: I18nText;
	@ApiProperty({ example: { es: 'area_labelEs', en: 'area_labelEn' }, type: Object })
	area_label: I18nText;
	@ApiProperty({ example: { es: 'subarea_labelEs', en: 'subarea_labelEn' }, type: Object })
	subarea_label: I18nText;
	@ApiProperty({ example: 'academic_period_codeExample' }) academic_period_code: string;
	@ApiProperty({ example: 'coordinator_codeExample', nullable: true }) coordinator_code:
		| string
		| null;
	@ApiProperty({ example: 'coordinator_nameExample', nullable: true }) coordinator_name:
		| string
		| null;
	@ApiProperty({ example: 1, nullable: true }) coordinator_user_id: number | null;
	@ApiProperty({
		example: [{ key: 'outcomeCourseResultValue' }],
		type: 'array',
		items: { type: 'object' },
	})
	outcomeCourseResult: any[];
}
