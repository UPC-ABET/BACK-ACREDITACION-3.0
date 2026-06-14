import {
	IsBoolean,
	IsNumber,
	IsObject,
	IsOptional,
	IsNotEmpty,
	IsString,
	Length,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateStudyPlanCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	studyPlanAcademicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	courseId: number;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	isElective: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	levelTypeId: number;
}

export class UpdateStudyPlanCourseDto {
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
	studyPlanAcademicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	courseId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isElective?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	levelTypeId?: number;
}

export class NewStudyPlanCourseDto {
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'CS101' })
	code: string;

	@IsObject()
	@ApiProperty({ example: { es: 'Cálculo I', en: 'Calculus I' } })
	name: I18nText;

	@IsOptional()
	@IsObject()
	@ApiPropertyOptional({ example: { es: 'Resultado de aprendizaje', en: 'Learning outcome' } })
	learningOutcome?: I18nText;
}

export class CreateStudyPlanCourseMaintenanceDto {
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Study plan id; the period comes from X-Academic-Period-Id',
	})
	studyPlanId: number;

	@IsBoolean()
	@ApiProperty({ example: false })
	isElective: boolean;

	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Level type id (group TG203); required even when isElective is true',
	})
	levelTypeId: number;

	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({
		example: 1,
		description: 'Existing course id (link mode). Provide this OR newCourse, not both.',
	})
	courseId?: number;

	@IsOptional()
	@ValidateNested()
	@Type(() => NewStudyPlanCourseDto)
	@ApiPropertyOptional({
		type: NewStudyPlanCourseDto,
		description: 'New course to find-or-create and link. Provide this OR courseId, not both.',
	})
	newCourse?: NewStudyPlanCourseDto;
}

export interface StudyPlanCourseMaintenanceItem {
	id: number;
	courseId: number;
	courseCode: string;
	courseName: I18nText;
	learningOutcome: I18nText;
	levelTypeId: number;
	isElective: boolean;
}

export class EnableEvaluationDto {
	@IsNotEmpty()
	@IsBoolean()
	@ApiProperty({
		example: true,
		required: true,
		description: 'Habilita o deshabilita la evaluacion del curso (rubricas y proyectos)',
	})
	isEvaluable: boolean;
}

export class FilterStudyPlanCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({
		example: true,
		required: false,
		description:
			'Filtra cursos habilitados o deshabilitados para evaluacion (rubricas y proyectos)',
	})
	isEvaluable?: boolean;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	studyPlanAcademicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	courseId?: number;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isElective?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	levelTypeId?: number;
}
