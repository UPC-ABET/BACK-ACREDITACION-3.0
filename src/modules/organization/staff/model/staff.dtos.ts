import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateStaffDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	user_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	position_type_id: number;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'job_title_example', required: true })
	job_title: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'job_description_example', required: true })
	job_description: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_email_example', required: true })
	staff_email: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_phone_example', required: true })
	staff_phone: string;
}

export class UpdateStaffDto extends BaseDto {
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
	user_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	position_type_id?: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'job_title_example', required: false })
	job_title?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'job_description_example', required: false })
	job_description?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_email_example', required: false })
	staff_email?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_phone_example', required: false })
	staff_phone?: string;
}

export class FilterStaffDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	user_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	position_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'job_title_example', required: false })
	job_title?: string;

	@IsOptional()
	@ApiProperty({ example: 'job_description_example', required: false })
	job_description?: string;

	@IsOptional()
	@ApiProperty({ example: 'staff_email_example', required: false })
	staff_email?: string;

	@IsOptional()
	@ApiProperty({ example: 'staff_phone_example', required: false })
	staff_phone?: string;
}
