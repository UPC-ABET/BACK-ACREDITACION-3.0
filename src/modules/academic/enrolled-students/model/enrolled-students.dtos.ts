import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';
import type { I18nText } from 'src/shared/types/i18n';

@Entity({ name: 'enrolled_students', schema: 'academic' })
export class EnrolledStudentEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	studentId: number;

	@IntegerFKIDColumn({ nullable: false })
	studyPlanAcademicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	campusId: number;

	@IntegerColumn({ nullable: false })
	enrollmentModalityTypeId: number;

	// %% RELATIONS
}

export class CreateEnrolledStudentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	studentId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	studyPlanAcademicPeriod: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	campusId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	enrollementModalityTypeId: number;
}

export class UpdateEnrolledStudentDto {
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
	studentId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	studyPlanAcademicPeriod?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	enrollementModalityTypeId?: number;
}

export class FilterEnrolledStudentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	studentId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	studyPlanAcademicPeriod?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	enrollementModalityTypeId?: number;
}

export class EnrolledStudentMaintenanceQueryDto extends PaginationQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@ApiPropertyOptional({ example: 1, description: 'Filter by program (carrera) id' })
	programId?: number;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: 'searchExample',
		description: 'Search by student code, first name or last name',
	})
	search?: string;
}

export class UpdateEnrolledStudentMaintenanceDto {
	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiPropertyOptional({ example: 'STU-0001' })
	studentCode?: string;

	@IsOptional()
	@IsString()
	@Length(1, 255)
	@ApiPropertyOptional({ example: 'John' })
	firstName?: string;

	@IsOptional()
	@IsString()
	@Length(1, 255)
	@ApiPropertyOptional({ example: 'Doe' })
	lastName?: string;

	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({ example: 1, description: 'Program (carrera) id' })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({ example: 1 })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({ example: 1, description: 'Enrollment modality type id' })
	enrollementModalityTypeId?: number;
}

export class CreateEnrolledStudentMaintenanceDto {
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'STU-0001' })
	studentCode: string;

	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'John' })
	firstName: string;

	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'Doe' })
	lastName: string;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Program (carrera) id' })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1 })
	campusId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Enrollment modality type id' })
	enrollementModalityTypeId: number;
}

export interface EnrolledStudentMaintenanceItem {
	id: number;
	studentCode: string;
	firstName: string;
	lastName: string;
	programId: number;
	campusId: number;
	modalityTypeId: number;
	campusName: I18nText;
	programName: I18nText;
	modalityTypeName: I18nText;
}
