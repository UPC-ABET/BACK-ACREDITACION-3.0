import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	Length,
	Min,
	ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';

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
	@IsString()
	@Length(0, 5000)
	@ApiPropertyOptional({ example: 'Student comment about the course' })
	comments?: string;
}

export class CreateArdDto {
	@IsDateString()
	@ApiProperty({ example: '2026-06-23T15:00:00.000Z' })
	meetingDate: string;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1 })
	campusId: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiPropertyOptional({ example: 1 })
	programId?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiPropertyOptional({ example: 1 })
	academicPeriodId?: number;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ArdDetailItemDto)
	@ApiPropertyOptional({ type: [ArdDetailItemDto] })
	details?: ArdDetailItemDto[];
}

export class UpdateArdDto {
	@IsOptional()
	@IsDateString()
	@ApiPropertyOptional({ example: '2026-06-23T15:00:00.000Z' })
	meetingDate?: string;

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
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiPropertyOptional({ example: 1 })
	academicPeriodId?: number;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ArdDetailItemDto)
	@ApiPropertyOptional({ type: [ArdDetailItemDto] })
	details?: ArdDetailItemDto[];
}

export class ArdMaintenanceQueryDto extends PaginationQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@ApiPropertyOptional({ example: 1 })
	campusId?: number;

	@IsOptional()
	@IsDateString()
	@ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
	dateFrom?: string;

	@IsOptional()
	@IsDateString()
	@ApiPropertyOptional({ example: '2026-06-30T23:59:59.000Z' })
	dateTo?: string;

	@IsOptional()
	@IsString()
	@Length(1, 100)
	@ApiPropertyOptional({ example: 'ARD-VL' })
	search?: string;
}

export interface ArdMaintenanceItem {
	id: number;
	code: string;
	meetingDate: Date;
	campusId: number;
	campusCode: string;
	programId: number | null;
	detailsCount: number;
	createdAt: Date;
}

export interface ArdDetailItem {
	id: number;
	enrollmentStudentId: number | null;
	courseId: number;
	professorId: number;
	comments: string | null;
}

export class ArdAttendeesQueryDto {
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

export interface ArdDelegateAttendee {
	enrolledStudentId: number;
	studentId: number;
	studentCode: string;
	studentFullName: string;
	courseSectionId: number;
	courseId: number;
	courseCode: string;
	courseName: string;
	sectionCode: string;
	professorId: number;
	professorFullName: string;
}

export interface ArdGuestAttendee {
	enrolledStudentId: number;
	studentId: number;
	studentCode: string;
	studentFullName: string;
}

export interface ArdAttendeesResult {
	delegates: ArdDelegateAttendee[];
	guests: ArdGuestAttendee[];
}

export class ArdProgramCoursesQueryDto {
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

export interface ArdCourseSectionProfessor {
	courseSectionId: number;
	sectionCode: string;
	professorId: number;
	professorFullName: string;
}

export interface ArdProgramCourse {
	courseId: number;
	courseCode: string;
	courseName: string;
	sections: ArdCourseSectionProfessor[];
}
