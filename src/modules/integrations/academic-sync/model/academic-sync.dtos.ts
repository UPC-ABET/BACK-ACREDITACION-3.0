import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import type { I18nText } from 'src/shared/types/i18n';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';

export class AcademicSyncAcademicPeriodQueryDto {
	@IsInt()
	@Min(1)
	@Type(() => Number)
	@ApiProperty({ example: 12, description: 'Academic period id to scope the query to' })
	academicPeriodId: number;
}

export class AcademicSyncUsersQueryDto extends PaginationQueryDto {}

export class AcademicSyncPeriodDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: '2026-1' })
	code: string;

	@ApiProperty({ example: '2026-03-01T00:00:00.000Z' })
	startDate: Date;

	@ApiProperty({ example: '2026-07-15T00:00:00.000Z' })
	endDate: Date;

	@ApiProperty({ example: 2026 })
	year: number;

	@ApiProperty({ example: 1 })
	modalityTypeId: number;
}

export class AcademicSyncCampusDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 'LIM' })
	code: string;

	@ApiProperty({ example: { es: 'Campus Lima', en: 'Lima Campus' } })
	name: I18nText;
}

export class AcademicSyncCampusRefDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 'LIM' })
	code: string;

	@ApiProperty({ example: { es: 'Campus Lima', en: 'Lima Campus' } })
	name: I18nText;
}

export class AcademicSyncProgramRefDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 'ISW' })
	code: string;

	@ApiProperty({ example: { es: 'Ingenieria de Software', en: 'Software Engineering' } })
	name: I18nText;
}

export class AcademicSyncCommissionRefDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 'EAC' })
	code: string;

	@ApiProperty({ example: { es: 'Comision EAC', en: 'EAC Commission' } })
	name: I18nText;
}

export class AcademicSyncModalityRefDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 'TG103-T001' })
	code: string;

	@ApiProperty({ example: { es: 'Presencial', en: 'In-person' } })
	name: I18nText;
}

export class AcademicSyncSectionDto {
	@ApiProperty({ example: 501 })
	id: number;

	@ApiProperty({ example: '4321' })
	sectionCode: string;

	@ApiProperty({ type: AcademicSyncCampusRefDto, nullable: true })
	campus: AcademicSyncCampusRefDto | null;

	@ApiProperty({ type: AcademicSyncModalityRefDto, nullable: true })
	modality: AcademicSyncModalityRefDto | null;
}

export class AcademicSyncCourseDto {
	@ApiProperty({ example: 77 })
	id: number;

	@ApiProperty({ example: 'CS301' })
	code: string;

	@ApiProperty({ example: { es: 'Estructuras de Datos', en: 'Data Structures' } })
	name: I18nText;

	@ApiProperty({ example: { es: 'Descripcion del curso', en: 'Course description' } })
	description: I18nText;

	@ApiProperty({ example: { es: 'Resultado de aprendizaje', en: 'Learning outcome' } })
	learningOutcome: I18nText;

	@ApiProperty({ type: AcademicSyncProgramRefDto })
	program: AcademicSyncProgramRefDto;

	@ApiProperty({ type: AcademicSyncCommissionRefDto, nullable: true })
	commission: AcademicSyncCommissionRefDto | null;

	@ApiProperty({ type: AcademicSyncSectionDto, isArray: true })
	sections: AcademicSyncSectionDto[];
}

export class AcademicSyncOrgChartStaffDto {
	@ApiProperty({ example: 10 })
	id: number;

	@ApiProperty({ example: 'Maria' })
	firstName: string;

	@ApiProperty({ example: 'Lopez' })
	lastName: string;

	@ApiProperty({ example: 'maria.lopez@upc.edu.pe', nullable: true })
	email: string | null;

	@ApiProperty({
		example: { es: 'Docente Tiempo Completo', en: 'Full-Time Faculty' },
		nullable: true,
	})
	title: I18nText | null;

	@ApiProperty({ example: 'PROF123', nullable: true })
	professorCode: string | null;
}

export class AcademicSyncEntityRefDto {
	@ApiProperty({ example: 'ISW' })
	code: string;

	@ApiProperty({ example: { es: 'Ingenieria de Software', en: 'Software Engineering' } })
	name: I18nText;
}

export class AcademicSyncOrgChartNodeDto {
	@ApiProperty({ example: 100 })
	id: number;

	@ApiProperty({ example: 5, nullable: true })
	parentId: number | null;

	@ApiProperty({ example: 'COURSE', nullable: true })
	entityType: string | null;

	@ApiProperty({ example: { es: 'Director de Escuela', en: 'School Director' } })
	organizationLevelTitle: I18nText;

	@ApiProperty({ type: AcademicSyncEntityRefDto, nullable: true })
	entity: AcademicSyncEntityRefDto | null;

	@ApiProperty({ example: 77, nullable: true })
	entityCode: number | null;

	@ApiProperty({ type: AcademicSyncOrgChartStaffDto, nullable: true })
	staff: AcademicSyncOrgChartStaffDto | null;
}

export class AcademicSyncUserDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 12345678, nullable: true })
	documentCode: number | null;

	@ApiProperty({ example: 'Maria' })
	firstName: string;

	@ApiProperty({ example: 'Lopez' })
	lastName: string;

	@ApiProperty({ example: 'maria.lopez@upc.edu.pe' })
	email: string;

	@ApiProperty({ example: '+51999999999', nullable: true })
	phone: string | null;
}

export class AcademicSyncUsersPageDto {
	@ApiProperty({ type: AcademicSyncUserDto, isArray: true })
	items: AcademicSyncUserDto[];

	@ApiProperty({ example: 532 })
	total: number;

	@ApiProperty({ example: 1 })
	page: number;

	@ApiProperty({ example: 20 })
	pageSize: number;

	@ApiProperty({ example: 27 })
	totalPages: number;
}
