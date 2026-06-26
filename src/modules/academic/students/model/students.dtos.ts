import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsEmail()
	@ApiProperty({ example: 'U202111363@upc.edu.pe', required: true })
	email: string;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	graduationModalityTypeId: number;
}

export class UpdateStudentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsEmail()
	@ApiProperty({ example: 'U202111363@upc.edu.pe', required: false })
	email?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	graduationModalityTypeId?: number;
}

export class FilterStudentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsEmail()
	@ApiProperty({ example: 'U202111363@upc.edu.pe', required: false })
	email?: string;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	graduationModalityTypeId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'U2023',
		description: 'Partial code search (case-insensitive substring match)',
		required: false,
	})
	code?: string;
}
