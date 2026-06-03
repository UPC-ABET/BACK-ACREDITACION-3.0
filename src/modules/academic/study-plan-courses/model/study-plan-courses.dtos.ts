import { IsBoolean, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

export class EnableEvaluationDto {
	@IsNotEmpty()
	@IsBoolean()
	@ApiProperty({ example: true, required: true, description: 'Habilita o deshabilita la evaluacion del curso (rubricas y proyectos)' })
	isEvaluable: boolean;
}

export class FilterStudyPlanCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false, description: 'Filtra cursos habilitados o deshabilitados para evaluacion (rubricas y proyectos)' })
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
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	schoolId?: number;

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
