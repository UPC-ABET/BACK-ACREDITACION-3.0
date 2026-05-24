import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationLogDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 42, required: false, nullable: true })
	ifc_id?: number | null;

	@IsInt()
	@ApiProperty({ example: 310, required: true })
	chart_id: number;

	@IsInt()
	@ApiProperty({ example: 7, required: true })
	notification_config_id: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 99, required: false, nullable: true })
	notifier_user_id?: number | null;

	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [11], required: true })
	to_staff_ids: number[];

	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [12, 13], required: true })
	cc_staff_ids: number[];

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'pm-abc-123', required: false, nullable: true })
	provider_message_id?: string | null;
}

export class UpdateNotificationLogDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 42, required: false, nullable: true })
	ifc_id?: number | null;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 310, required: false })
	chart_id?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 7, required: false })
	notification_config_id?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 99, required: false, nullable: true })
	notifier_user_id?: number | null;

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [11], required: false })
	to_staff_ids?: number[];

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [12, 13], required: false })
	cc_staff_ids?: number[];

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'pm-abc-123', required: false, nullable: true })
	provider_message_id?: string | null;
}

export class FilterNotificationLogDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 42, required: false })
	ifc_id?: number;

	@IsOptional()
	@ApiProperty({ example: 310, required: false })
	chart_id?: number;

	@IsOptional()
	@ApiProperty({ example: 7, required: false })
	notification_config_id?: number;

	@IsOptional()
	@ApiProperty({ example: 99, required: false })
	notifier_user_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'pm-abc-123', required: false })
	provider_message_id?: string;
}
