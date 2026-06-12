import { IsArray, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationLogDto {
	@IsInt()
	@ApiProperty({
		example: 1,
		required: true,
		description: 'core.types id of the category (TG1004)',
	})
	categoryTypeId: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, nullable: true })
	emailTemplateId?: number | null;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, nullable: true })
	notifierUserId?: number | null;

	@IsOptional()
	@IsArray()
	@ApiProperty({ example: ['a@upc.edu.pe'], required: false })
	toEmails?: string[];

	@IsOptional()
	@IsArray()
	@ApiProperty({ example: ['b@upc.edu.pe'], required: false })
	ccEmails?: string[];

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [1, 2], required: false })
	toStaffIds?: number[];

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({ example: [3, 4], required: false })
	ccStaffIds?: number[];

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'provider-message-id', required: false, nullable: true })
	providerMessageId?: string | null;

	@IsInt()
	@ApiProperty({
		example: 1,
		required: true,
		description: 'core.types id of the notification status (TG1001)',
	})
	statusTypeId: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'SMTP timeout', required: false, nullable: true })
	errorMessage?: string | null;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { ifcId: 1, chartId: 2, configId: 3 }, required: false })
	context?: Record<string, unknown>;
}

export class FilterNotificationLogDto {
	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	categoryTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	emailTemplateId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	notifierUserId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	statusTypeId?: number;
}
