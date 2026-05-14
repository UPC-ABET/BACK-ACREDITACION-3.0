import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateNotificationMessageDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	survey_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	program_id: number;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'title_example', required: true })
	title: string;

	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'body_example', required: true })
	body: string;

	@ApiProperty({ example: { key: 'cc_receivers_value' }, required: true })
	cc_receivers: any;
}

export class UpdateNotificationMessageDto extends BaseDto {
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
	survey_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	program_id?: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'title_example', required: false })
	title?: string;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'body_example', required: false })
	body?: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'cc_receivers_value' }, required: false })
	cc_receivers?: any;
}

export class FilterNotificationMessageDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	survey_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	program_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'title_example', required: false })
	title?: string;

	@IsOptional()
	@ApiProperty({ example: 'body_example', required: false })
	body?: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'cc_receivers_value' }, required: false })
	cc_receivers?: any;
}
