import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
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
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
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
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
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
