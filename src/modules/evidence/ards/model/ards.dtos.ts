import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsDateString,
	IsIn,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	Length,
	Min,
	ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateArdDto {
	@IsDateString()
	@ApiProperty({ example: '2026-06-23T15:00:00.000Z' })
	meetingDate: string;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	campusId: number;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	programId: number;
}

export class UpdateArdDto {
	@IsOptional()
	@IsDateString()
	@ApiPropertyOptional({ example: '2026-06-23T15:00:00.000Z' })
	meetingDate?: string;
}

export class ArdDetailItemDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	enrollmentStudentId: number;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	courseId: number;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	professorId: number;

	@IsOptional()
	@IsObject()
	@ApiPropertyOptional({ example: { es: 'Comentario del delegado', en: 'Delegate comment' } })
	comments?: I18nText;
}

export class CreateArdDetailsDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	ardId: number;

	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => ArdDetailItemDto)
	@ApiProperty({ type: [ArdDetailItemDto] })
	details: ArdDetailItemDto[];
}

export class ArdMaintenanceQueryDto extends PaginationQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiPropertyOptional({ example: 1 })
	campusId?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiPropertyOptional({ example: 1 })
	programId?: number;

	@IsOptional()
	@IsDateString()
	@ApiPropertyOptional({ example: '2026-06-23' })
	meetingDate?: string;

	@IsOptional()
	@IsString()
	@Length(1, 100)
	@ApiPropertyOptional({ example: 'ARD-VL' })
	search?: string;
}

export class ArdClassRepresentativesQueryDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	programId: number;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	campusId: number;
}

export class ArdProgramCoursesQueryDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	programId: number;
}

export class ArdCourseProfessorsQueryDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	courseId: number;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	campusId: number;
}

export class ArdExportDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	programId: number;

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@Type(() => Number)
	@ApiPropertyOptional({ example: [10, 11] })
	areaChartIds?: number[];

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@Type(() => Number)
	@ApiPropertyOptional({ example: [20, 21] })
	subareaChartIds?: number[];

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiPropertyOptional({ example: 1 })
	campusId?: number;

	@IsIn(['es', 'en'])
	@ApiProperty({ example: 'es', enum: ['es', 'en'] })
	lang: 'es' | 'en';
}

export class ArdAttendanceExportDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	ardId: number;

	@IsIn(['es', 'en'])
	@ApiProperty({ example: 'es', enum: ['es', 'en'] })
	lang: 'es' | 'en';
}

export interface ArdMaintenanceItem {
	id: number;
	code: string;
	meetingDate: Date;
	campusId: number;
	campusCode: string;
	programId: number;
	programName: I18nText;
	detailsCount: number;
	createdAt: Date;
}

export interface ArdDetailView {
	id: number;
	enrollmentStudentId: number;
	studentCode: string;
	studentFullName: string;
	courseId: number;
	courseCode: string;
	courseName: I18nText;
	professorId: number;
	professorCode: string;
	professorFullName: string;
	comments: I18nText;
}

export interface ArdView {
	id: number;
	code: string;
	meetingDate: Date;
	campusId: number;
	campusCode: string;
	academicPeriodId: number;
	programId: number;
	programName: I18nText;
	createdAt: Date;
	details: ArdDetailView[];
}

export interface ArdClassRepresentative {
	enrollmentStudentId: number;
	studentId: number;
	studentCode: string;
	studentFullName: string;
	courseSectionId: number;
	courseId: number;
	courseCode: string;
	courseName: I18nText;
	sectionCode: string;
	professorId: number;
	professorCode: string;
	professorFullName: string;
}

export interface ArdProgramCourse {
	courseId: number;
	courseCode: string;
	courseName: I18nText;
}

export interface ArdCourseProfessor {
	professorId: number;
	professorCode: string;
	professorFullName: string;
}

export interface ArdExportRow {
	meetingDate: string;
	code: string;
	professorFullName: string;
	courseName: I18nText;
	subareaName: I18nText | null;
	areaName: I18nText | null;
	campusName: I18nText;
	programName: I18nText;
	comments: I18nText;
}

export interface ArdExportMeta {
	periodCode: string;
	programName: I18nText;
}

export interface ArdAttendanceMeta {
	meetingDateLabel: string;
	meetingDateFile: string;
	campusName: I18nText;
	programCode: string;
}

export interface ArdAttendanceStudent {
	studentCode: string;
	studentFullName: string;
}
