import { IsBoolean, IsDate, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateNotificationDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	survey_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	notification_status_type_id: number;

	@IsString()
	@ApiProperty({ example: 'token_example', required: true })
	token: string;

	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: true })
	sent_date: Date;

	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: true })
	max_register_date: Date;
}

export class UpdateNotificationDto extends BaseDto {
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
	survey_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	notification_status_type_id?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'token_example', required: false })
	token?: string;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	sent_date?: Date;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	max_register_date?: Date;
}

export class FilterNotificationDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	survey_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	notification_status_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'token_example', required: false })
	token?: string;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	sent_date?: Date;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	max_register_date?: Date;
}
