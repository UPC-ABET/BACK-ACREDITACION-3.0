import { IsDateString, IsInt, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePeriodDto {
	@IsString()
	@Matches(/^(19|20)\d{4}$/, {
		message: 'code must match the format YYYYNN (e.g. 202620)',
	})
	@MaxLength(50)
	@ApiProperty({
		example: '202620',
		required: true,
		description: 'Academic cycle code (YYYYNN, e.g. 202620, 202625, 202515)',
	})
	code: string;

	@IsDateString()
	@ApiProperty({
		example: '2026-03-15',
		required: true,
		description: 'Cycle start date (ISO 8601)',
	})
	startDate: string;

	@IsDateString()
	@ApiProperty({
		example: '2026-07-15',
		required: true,
		description: 'Cycle end date (must be >= startDate)',
	})
	endDate: string;

	@IsInt()
	@ApiProperty({
		example: 1,
		required: true,
		description: 'core.types id of the program modality (TG102)',
	})
	modalityTypeId: number;
}
