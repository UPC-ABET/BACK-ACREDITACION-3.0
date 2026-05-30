import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationLogDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, nullable: true })
	ifcId?: number | null;

	@IsInt()
	@ApiProperty({ example: 1, required: true })
	chartId: number;

	@IsInt()
	@ApiProperty({ example: 1, required: true })
	notificationConfigId: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, nullable: true })
	notifierUserId?: number | null;

	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [1, 2, 3], required: true })
	toStaffIds: number[];

	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [1, 2, 3], required: true })
	ccStaffIds: number[];

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'providerMessageIdExample', required: false, nullable: true })
	providerMessageId?: string | null;
}

export class UpdateNotificationLogDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, nullable: true })
	ifcId?: number | null;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	chartId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	notificationConfigId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, nullable: true })
	notifierUserId?: number | null;

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [1, 2, 3], required: false })
	toStaffIds?: number[];

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [1, 2, 3], required: false })
	ccStaffIds?: number[];

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'providerMessageIdExample', required: false, nullable: true })
	providerMessageId?: string | null;
}

export class FilterNotificationLogDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	ifcId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	chartId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	notificationConfigId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	notifierUserId?: number;

	@IsOptional()
	@ApiProperty({ example: 'providerMessageIdExample', required: false })
	providerMessageId?: string;
}
