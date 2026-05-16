// no-override
import { IsBoolean, IsDate, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateNotificationLogDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	course_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	notified_staff_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	notifier_staff_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	user_id: number;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2026-05-16T00:00:00.000Z', required: false })
	sent_at?: Date;
}

export class UpdateNotificationLogDto extends BaseDto {
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
	course_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	notified_staff_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	notifier_staff_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	user_id?: number;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2026-05-16T00:00:00.000Z', required: false })
	sent_at?: Date;
}

export class FilterNotificationLogDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	course_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	notified_staff_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	notifier_staff_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	user_id?: number;
}
