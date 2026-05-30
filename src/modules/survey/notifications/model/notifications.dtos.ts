import { IsBoolean, IsDate, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	surveyId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	notificationStatusTypeId: number;

	@IsString()
	@ApiProperty({ example: 'tokenExample', required: true })
	token: string;

	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: true })
	sentDate: Date;

	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: true })
	maxRegisterDate: Date;
}

export class UpdateNotificationDto {
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
	surveyId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	notificationStatusTypeId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'tokenExample', required: false })
	token?: string;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	sentDate?: Date;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	maxRegisterDate?: Date;
}

export class FilterNotificationDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	surveyId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	notificationStatusTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 'tokenExample', required: false })
	token?: string;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	sentDate?: Date;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	maxRegisterDate?: Date;
}
