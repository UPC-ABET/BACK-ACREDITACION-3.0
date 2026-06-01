import { IsBoolean, IsDate, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export interface OpenPeriodInput {
	code: string;
	startDate: string | Date;
	endDate: string | Date;
	modalityTypeId: number;
}

export class CreateAcademicPeriodDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	modalityTypeId: number;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'codeExample', required: true })
	code: string;

	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: true })
	startDate: Date;

	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: true })
	endDate: Date;
}

export class UpdateAcademicPeriodDto {
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
	modalityTypeId?: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	startDate?: Date;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	endDate?: Date;
}

export class FilterAcademicPeriodDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	modalityTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	startDate?: Date;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	endDate?: Date;
}
