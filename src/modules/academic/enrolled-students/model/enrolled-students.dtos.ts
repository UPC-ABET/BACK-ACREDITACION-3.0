import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'enrolled_students', schema: 'academic' })
export class EnrolledStudentEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	student_id: number;

	@IntegerFKIDColumn({ nullable: false })
	study_plan_academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	campus_id: number;

	@IntegerColumn({ nullable: false })
	enrollment_modality_type_id: number;

	// %% RELACIONES
}

export class CreateEnrolledStudentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	student_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	study_plan_academic_period: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	campus_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	enrollement_modality_type_id: number;
}

export class UpdateEnrolledStudentDto {
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
	student_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	study_plan_academic_period?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campus_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	enrollement_modality_type_id?: number;
}

export class FilterEnrolledStudentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	student_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	study_plan_academic_period?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	campus_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	enrollement_modality_type_id?: number;
}
